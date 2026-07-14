import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { PublishBlogInput, UpdateBlogInput } from './schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BLOG_SUMMARY_SELECT = {
  id: true,
  clubId: true,
  departmentId: true,
  title: true,
  tags: true,
  thumbnailUrl: true,
  authorId: true,
  publishedAt: true,
} as const;

type BlogSummaryRecord = {
  id: string;
  clubId: string | null;
  departmentId: string | null;
  title: string;
  tags: string[];
  thumbnailUrl: string | null;
  authorId: string;
  publishedAt: Date;
};

function mapBlogSummary(blog: BlogSummaryRecord) {
  return {
    id: blog.id,
    clubId: blog.clubId,
    departmentId: blog.departmentId,
    title: blog.title,
    tags: blog.tags,
    thumbnailUrl: blog.thumbnailUrl,
    authorId: blog.authorId,
    publishedAt: blog.publishedAt,
  };
}

/**
 * Returns true if callerId is allowed to manage (update/delete) the blog.
 * Allowed: Super Admin, blog author, or Club Head of the blog's club.
 */
async function canManageBlog(
  blog: { authorId: string; clubId: string | null },
  callerId: string,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (blog.authorId === callerId) return true;

  if (blog.clubId) {
    const membership = await prisma.clubMembership.findFirst({
      where: { clubId: blog.clubId, userId: callerId, role: 'CLUB_HEAD' },
      select: { id: true },
    });
    if (membership) return true;
  }

  return false;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const blogsService = {
  /**
   * Publish a new blog post under a club.
   * Caller must be the Club Head of this club OR a Department Head of any department in this club.
   */
  async publishBlog(
    clubId: string,
    callerId: string,
    isSuperAdmin: boolean,
    input: PublishBlogInput,
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
            'Only the Club Head or a Department Head of this club can publish blogs',
          );
        }
      }
    }

    const blog = await prisma.blog.create({
      data: {
        clubId,
        authorId: callerId,
        title: input.title,
        content: input.content,
        tags: input.tags ?? [],
        thumbnailUrl: input.thumbnailUrl ?? null,
        departmentId: input.departmentId ?? null,
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    return { id: blog.id };
  },

  /**
   * List blogs with optional search/filter and pagination. Returns summary only (no content).
   */
  async listBlogs(params: {
    search?: string;
    clubId?: string;
    tag?: string;
    page: number;
    limit: number;
  }) {
    const { search, clubId, tag, page, limit } = params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andFilters: any[] = [];

    if (search?.trim()) {
      andFilters.push({ title: { contains: search, mode: 'insensitive' } });
    }

    if (clubId) andFilters.push({ clubId });

    if (tag) andFilters.push({ tags: { has: tag } });

    const where = andFilters.length > 0 ? { AND: andFilters } : {};
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: BLOG_SUMMARY_SELECT,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.blog.count({ where }),
    ]);

    return {
      items: rawItems.map(mapBlogSummary),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get a single blog by ID with full detail including content.
   */
  async getBlog(blogId: string) {
    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        ...BLOG_SUMMARY_SELECT,
        content: true,
      },
    });
    if (!blog) throw new NotFoundError('Blog not found');

    return {
      ...mapBlogSummary(blog),
      content: blog.content,
    };
  },

  /**
   * Update a blog post.
   * Caller must be the blog author, Club Head of the blog's club, or Super Admin.
   */
  async updateBlog(
    blogId: string,
    callerId: string,
    isSuperAdmin: boolean,
    input: UpdateBlogInput,
  ) {
    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        ...BLOG_SUMMARY_SELECT,
        content: true,
      },
    });
    if (!blog) throw new NotFoundError('Blog not found');

    if (!(await canManageBlog(blog, callerId, isSuperAdmin))) {
      throw new ForbiddenError('Not authorized to update this blog');
    }

    const updated = await prisma.blog.update({
      where: { id: blogId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
        ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
      },
      select: {
        ...BLOG_SUMMARY_SELECT,
        content: true,
      },
    });

    return {
      ...mapBlogSummary(updated),
      content: updated.content,
    };
  },

  /**
   * Delete a blog post.
   * Caller must be the blog author, Club Head of the blog's club, or Super Admin.
   */
  async deleteBlog(blogId: string, callerId: string, isSuperAdmin: boolean) {
    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        id: true,
        authorId: true,
        clubId: true,
      },
    });
    if (!blog) throw new NotFoundError('Blog not found');

    if (!(await canManageBlog(blog, callerId, isSuperAdmin))) {
      throw new ForbiddenError('Not authorized to delete this blog');
    }

    await prisma.blog.delete({ where: { id: blogId } });
  },
};
