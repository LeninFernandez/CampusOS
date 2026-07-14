import { Request, Response, NextFunction } from 'express';
import { blogsService } from './service';
import { successResponse } from '@/lib/envelope';

export const blogsController = {
  async publishBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await blogsService.publishBlog(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
        req.body,
      );
      res.status(201).json(successResponse('Blog published', result));
    } catch (err) {
      next(err);
    }
  },

  async listBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const clubId = req.query.clubId as string | undefined;
      const tag = req.query.tag as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await blogsService.listBlogs({ search, clubId, tag, page, limit });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await blogsService.getBlog(req.params.id);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async updateBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await blogsService.updateBlog(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
        req.body,
      );
      res.status(200).json(successResponse('Blog updated', result));
    } catch (err) {
      next(err);
    }
  },

  async deleteBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      await blogsService.deleteBlog(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
      );
      res.status(200).json(successResponse('Blog deleted', {}));
    } catch (err) {
      next(err);
    }
  },
};
