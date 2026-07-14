import { Router } from 'express';
import { projectsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { publishProjectSchema, updateProjectSchema } from './schemas';

// ── Routes under /clubs/:id (mergeParams exposes the club UUID as req.params.id) ──

export const clubProjectRoutes = Router({ mergeParams: true });

clubProjectRoutes.post(
  '/projects',
  authenticate,
  validate(publishProjectSchema),
  projectsController.publishProject,
);

// ── Routes under /projects ─────────────────────────────────────────────────────

export const projectRoutes = Router();

projectRoutes.get('/', projectsController.listProjects);

projectRoutes.get('/:id', projectsController.getProject);

projectRoutes.patch(
  '/:id',
  authenticate,
  validate(updateProjectSchema),
  projectsController.updateProject,
);

projectRoutes.delete('/:id', authenticate, projectsController.deleteProject);
