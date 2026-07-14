import { Request, Response, NextFunction } from 'express';
import { clubsService } from './service';
import { successResponse } from '@/lib/envelope';

export const clubsController = {
  async createClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.createClub(req.body);
      res.status(201).json(successResponse('Club created', result));
    } catch (err) {
      next(err);
    }
  },

  async listClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await clubsService.listClubs({ search, page, limit });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getClub(req.params.id);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async updateClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await clubsService.updateClub(
        req.params.id,
        caller.platformRole === 'SUPER_ADMIN',
        caller.id,
        req.body,
      );
      res.status(200).json(successResponse('Club updated', result));
    } catch (err) {
      next(err);
    }
  },

  async reassignCoordinator(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.reassignCoordinator(req.params.id, req.body);
      res.status(200).json(successResponse('Faculty Coordinator updated', result));
    } catch (err) {
      next(err);
    }
  },

  async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await clubsService.listMembers({
        clubId: req.params.id,
        callerId: caller.id,
        callerIsSuperAdmin: caller.platformRole === 'SUPER_ADMIN',
        page,
        limit,
      });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.addMember(req.params.id, req.user!.id, req.body);
      res.status(201).json(successResponse('Member added', result));
    } catch (err) {
      next(err);
    }
  },

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.removeMember(req.params.id, req.params.userId, req.user!.id);
      res.status(200).json(successResponse('Member removed', {}));
    } catch (err) {
      next(err);
    }
  },

  async demoteToMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.demoteToMember(
        req.params.id,
        req.params.userId,
        req.user!.id,
      );
      res.status(200).json(successResponse('Role updated', result));
    } catch (err) {
      next(err);
    }
  },

  async transferHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.transferHead(req.params.id, req.body);
      res.status(200).json(successResponse('Club Head transferred', result));
    } catch (err) {
      next(err);
    }
  },
};
