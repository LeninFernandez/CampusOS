import { prisma } from '@/lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { PostAnnouncementInput } from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ANNOUNCEMENT_SUMMARY_SELECT = {
  id: true,
  title: true,
  visibility: true,
  clubId: true,
  departmentId: true,
  createdById: true,
  createdAt: true,
} as const;

type AnnouncementSummaryRecord = {
  id: string;
  title: string;
  visibility: string;
  clubId: string | null;
  departmentId: string | null;
  createdById: string;
  createdAt: Date;
};

function mapAnnouncementSummary(record: AnnouncementSummaryRecord) {
  return {
    id: record.id,
    title: record.title,
    visibility: record.visibility,
    clubId: record.clubId,
    departmentId: record.departmentId,
    createdBy: record.createdById,
    createdAt: record.createdAt,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const announcementsService = {
  /**
   * Create a new announcement.
   * Authorization and scope validation are performed server-side based on visibility.
   */
  async postAnnouncement(
    callerId: string,
    isSuperAdmin: boolean,
    input: PostAnnouncementInput,
  ) {
    const { visibility, clubId, departmentId } = input;

    // ── 1. Validate visibility/scope combinations ──────────────────────────
    if (visibility === 'GLOBAL') {
      if (clubId != null || departmentId != null) {
        throw new BadRequestError(
          'GLOBAL announcements must not have a clubId or departmentId',
        );
      }
    } else if (visibility === 'CLUB') {
      if (!clubId) {
        throw new BadRequestError('CLUB announcements require a clubId');
      }
    } else if (visibility === 'DEPARTMENT') {
      if (!departmentId) {
        throw new BadRequestError('DEPARTMENT announcements require a departmentId');
      }
    }

    // ── 2. Authorization check ─────────────────────────────────────────────
    let finalClubId: string | null = null;
    let finalDepartmentId: string | null = null;

    if (visibility === 'GLOBAL') {
      if (!isSuperAdmin) {
        throw new ForbiddenError('Only Super Admins can post GLOBAL announcements');
      }
      // finalClubId and finalDepartmentId remain null
    } else if (visibility === 'CLUB') {
      // Verify the club exists
      const club = await prisma.club.findUnique({
        where: { id: clubId! },
        select: { id: true },
      });
      if (!club) throw new NotFoundError('Club not found');

      // Caller must be Club Head of this club
      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: clubId!, userId: callerId, role: 'CLUB_HEAD' },
        select: { id: true },
      });
      if (!membership) {
        throw new ForbiddenError('Only the Club Head can post CLUB announcements');
      }

      finalClubId = clubId!;
      finalDepartmentId = null;
    } else {
      // DEPARTMENT
      // Fetch department to get headUserId and server-derived clubId
      const department = await prisma.department.findUnique({
        where: { id: departmentId! },
        select: { id: true, clubId: true, headUserId: true },
      });
      if (!department) throw new NotFoundError('Department not found');

      if (department.headUserId !== callerId) {
        throw new ForbiddenError(
          'Only the Department Head can post DEPARTMENT announcements',
        );
      }

      // clubId is derived server-side from the department
      finalClubId = department.clubId;
      finalDepartmentId = departmentId!;
    }

    // ── 3. Create the announcement ─────────────────────────────────────────
    const announcement = await prisma.announcement.create({
      data: {
        title: input.title,
        content: input.content,
        visibility,
        clubId: finalClubId,
        departmentId: finalDepartmentId,
        createdById: callerId,
      },
      select: { id: true },
    });

    return { id: announcement.id };
  },

  /**
   * List announcements visible to the caller (auto-filtered feed), paginated.
   * Returns summary only (no content).
   */
  async getAnnouncementFeed(callerId: string, page: number, limit: number) {
    // Fetch caller's club and department memberships in parallel
    const [clubMemberships, deptMemberships] = await Promise.all([
      prisma.clubMembership.findMany({
        where: { userId: callerId },
        select: { clubId: true },
      }),
      prisma.departmentMembership.findMany({
        where: { userId: callerId },
        select: { departmentId: true },
      }),
    ]);

    const callerClubIds = clubMemberships.map((m: { clubId: string }) => m.clubId);
    const callerDeptIds = deptMemberships.map((m: { departmentId: string }) => m.departmentId);

    const where = {
      OR: [
        { visibility: 'GLOBAL' as const },
        { visibility: 'CLUB' as const, clubId: { in: callerClubIds } },
        { visibility: 'DEPARTMENT' as const, departmentId: { in: callerDeptIds } },
      ],
    };

    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        select: ANNOUNCEMENT_SUMMARY_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.announcement.count({ where }),
    ]);

    return {
      items: rawItems.map(mapAnnouncementSummary),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get a single announcement by ID.
   * Returns 404 (never 403) when the announcement is not visible to the caller,
   * to avoid confirming its existence.
   */
  async getAnnouncement(announcementId: string, callerId: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: {
        ...ANNOUNCEMENT_SUMMARY_SELECT,
        content: true,
      },
    });

    if (!announcement) throw new NotFoundError('Announcement not found');

    // ── Visibility check ───────────────────────────────────────────────────
    if (announcement.visibility === 'CLUB') {
      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: announcement.clubId!, userId: callerId },
        select: { id: true },
      });
      if (!membership) throw new NotFoundError('Announcement not found');
    } else if (announcement.visibility === 'DEPARTMENT') {
      const membership = await prisma.departmentMembership.findFirst({
        where: { departmentId: announcement.departmentId!, userId: callerId },
        select: { id: true },
      });
      if (!membership) throw new NotFoundError('Announcement not found');
    }
    // GLOBAL: always visible

    return {
      ...mapAnnouncementSummary(announcement),
      content: announcement.content,
    };
  },

  /**
   * Delete an announcement.
   * Caller must be: Super Admin, announcement creator, or Club Head of the announcement's club.
   */
  async deleteAnnouncement(
    announcementId: string,
    callerId: string,
    isSuperAdmin: boolean,
  ) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, clubId: true, createdById: true },
    });

    if (!announcement) throw new NotFoundError('Announcement not found');

    // ── Authorization ──────────────────────────────────────────────────────
    if (!isSuperAdmin && announcement.createdById !== callerId) {
      // Check if caller is Club Head of the announcement's club
      let isClubHead = false;
      if (announcement.clubId) {
        const membership = await prisma.clubMembership.findFirst({
          where: { clubId: announcement.clubId, userId: callerId, role: 'CLUB_HEAD' },
          select: { id: true },
        });
        isClubHead = !!membership;
      }

      if (!isClubHead) {
        throw new ForbiddenError('Not authorized to delete this announcement');
      }
    }

    await prisma.announcement.delete({ where: { id: announcementId } });
  },
};
