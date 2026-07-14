import { prisma } from '@/lib/prisma';
import { BadRequestError } from '@/lib/errors';

// ─── Raw event type returned by Prisma (includes _count) ─────────────────────

type RawEvent = {
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
  _count: { registrations: number };
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const searchService = {
  async search(params: { q: string; type?: string; page: number; limit: number }) {
    const { q, type, page, limit } = params;

    if (!q || q.trim().length < 2) {
      throw new BadRequestError('Search query must be at least 2 characters');
    }

    const skip = (page - 1) * limit;
    const query = q.trim();

    const includeClubs    = !type || type === 'clubs';
    const includeEvents   = !type || type === 'events';
    const includeProjects = !type || type === 'projects';
    const includeBlogs    = !type || type === 'blogs';

    // Run all applicable data queries in parallel
    const [clubs, rawEvents, projects, blogs] = await Promise.all([
      includeClubs
        ? prisma.club.findMany({
            where: {
              OR: [
                { name:        { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              description: true,
              facultyDetails: true,
              socialLinks: true,
              logoUrl: true,
              status: true,
              facultyCoordinatorId: true,
              createdAt: true,
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),

      includeEvents
        ? prisma.event.findMany({
            where: {
              status: 'APPROVED',
              type: 'PUBLIC',
              OR: [
                { title:       { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
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
            },
            skip,
            take: limit,
            orderBy: { startTime: 'desc' },
          })
        : Promise.resolve([]),

      includeProjects
        ? prisma.project.findMany({
            where: {
              OR: [
                { title:       { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              clubId: true,
              departmentId: true,
              title: true,
              description: true,
              techStack: true,
              thumbnailUrl: true,
              status: true,
              createdAt: true,
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),

      includeBlogs
        ? prisma.blog.findMany({
            where: {
              OR: [
                { title:   { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              clubId: true,
              departmentId: true,
              title: true,
              tags: true,
              thumbnailUrl: true,
              authorId: true,
              publishedAt: true,
            },
            skip,
            take: limit,
            orderBy: { publishedAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    // Run all applicable count queries in parallel
    const [clubTotal, eventTotal, projectTotal, blogTotal] = await Promise.all([
      includeClubs
        ? prisma.club.count({
            where: {
              OR: [
                { name:        { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
          })
        : Promise.resolve(0),

      includeEvents
        ? prisma.event.count({
            where: {
              status: 'APPROVED',
              type: 'PUBLIC',
              OR: [
                { title:       { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
          })
        : Promise.resolve(0),

      includeProjects
        ? prisma.project.count({
            where: {
              OR: [
                { title:       { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
          })
        : Promise.resolve(0),

      includeBlogs
        ? prisma.blog.count({
            where: {
              OR: [
                { title:   { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
            },
          })
        : Promise.resolve(0),
    ]);

    const total = clubTotal + eventTotal + projectTotal + blogTotal;

    // Map events: replace _count.registrations with registeredCount
    const events = (rawEvents as RawEvent[]).map((e) => ({
      id: e.id,
      clubId: e.clubId,
      title: e.title,
      description: e.description,
      location: e.location,
      type: e.type,
      capacity: e.capacity,
      registeredCount: e._count.registrations,
      startTime: e.startTime,
      endTime: e.endTime,
      status: e.status,
      createdAt: e.createdAt,
    }));

    return {
      clubs:    includeClubs    ? clubs    : [],
      events:   includeEvents   ? events   : [],
      projects: includeProjects ? projects : [],
      blogs:    includeBlogs    ? blogs    : [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
