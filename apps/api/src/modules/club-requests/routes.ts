import { Router } from 'express';
import { clubRequestsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { submitRequestSchema, approveRequestSchema, rejectRequestSchema } from './schemas';

const router = Router();

// POST /club-requests — any authenticated user
router.post(
  '/',
  authenticate,
  validate(submitRequestSchema),
  clubRequestsController.submitRequest,
);

// GET /club-requests — Super Admin only
router.get(
  '/',
  authenticate,
  authorize(['SUPER_ADMIN']),
  clubRequestsController.listRequests,
);

// GET /club-requests/:id — Super Admin or requester (ownership checked in service)
router.get(
  '/:id',
  authenticate,
  clubRequestsController.getRequest,
);

// PATCH /club-requests/:id/approve — Super Admin only
router.patch(
  '/:id/approve',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(approveRequestSchema),
  clubRequestsController.approveRequest,
);

// PATCH /club-requests/:id/reject — Super Admin only
router.patch(
  '/:id/reject',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(rejectRequestSchema),
  clubRequestsController.rejectRequest,
);

// DELETE /club-requests/:id — requester only, PENDING only (ownership checked in service)
router.delete(
  '/:id',
  authenticate,
  clubRequestsController.withdrawRequest,
);

export default router;
