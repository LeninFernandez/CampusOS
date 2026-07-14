import { Router } from 'express';
import { clubsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { authorizeClubRole } from '@/middleware/authorizeClubRole';
import { validate } from '@/middleware/validate';
import {
  createClubSchema,
  updateClubSchema,
  reassignCoordinatorSchema,
  addMemberSchema,
  demoteRoleSchema,
  transferHeadSchema,
} from './schemas';

const router = Router();

// POST /clubs — Super Admin only
router.post(
  '/',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(createClubSchema),
  clubsController.createClub,
);

// GET /clubs — public
router.get('/', clubsController.listClubs);

// GET /clubs/:id — public
router.get('/:id', clubsController.getClub);

// PATCH /clubs/:id — authenticated; Club Head or Super Admin (authorization handled in service)
router.patch(
  '/:id',
  authenticate,
  validate(updateClubSchema),
  clubsController.updateClub,
);

// PATCH /clubs/:id/faculty-coordinator — Super Admin only
router.patch(
  '/:id/faculty-coordinator',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(reassignCoordinatorSchema),
  clubsController.reassignCoordinator,
);

// GET /clubs/:id/members — authenticated; club member or Super Admin (authorization handled in service)
router.get('/:id/members', authenticate, clubsController.listMembers);

// POST /clubs/:id/members — Club Head only (authorizeClubRole handles Super Admin bypass)
router.post(
  '/:id/members',
  authenticate,
  authorizeClubRole({ allowedRoles: ['CLUB_HEAD'] }),
  validate(addMemberSchema),
  clubsController.addMember,
);

// DELETE /clubs/:id/members/:userId — Club Head or self (authorization handled in service)
router.delete('/:id/members/:userId', authenticate, clubsController.removeMember);

// PATCH /clubs/:id/members/:userId/role — Club Head only; role must be MEMBER
router.patch(
  '/:id/members/:userId/role',
  authenticate,
  authorizeClubRole({ allowedRoles: ['CLUB_HEAD'] }),
  validate(demoteRoleSchema),
  clubsController.demoteToMember,
);

// POST /clubs/:id/transfer-head — Super Admin only
router.post(
  '/:id/transfer-head',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(transferHeadSchema),
  clubsController.transferHead,
);

export default router;
