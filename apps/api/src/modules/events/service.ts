import { prisma } from '@/lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { CreateEventInput, EditEventInput, RejectEventInput } from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isClubHead(clubId: string, userId: string): Promise<boolean> {
  const m = await prisma.clubMembership.findFirst({
    where: { clubId, userId, role: 'CLUB_HEAD' },
    select: { id: true },
  });
  return !!m;
}

async function isFacultyCoordinator(clubId: string, userId: string): Promise<boolean> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { facultyCoordinatorId: true },
  });
  return club?.facultyCoordinatorId === userId;
}

function mapEventSummary(
  event: {
    id: string;
    clubId: string;
    title: string;
    description: string;
    location: string;
    type: string;
    capacity: number | null;
    startTime: Date;
    endTime: Date;
    status: string;
    createdAt: Date;
  },
  registeredCount: number,
) {
  return {
    id: event.id,
    clubId: event.clubId,
    title: event.title,
    description: event.description,
    location: event.location,
    type: event.type,
    capacity: event.capacity,
    registeredCount,
    startTime: event.startTime,
    endTime: event.endTime,
    status: event.status,
    createdAt: event.createdAt,
  };
}

// Reusable select that includes the registration count to avoid N+1
const EVENT_SELECT = {
  id: true,
  clubId: true,
  title: true,
  description: true,
  location: true,
  type: true,
  capacity: true,
  startTime: true,
  endTime: true,
  status: true,
  createdAt: true,
  _count: { select: { registrations: true } },
} as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export const eventsService = {
  /**
   * Create a new event (status = PENDING).
   * Caller must be the Club Head of the given club.
   */
  async requestEvent(clubId: string, callerId: string, input: CreateEventInput) {
    if (!(await isClubHead(clubId, callerId))) {
      throw new ForbiddenError("Only this club's Club Head can create events");
    }

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (end <= start) throw new BadRequestError('endTime must be after startTime');

    const event = await prisma.event.create({
      data: {
        clubId,
        requestedById: callerId,
        status: 'PENDING',
        title: input.title,
        description: input.description,
        location: input.location,
        type: input.type,
        capacity: input.capacity ?? null,
        startTime: start,
        endTime: end,
      },
      select: { id: true, status: true },
    });

    return event;
  },

  /**
   * Edit a PENDING or REJECTED event; always resets status back to PENDING.
   * Caller must be the Club Head of the given club.
   */
  async editEvent(clubId: string, eventId: string, callerId: string, input: EditEventInput) {
    if (!(await isClubHead(clubId, callerId))) {
      throw new ForbiddenError("Only this club's Club Head can edit events");
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, clubId: true, status: true, startTime: true, endTime: true },
    });
    if (!event) throw new NotFoundError('Event not found');
    if (event.clubId !== clubId) throw new NotFoundError('Event not found in this club');
    if (event.status === 'APPROVED') throw new BadRequestError('Cannot edit an approved event');

    // Validate time range using existing values for whichever field is not being changed
    const newStart = input.startTime ? new Date(input.startTime) : event.startTime;
    const newEnd = input.endTime ? new Date(input.endTime) : event.endTime;
    if (newEnd <= newStart) throw new BadRequestError('endTime must be after startTime');

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'PENDING',
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.startTime !== undefined && { startTime: newStart }),
        ...(input.endTime !== undefined && { endTime: newEnd }),
      },
      select: EVENT_SELECT,
    });

    return mapEventSummary(updated, updated._count.registrations);
  },

  /**
   * List events with visibility rules, optional filters, and pagination.
   *
   * Visibility:
   *   - No callerId (unauthenticated): PUBLIC + APPROVED only.
   *   - callerId present, no explicit status filter: PUBLIC APPROVED + CLUB_EXCLUSIVE APPROVED
   *     for clubs the caller belongs to.
   *   - callerId present AND explicit status filter: no visibility restriction (supports Faculty
   *     Approval Queue querying PENDING events).
   */
  async listEvents(params: {
    search?: string;
    status?: string;
    type?: string;
    clubId?: string;
    page: number;
    limit: number;
    callerId?: string;
  }) {
    const { search, status, type, clubId: filterClubId, page, limit, callerId } = params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andFilters: any[] = [];

    if (search?.trim()) {
      andFilters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (type) andFilters.push({ type });
    if (filterClubId) andFilters.push({ clubId: filterClubId });

    if (!callerId) {
      // Unauthenticated: always restrict to PUBLIC + APPROVED regardless of any other filters
      andFilters.push({ status: 'APPROVED', type: 'PUBLIC' });
    } else if (status) {
      // Authenticated with explicit status filter (Faculty Approval Queue, Club Head dashboard)
      // No additional visibility restriction — authenticated callers can query any status
      andFilters.push({ status });
    } else {
      // Authenticated without explicit status: PUBLIC APPROVED + CLUB_EXCLUSIVE APPROVED for caller's clubs
      const callerMemberships = await prisma.clubMembership.findMany({
        where: { userId: callerId },
        select: { clubId: true },
      });
      const callerClubIds = callerMemberships.map((m) => m.clubId);

      andFilters.push({
        OR: [
          { status: 'APPROVED', type: 'PUBLIC' },
          { status: 'APPROVED', type: 'CLUB_EXCLUSIVE', clubId: { in: callerClubIds } },
        ],
      });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : {};
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      prisma.event.findMany({
        where,
        select: EVENT_SELECT,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
      }),
      prisma.event.count({ where }),
    ]);

    return {
      items: rawItems.map((e) => mapEventSummary(e, e._count.registrations)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get a single event by ID with full detail fields.
   */
  async getEvent(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        ...EVENT_SELECT,
        requestedById: true,
        reviewedById: true,
        rejectionReason: true,
      },
    });
    if (!event) throw new NotFoundError('Event not found');

    return {
      ...mapEventSummary(event, event._count.registrations),
      requestedBy: event.requestedById,
      reviewedBy: event.reviewedById,
      rejectionReason: event.rejectionReason,
    };
  },

  /**
   * Approve a PENDING event.
   * Caller must be the Faculty Coordinator of the event's club.
   */
  async approveEvent(eventId: string, callerId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, clubId: true },
    });
    if (!event) throw new NotFoundError('Event not found');
    if (event.status !== 'PENDING') throw new BadRequestError('Only pending events can be approved');
    if (!(await isFacultyCoordinator(event.clubId, callerId))) {
      throw new ForbiddenError('Only the Faculty Coordinator of this club can approve events');
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'APPROVED', reviewedById: callerId },
    });

    return { id: eventId, status: 'APPROVED' as const };
  },

  /**
   * Reject a PENDING event with an optional reason.
   * Caller must be the Faculty Coordinator of the event's club.
   */
  async rejectEvent(eventId: string, callerId: string, input: RejectEventInput) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, clubId: true },
    });
    if (!event) throw new NotFoundError('Event not found');
    if (event.status !== 'PENDING') throw new BadRequestError('Only pending events can be rejected');
    if (!(await isFacultyCoordinator(event.clubId, callerId))) {
      throw new ForbiddenError('Only the Faculty Coordinator of this club can reject events');
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'REJECTED',
        reviewedById: callerId,
        rejectionReason: input.reason ?? null,
      },
    });

    return { id: eventId, status: 'REJECTED' as const };
  },

  /**
   * Register the caller for an event.
   *
   * Uses a single prisma.$transaction so the capacity check and the INSERT are
   * atomic — preventing overbooking under concurrent requests.
   * A duplicate registration triggers a P2002 unique-constraint violation which
   * the global errorHandler maps to HTTP 409.
   */
  async registerForEvent(eventId: string, callerId: string) {
    await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, status: true, type: true, clubId: true, capacity: true },
      });
      if (!event) throw new NotFoundError('Event not found');
      if (event.status !== 'APPROVED') throw new BadRequestError('Can only register for approved events');

      if (event.type === 'CLUB_EXCLUSIVE') {
        const membership = await tx.clubMembership.findFirst({
          where: { clubId: event.clubId, userId: callerId },
          select: { id: true },
        });
        if (!membership) throw new ForbiddenError('This event is exclusive to club members');
      }

      if (event.capacity !== null) {
        const count = await tx.eventRegistration.count({ where: { eventId } });
        if (count >= event.capacity) throw new BadRequestError('Event is full');
      }

      // Will throw Prisma P2002 on duplicate (eventId + userId unique constraint)
      // → errorHandler maps that to HTTP 409 ConflictError
      await tx.eventRegistration.create({ data: { eventId, userId: callerId } });
    });

    return { eventId, userId: callerId };
  },

  /**
   * Remove the caller's registration from an event.
   */
  async unregisterFromEvent(eventId: string, callerId: string) {
    const registration = await prisma.eventRegistration.findFirst({
      where: { eventId, userId: callerId },
      select: { id: true },
    });
    if (!registration) throw new NotFoundError('Not registered for this event');

    await prisma.eventRegistration.delete({ where: { id: registration.id } });
  },

  /**
   * List all registrants for an event (paginated).
   * Caller must be the Club Head OR Faculty Coordinator of the event's club.
   */
  async listRegistrants(eventId: string, callerId: string, page: number, limit: number) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, clubId: true },
    });
    if (!event) throw new NotFoundError('Event not found');

    const [clubHead, facultyCoord] = await Promise.all([
      isClubHead(event.clubId, callerId),
      isFacultyCoordinator(event.clubId, callerId),
    ]);
    if (!clubHead && !facultyCoord) {
      throw new ForbiddenError('Only the Club Head or Faculty Coordinator can view registrants');
    }

    const skip = (page - 1) * limit;
    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where: { eventId },
        select: {
          userId: true,
          registeredAt: true,
          user: { select: { name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { registeredAt: 'asc' },
      }),
      prisma.eventRegistration.count({ where: { eventId } }),
    ]);

    return {
      items: registrations.map((r) => ({
        userId: r.userId,
        name: r.user.name,
        email: r.user.email,
        registeredAt: r.registeredAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
