import { prisma } from '@/lib/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { CreateDepartmentInput, SetHeadInput, AddDeptMemberInput } from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isClubHead(clubId: string, userId: string): Promise<boolean> {
  const m = await prisma.clubMembership.findFirst({
    where: { clubId, userId, role: 'CLUB_HEAD' },
    select: { id: true },
  });
  return !!m;
}

function mapDepartment(d: {
  id: string;
  clubId: string;
  name: string;
  headUserId: string | null;
  createdAt: Date;
}) {
  return {
    id: d.id,
    clubId: d.clubId,
    name: d.name,
    headUserId: d.headUserId,
    createdAt: d.createdAt,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const departmentsService = {
  async createDepartment(clubId: string, callerId: string, input: CreateDepartmentInput) {
    // 1. Caller must be Club Head of this club
    if (!(await isClubHead(clubId, callerId))) {
      throw new ForbiddenError("Only this club's Club Head can create departments");
    }

    // 2. Club must exist
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) throw new NotFoundError('Club not found');

    // 3. Name unique per club (case-insensitive)
    const duplicate = await prisma.department.findFirst({
      where: { clubId, name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError('A department with this name already exists in this club');

    // 4. Create
    const dept = await prisma.department.create({
      data: { clubId, name: input.name },
      select: { id: true, clubId: true, name: true },
    });

    return dept;
  },

  async listDepartments(clubId: string) {
    const items = await prisma.department.findMany({
      where: { clubId },
      select: { id: true, clubId: true, name: true, headUserId: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    // Contract: plain items array, no pagination object
    return { items };
  },

  async getDepartment(departmentId: string, callerId: string, callerIsSuperAdmin: boolean) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        clubId: true,
        name: true,
        headUserId: true,
        createdAt: true,
        memberships: {
          select: { userId: true, user: { select: { name: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!dept) throw new NotFoundError('Department not found');

    // Authorization: Super Admin, Club Head of owning club, OR this dept's Head
    const authorized =
      callerIsSuperAdmin ||
      dept.headUserId === callerId ||
      (await isClubHead(dept.clubId, callerId));

    if (!authorized) throw new ForbiddenError('Access denied');

    return {
      ...mapDepartment(dept),
      members: dept.memberships.map((m) => ({ userId: m.userId, name: m.user.name })),
    };
  },

  async setDepartmentHead(departmentId: string, callerId: string, input: SetHeadInput) {
    // 1. Fetch department
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, clubId: true, name: true, headUserId: true, createdAt: true },
    });
    if (!dept) throw new NotFoundError('Department not found');

    // 2. Caller must be Club Head of the owning club
    if (!(await isClubHead(dept.clubId, callerId))) {
      throw new ForbiddenError("Only the club's Club Head can set the department head");
    }

    // 3. If setting (not clearing), target must already be a dept member
    if (input.userId !== null) {
      const membership = await prisma.departmentMembership.findFirst({
        where: { departmentId, userId: input.userId },
        select: { id: true },
      });
      if (!membership) throw new BadRequestError('User is not a department member');
    }

    // 4. Update
    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: { headUserId: input.userId },
      select: { id: true, clubId: true, name: true, headUserId: true, createdAt: true },
    });

    return mapDepartment(updated);
  },

  async addDepartmentMember(departmentId: string, callerId: string, input: AddDeptMemberInput) {
    // 1. Fetch department
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, clubId: true, headUserId: true },
    });
    if (!dept) throw new NotFoundError('Department not found');

    // 2. Authorization: Club Head of owning club OR this dept's Head (scoped to this dept)
    const callerIsClubHead = await isClubHead(dept.clubId, callerId);
    const callerIsDeptHead = dept.headUserId === callerId;
    if (!callerIsClubHead && !callerIsDeptHead) {
      throw new ForbiddenError(
        "Only the club's Club Head or this department's Head can add members",
      );
    }

    // 3. Target must be a club member first
    const clubMembership = await prisma.clubMembership.findFirst({
      where: { clubId: dept.clubId, userId: input.userId },
      select: { id: true },
    });
    if (!clubMembership) throw new BadRequestError('User must be a club member first');

    // 4. Not already a dept member
    const existing = await prisma.departmentMembership.findFirst({
      where: { departmentId, userId: input.userId },
      select: { id: true },
    });
    if (existing) throw new ConflictError('User is already a member of this department');

    // 5. Create membership
    await prisma.departmentMembership.create({
      data: { userId: input.userId, departmentId },
    });

    return { userId: input.userId, departmentId };
  },

  async removeDepartmentMember(departmentId: string, targetUserId: string, callerId: string) {
    // 1. Fetch department
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, clubId: true, headUserId: true },
    });
    if (!dept) throw new NotFoundError('Department not found');

    // 2. Authorization: Club Head of owning club OR this dept's Head (scoped to this dept)
    const callerIsClubHead = await isClubHead(dept.clubId, callerId);
    const callerIsDeptHead = dept.headUserId === callerId;
    if (!callerIsClubHead && !callerIsDeptHead) {
      throw new ForbiddenError(
        "Only the club's Club Head or this department's Head can remove members",
      );
    }

    // 3. Target must be a dept member
    const membership = await prisma.departmentMembership.findFirst({
      where: { departmentId, userId: targetUserId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundError('User is not a member of this department');

    // 4. Delete membership
    await prisma.departmentMembership.delete({ where: { id: membership.id } });

    // 5. Cascade: if removed user was the head, clear headUserId
    if (dept.headUserId === targetUserId) {
      await prisma.department.update({
        where: { id: departmentId },
        data: { headUserId: null },
      });
    }
  },
};
