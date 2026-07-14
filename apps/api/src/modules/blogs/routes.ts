import { Router } from 'express';
import { blogsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { publishBlogSchema, updateBlogSchema } from './schemas';

// ── Routes under /clubs/:id (mergeParams exposes the club UUID as req.params.id) ──

export const clubBlogRoutes = Router({ mergeParams: true });

clubBlogRoutes.post(
  '/blogs',
  authenticate,
  validate(publishBlogSchema),
  blogsController.publishBlog,
);

// ── Routes under /blogs ────────────────────────────────────────────────────────

export const blogRoutes = Router();

blogRoutes.get('/', blogsController.listBlogs);

blogRoutes.get('/:id', blogsController.getBlog);

blogRoutes.patch(
  '/:id',
  authenticate,
  validate(updateBlogSchema),
  blogsController.updateBlog,
);

blogRoutes.delete('/:id', authenticate, blogsController.deleteBlog);
