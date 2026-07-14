import { Router, Request, Response, NextFunction } from 'express';
import { usersController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { changeRoleSchema } from './schemas';
import { prisma } from '@/lib/prisma';
import { ForbiddenError } from '@/lib/errors';

const router = Router();

/**
 * GET /users access guard.
 * Passes if caller is SUPER_ADMIN or FACULTY_COORDINATOR (platformRole check),
 * OR if caller has at least one CLUB_HEAD membership (ClubRole check).
 *
 * Cannot use authorize() for this — CLUB_HEAD is a ClubRole, not a PlatformRole.
 * See ARCHITECTURE Correction 1.
 */
async function authorizeUsersSearch(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;

    // Fast path: platform role is sufficient
    if (user.platformRole === 'SUPER_ADMIN' || user.platformRole === 'FACULTY_COORDINATOR') {
      return next();
    }

    // Check if caller is a Club Head of any club
    const clubHeadMembership = await prisma.clubMembership.findFirst({
      where: { userId: user.id, role: 'CLUB_HEAD' },
      select: { id: true },
    });

    if (clubHeadMembership) {
      return next();
    }

    next(new ForbiddenError('Only Club Heads, Faculty Coordinators, and Super Admins can search users'));
  } catch (err) {
    next(err);
  }
}

// GET /users — authenticated + Club Head / Faculty Coordinator / Super Admin
router.get('/', authenticate, authorizeUsersSearch, usersController.searchUsers);

// GET /users/:id — authenticated; self or Super Admin (authorization handled in controller)
router.get('/:id', authenticate, usersController.getUser);

// PATCH /users/:id/role — Super Admin only
router.patch(
  '/:id/role',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(changeRoleSchema),
  usersController.changeRole,
);

export default router;
