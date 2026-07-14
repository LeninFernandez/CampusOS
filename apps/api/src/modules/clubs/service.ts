import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type {
  CreateClubInput,
  UpdateClubInput,
  ReassignCoordinatorInput,
  AddMemberInput,
  TransferHeadInput,
} from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ClubRecord = {
  id: string;
  name: string;
  description: string;
  facultyDetails: string;
  socialLinks: unknown;
  logoUrl: string | null;
  status: string;
  facultyCoordinatorId: string | null;
  createdAt: Date;
};

function mapClub(club: ClubRecord) {
  return {
    id: club.id,
    name: club.name,
    description: club.description,
    facultyDetails: club.facultyDetails,
    socialLinks: (club.socialLinks ?? {}) as Record<string, string>,
    logoUrl: club.logoUrl,
    status: club.status,
    facultyCoordinatorId: club.facultyCoordinatorId,
    createdAt: club.createdAt,
  };
}

const CLUB_SELECT = {
  id: true,
  name: true,
  description: true,
  facultyDetails: true,
  socialLinks: true,
  logoUrl: true,
  status: true,
  facultyCoordinatorId: true,
  createdAt: true,
} as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export const clubsService = {
  // ── createClub ─────────────────────────────────────────────────────────────
  async createClub(input: CreateClubInput) {
    // 1. Duplicate name check (case-insensitive)
    const duplicate = await prisma.club.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError('Club name already exists');

    // 2. Faculty coordinator uniqueness check
    if (input.facultyCoordinatorId) {
      const taken = await prisma.club.findFirst({
        where: { facultyCoordinatorId: input.facultyCoordinatorId },
        select: { id: true },
      });
      if (taken) throw new ConflictError('Faculty Coordinator already assigned to another club');
    }

    // 3. Club head user must exist
    const headUser = await prisma.user.findUnique({
      where: { id: input.clubHeadUserId },
      select: { id: true },
    });
    if (!headUser) throw new BadRequestError('Club head user not found');

    // 4. Atomic: create club + Club Head membership
    const newClub = await prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name: input.name,
          description: input.description,
          facultyDetails: input.facultyDetails,
          status: 'ACTIVE',
          facultyCoordinatorId: input.facultyCoordinatorId ?? null,
          socialLinks: (input.socialLinks as object | undefined) ?? Prisma.JsonNull,
          logoUrl: input.logoUrl ?? null,
        },
        select: CLUB_SELECT,
      });

      await tx.clubMembership.create({
        data: { userId: input.clubHeadUserId, clubId: club.id, role: 'CLUB_HEAD' },
      });

      return club;
    });

    return mapClub(newClub);
  },

  // ── listClubs ───────────────────────────────────────────────────────────────
  async listClubs(params: { search?: string; page: number; limit: number }) {
    const { search, page, limit } = params;
    const where = search?.trim()
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      prisma.club.findMany({
        where,
        select: CLUB_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.club.count({ where }),
    ]);

    return {
      items: rawItems.map(mapClub),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // ── getClub ─────────────────────────────────────────────────────────────────
  async getClub(clubId: string) {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        ...CLUB_SELECT,
        departments: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!club) throw new NotFoundError('Club not found');

    return { ...mapClub(club), departments: club.departments };
  },

  // ── updateClub ──────────────────────────────────────────────────────────────
  async updateClub(
    clubId: string,
    isSuperAdmin: boolean,
    callerId: string,
    input: UpdateClubInput,
  ) {
    // Authorization: caller must be Club Head of this club or Super Admin
    if (!isSuperAdmin) {
      const membership = await prisma.clubMembership.findFirst({
        where: { clubId, userId: callerId, role: 'CLUB_HEAD' },
        select: { id: true },
      });
      if (!membership) {
        throw new ForbiddenError("Only this club's Club Head or a Super Admin can update the club");
      }
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!club) throw new NotFoundError('Club not found');

    const updated = await prisma.club.update({
      where: { id: clubId },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.facultyDetails !== undefined && { facultyDetails: input.facultyDetails }),
        ...(input.socialLinks !== undefined && {
          socialLinks: input.socialLinks === null ? Prisma.JsonNull : (input.socialLinks as object),
        }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
      },
      select: CLUB_SELECT,
    });

    return mapClub(updated);
  },

  // ── reassignCoordinator ─────────────────────────────────────────────────────
  async reassignCoordinator(clubId: string, input: ReassignCoordinatorInput) {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!club) throw new NotFoundError('Club not found');

    // Check new coordinator not already assigned to a *different* club
    const taken = await prisma.club.findFirst({
      where: {
        facultyCoordinatorId: input.facultyCoordinatorId,
        NOT: { id: clubId },
      },
      select: { id: true },
    });
    if (taken) throw new ConflictError('Faculty Coordinator already assigned to another club');

    const updated = await prisma.club.update({
      where: { id: clubId },
      data: { facultyCoordinatorId: input.facultyCoordinatorId },
      select: CLUB_SELECT,
    });

    return mapClub(updated);
  },

  // ── listMembers ─────────────────────────────────────────────────────────────
  async listMembers(params: {
    clubId: string;
    callerId: string;
    callerIsSuperAdmin: boolean;
    page: number;
    limit: number;
  }) {
    const { clubId, callerId, callerIsSuperAdmin, page, limit } = params;

    // Authorization: must be a club member or Super Admin
    if (!callerIsSuperAdmin) {
      const callerMembership = await prisma.clubMembership.findFirst({
        where: { clubId, userId: callerId },
        select: { id: true },
      });
      if (!callerMembership) {
        throw new ForbiddenError('You must be a club member to view the roster');
      }
    }

    // Determine whether caller can see email: Club Head of this club OR Super Admin
    let canSeeEmail = callerIsSuperAdmin;
    if (!callerIsSuperAdmin) {
      const isClubHead = await prisma.clubMembership.findFirst({
        where: { clubId, userId: callerId, role: 'CLUB_HEAD' },
        select: { id: true },
      });
      canSeeEmail = !!isClubHead;
    }

    const skip = (page - 1) * limit;
    const [memberships, total] = await Promise.all([
      prisma.clubMembership.findMany({
        where: { clubId },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
        skip,
        take: limit,
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.clubMembership.count({ where: { clubId } }),
    ]);

    const items = memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: m.role,
      ...(canSeeEmail && { email: m.user.email }),
    }));

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // ── addMember ───────────────────────────────────────────────────────────────
  async addMember(clubId: string, callerId: string, input: AddMemberInput) {
    // Caller must be Club Head
    const callerMembership = await prisma.clubMembership.findFirst({
      where: { clubId, userId: callerId, role: 'CLUB_HEAD' },
      select: { id: true },
    });
    if (!callerMembership) {
      throw new ForbiddenError("Only this club's Club Head can add members");
    }

    // Target user must exist
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!targetUser) throw new NotFoundError('User not found');

    // Not already a member
    const existing = await prisma.clubMembership.findFirst({
      where: { clubId, userId: input.userId },
      select: { id: true },
    });
    if (existing) throw new ConflictError('User is already a member of this club');

    await prisma.clubMembership.create({
      data: { userId: input.userId, clubId, role: 'MEMBER' },
    });

    return { userId: input.userId, clubId, role: 'MEMBER' as const };
  },

  // ── removeMember ────────────────────────────────────────────────────────────
  async removeMember(clubId: string, targetUserId: string, callerId: string) {
    // Fetch target membership
    const targetMembership = await prisma.clubMembership.findFirst({
      where: { clubId, userId: targetUserId },
      select: { id: true, role: true },
    });
    if (!targetMembership) throw new NotFoundError('User is not a member of this club');

    // Caller must be Club Head OR removing themselves
    const isSelf = callerId === targetUserId;
    if (!isSelf) {
      const callerIsClubHead = await prisma.clubMembership.findFirst({
        where: { clubId, userId: callerId, role: 'CLUB_HEAD' },
        select: { id: true },
      });
      if (!callerIsClubHead) {
        throw new ForbiddenError(
          "Only this club's Club Head or the member themselves can remove a member",
        );
      }
    }

    // Sole Club Head guard
    if (targetMembership.role === 'CLUB_HEAD') {
      const headCount = await prisma.clubMembership.count({
        where: { clubId, role: 'CLUB_HEAD' },
      });
      if (headCount === 1) throw new BadRequestError('Cannot remove the sole Club Head');
    }

    await prisma.clubMembership.delete({ where: { id: targetMembership.id } });
  },

  // ── demoteToMember ──────────────────────────────────────────────────────────
  async demoteToMember(clubId: string, targetUserId: string, callerId: string) {
    // Caller must be Club Head
    const callerMembership = await prisma.clubMembership.findFirst({
      where: { clubId, userId: callerId, role: 'CLUB_HEAD' },
      select: { id: true },
    });
    if (!callerMembership) {
      throw new ForbiddenError("Only this club's Club Head can change member roles");
    }

    // Target must be in this club
    const targetMembership = await prisma.clubMembership.findFirst({
      where: { clubId, userId: targetUserId },
      select: { id: true },
    });
    if (!targetMembership) throw new NotFoundError('User is not a member of this club');

    // Sole Club Head guard — cannot demote if this is the only Club Head
    const targetIsClubHead = await prisma.clubMembership.findFirst({
      where: { clubId, userId: targetUserId, role: 'CLUB_HEAD' },
      select: { id: true },
    });
    if (targetIsClubHead) {
      const headCount = await prisma.clubMembership.count({
        where: { clubId, role: 'CLUB_HEAD' },
      });
      if (headCount === 1) throw new BadRequestError('Cannot demote the sole Club Head');
    }

    await prisma.clubMembership.update({
      where: { id: targetMembership.id },
      data: { role: 'MEMBER' },
    });

    return { userId: targetUserId, clubId, role: 'MEMBER' as const };
  },

  // ── transferHead ────────────────────────────────────────────────────────────
  async transferHead(clubId: string, input: TransferHeadInput) {
    // Club must exist
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!club) throw new NotFoundError('Club not found');

    // New head must already be a club member
    const newHeadMembership = await prisma.clubMembership.findFirst({
      where: { clubId, userId: input.newClubHeadUserId },
      select: { id: true },
    });
    if (!newHeadMembership) throw new NotFoundError('Target user is not a member of this club');

    // Find current Club Head
    const currentHead = await prisma.clubMembership.findFirst({
      where: { clubId, role: 'CLUB_HEAD' },
      select: { id: true },
    });

    // Atomic swap: demote current head → promote new head
    await prisma.$transaction(async (tx) => {
      if (currentHead) {
        await tx.clubMembership.update({
          where: { id: currentHead.id },
          data: { role: 'MEMBER' },
        });
      }
      await tx.clubMembership.update({
        where: { id: newHeadMembership.id },
        data: { role: 'CLUB_HEAD' },
      });
    });

    return { clubId, newClubHeadUserId: input.newClubHeadUserId };
  },
};
