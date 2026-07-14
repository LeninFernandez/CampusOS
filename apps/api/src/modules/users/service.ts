import { prisma } from '@/lib/prisma';
import { PlatformRole } from '@prisma/client';
import { NotFoundError, BadRequestError } from '@/lib/errors';

interface SearchUsersParams {
  search?: string;
  page: number;
  limit: number;
  callerIsSuperAdmin: boolean;
}

interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const usersService = {
  async searchUsers(params: SearchUsersParams): Promise<PaginatedResult<unknown>> {
    const { search, page, limit, callerIsSuperAdmin } = params;

    const where = search?.trim()
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    // Super Admin sees platformRole + createdAt; others see only id/name/email
    const select = callerIsSuperAdmin
      ? { id: true, name: true, email: true, platformRole: true, createdAt: true }
      : { id: true, name: true, email: true };

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, platformRole: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  },

  async changeRole(userId: string, newRole: PlatformRole) {
    // Business rule: must keep at least one SUPER_ADMIN on the platform
    if (newRole !== 'SUPER_ADMIN') {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { platformRole: true },
      });

      if (targetUser?.platformRole === 'SUPER_ADMIN') {
        const adminCount = await prisma.user.count({
          where: { platformRole: 'SUPER_ADMIN' },
        });

        if (adminCount === 1) {
          throw new BadRequestError('Cannot remove the last Super Admin');
        }
      }
    }

    // P2025 (record not found) bubbles up — errorHandler maps it to 404
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { platformRole: newRole },
      select: { id: true, name: true, email: true, platformRole: true },
    });

    return updated;
  },
};
