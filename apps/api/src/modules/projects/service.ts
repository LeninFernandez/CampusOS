import { prisma } from '@/lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { PublishProjectInput, UpdateProjectInput } from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROJECT_SUMMARY_SELECT = {
  id: true,
  clubId: true,
  departmentId: true,
  title: true,
  description: true,
  techStack: true,
  thumbnailUrl: true,
  status: true,
  createdAt: true,
} as const;

type ProjectSummaryRecord = {
  id: string;
  clubId: string;
  departmentId: string | null;
  title: string;
  description: string;
  techStack: string[];
  thumbnailUrl: string | null;
  status: string;
  createdAt: Date;
};

function mapProjectSummary(project: ProjectSummaryRecord) {
  return {
    id: project.id,
    clubId: project.clubId,
    departmentId: project.departmentId,
    title: project.title,
    description: project.description,
    techStack: project.techStack,
    thumbnailUrl: project.thumbnailUrl,
    status: project.status,
    createdAt: project.createdAt,
  };
}

/**
 * Returns true if callerId is allowed to manage (update/delete) the project.
 * Allowed: Super Admin, project creator, or Club Head of the project's club.
 */
async function canManageProject(
  project: { createdById: string; clubId: string },
  callerId: string,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (project.createdById === callerId) return true;

  const membership = await prisma.clubMembership.findFirst({
    where: { clubId: project.clubId, userId: callerId, role: 'CLUB_HEAD' },
    select: { id: true },
  });
  return !!membership;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const projectsService = {
  /**
   * Publish a new project under a club.
   * Caller must be the Club Head of this club OR a Department Head of any department in this club.
   */
  async publishProject(
    clubId: string,
    callerId: string,
    isSuperAdmin: boolean,
    input: PublishProjectInput,
  ) {
    // Authorization check (Super Admin bypasses)
    if (!isSuperAdmin) {
      // Check 1: is caller a Club Head of this club?
      const clubHeadMembership = await prisma.clubMembership.findFirst({
        where: { clubId, userId: callerId, role: 'CLUB_HEAD' },
        select: { id: true },
      });

      if (!clubHeadMembership) {
        // Check 2: is caller a Department Head of any department in this club?
        const deptHead = await prisma.department.findFirst({
          where: { clubId, headUserId: callerId },
          select: { id: true },
        });

        if (!deptHead) {
          throw new ForbiddenError(
            'Only the Club Head or a Department Head of this club can publish projects',
          );
        }
      }
    }

    // Validate departmentId belongs to this club (if provided)
    if (input.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: input.departmentId, clubId },
        select: { id: true },
      });
      if (!dept) {
        throw new BadRequestError('departmentId does not belong to this club');
      }
    }

    const project = await prisma.project.create({
      data: {
        clubId,
        createdById: callerId,
        title: input.title,
        description: input.description,
        techStack: input.techStack ?? [],
        githubLink: input.githubLink ?? null,
        demoLink: input.demoLink ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        contributors: input.contributors ?? [],
        status: input.status ?? 'IN_PROGRESS',
        departmentId: input.departmentId ?? null,
      },
      select: { id: true },
    });

    return { id: project.id };
  },

  /**
   * List projects with optional search/filter and pagination. Returns summary only.
   */
  async listProjects(params: {
    search?: string;
    clubId?: string;
    page: number;
    limit: number;
  }) {
    const { search, clubId, page, limit } = params;

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

    if (clubId) andFilters.push({ clubId });

    const where = andFilters.length > 0 ? { AND: andFilters } : {};
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: PROJECT_SUMMARY_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    return {
      items: rawItems.map(mapProjectSummary),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get a single project by ID with full detail fields.
   */
  async getProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ...PROJECT_SUMMARY_SELECT,
        githubLink: true,
        demoLink: true,
        contributors: true,
        createdById: true,
      },
    });
    if (!project) throw new NotFoundError('Project not found');

    return {
      ...mapProjectSummary(project),
      githubLink: project.githubLink,
      demoLink: project.demoLink,
      contributors: project.contributors,
      createdBy: project.createdById,
    };
  },

  /**
   * Update a project.
   * Caller must be the project creator, Club Head of the project's club, or Super Admin.
   */
  async updateProject(
    projectId: string,
    callerId: string,
    isSuperAdmin: boolean,
    input: UpdateProjectInput,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clubId: true, createdById: true },
    });
    if (!project) throw new NotFoundError('Project not found');

    if (!(await canManageProject(project, callerId, isSuperAdmin))) {
      throw new ForbiddenError('Not authorized to update this project');
    }

    // Validate departmentId belongs to this project's club (if provided)
    if (input.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: input.departmentId, clubId: project.clubId },
        select: { id: true },
      });
      if (!dept) {
        throw new BadRequestError('departmentId does not belong to this project\'s club');
      }
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.techStack !== undefined && { techStack: input.techStack }),
        ...(input.githubLink !== undefined && { githubLink: input.githubLink }),
        ...(input.demoLink !== undefined && { demoLink: input.demoLink }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
        ...(input.contributors !== undefined && { contributors: input.contributors }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
      },
      select: {
        ...PROJECT_SUMMARY_SELECT,
        githubLink: true,
        demoLink: true,
        contributors: true,
        createdById: true,
      },
    });

    return {
      ...mapProjectSummary(updated),
      githubLink: updated.githubLink,
      demoLink: updated.demoLink,
      contributors: updated.contributors,
      createdBy: updated.createdById,
    };
  },

  /**
   * Delete a project.
   * Caller must be the project creator, Club Head of the project's club, or Super Admin.
   */
  async deleteProject(projectId: string, callerId: string, isSuperAdmin: boolean) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clubId: true, createdById: true },
    });
    if (!project) throw new NotFoundError('Project not found');

    if (!(await canManageProject(project, callerId, isSuperAdmin))) {
      throw new ForbiddenError('Not authorized to delete this project');
    }

    await prisma.project.delete({ where: { id: projectId } });
  },
};
