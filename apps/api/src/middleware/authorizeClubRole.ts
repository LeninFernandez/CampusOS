import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';

export interface AuthorizeClubRoleOptions {
  /** URL param name containing the club UUID. Defaults to 'id'. */
  clubIdParam?: string;
  /** URL param name containing the department UUID (for dept-scoped routes). */
  departmentIdParam?: string;
  allowedRoles: Array<'CLUB_HEAD' | 'DEPARTMENT_HEAD'>;
}

export const authorizeClubRole = (options: AuthorizeClubRoleOptions) => {
  const { clubIdParam = 'id', departmentIdParam, allowedRoles } = options;

  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Not authenticated'));
      }

      // Super Admin bypasses all club-scoped checks
      if (req.user.platformRole === 'SUPER_ADMIN') {
        return next();
      }

      const userId = req.user.id;

      // ── CLUB_HEAD check ───────────────────────────────────────────────────
      if (allowedRoles.includes('CLUB_HEAD')) {
        const clubId = req.params[clubIdParam];
        if (clubId) {
          const membership = await prisma.clubMembership.findFirst({
            where: { userId, clubId, role: 'CLUB_HEAD' },
            select: { id: true },
          });
          if (membership) return next();
        }
      }

      // ── DEPARTMENT_HEAD check (scoped to THIS specific department) ────────
      // Correction 2: must query by the specific department id, not club-wide.
      if (allowedRoles.includes('DEPARTMENT_HEAD') && departmentIdParam) {
        const departmentId = req.params[departmentIdParam];
        if (departmentId) {
          const dept = await prisma.department.findFirst({
            where: { id: departmentId, headUserId: userId },
            select: { id: true },
          });
          if (dept) return next();
        }
      }

      return next(new ForbiddenError('Not authorized for this resource'));
    } catch (err) {
      next(err);
    }
  };
};
