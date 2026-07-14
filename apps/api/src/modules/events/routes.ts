import { Router, Request, Response, NextFunction } from 'express';
import { eventsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { createEventSchema, editEventSchema, rejectEventSchema } from './schemas';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// ── Optional auth — sets req.user if a valid token is present; never errors ──

async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.slice(7));
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, platformRole: true },
      });
      if (user) req.user = user;
    } catch {
      // Expired or invalid token — treat as anonymous
    }
  }
  next();
}

// ── Routes under /clubs/:id (mergeParams exposes the club UUID as req.params.id) ──

export const clubEventRoutes = Router({ mergeParams: true });

clubEventRoutes.post(
  '/events',
  authenticate,
  validate(createEventSchema),
  eventsController.requestEvent,
);

clubEventRoutes.patch(
  '/events/:eventId',
  authenticate,
  validate(editEventSchema),
  eventsController.editEvent,
);

// ── Routes under /events ───────────────────────────────────────────────────────

export const eventRoutes = Router();

eventRoutes.get('/', optionalAuthenticate, eventsController.listEvents);

eventRoutes.get('/:id', eventsController.getEvent);

eventRoutes.patch('/:id/approve', authenticate, eventsController.approveEvent);

eventRoutes.patch(
  '/:id/reject',
  authenticate,
  validate(rejectEventSchema),
  eventsController.rejectEvent,
);

eventRoutes.post('/:id/register', authenticate, eventsController.registerForEvent);

eventRoutes.delete('/:id/register', authenticate, eventsController.unregisterFromEvent);

eventRoutes.get('/:id/registrations', authenticate, eventsController.listRegistrants);
