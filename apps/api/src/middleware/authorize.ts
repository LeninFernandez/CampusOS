import { Request, Response, NextFunction } from 'express';
import { PlatformRole } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';

/**
 * Guard that checks req.user.platformRole.
 * NOTE: 'CLUB_HEAD' is a ClubRole, not a PlatformRole — never pass it here.
 * For endpoints that require Club Head access, use authorizeClubRole or a
 * dedicated middleware (see ARCHITECTURE.md Correction 1).
 */
export const authorize = (allowedRoles: PlatformRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    if (!allowedRoles.includes(req.user.platformRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
};
