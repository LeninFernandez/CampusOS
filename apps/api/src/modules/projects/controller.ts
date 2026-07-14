import { Request, Response, NextFunction } from 'express';
import { projectsService } from './service';
import { successResponse } from '@/lib/envelope';

export const projectsController = {
  async publishProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await projectsService.publishProject(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
        req.body,
      );
      res.status(201).json(successResponse('Project published', result));
    } catch (err) {
      next(err);
    }
  },

  async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const clubId = req.query.clubId as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await projectsService.listProjects({ search, clubId, page, limit });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await projectsService.getProject(req.params.id);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await projectsService.updateProject(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
        req.body,
      );
      res.status(200).json(successResponse('Project updated', result));
    } catch (err) {
      next(err);
    }
  },

  async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      await projectsService.deleteProject(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
      );
      res.status(200).json(successResponse('Project deleted', {}));
    } catch (err) {
      next(err);
    }
  },
};
