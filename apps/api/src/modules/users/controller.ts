import { Request, Response, NextFunction } from 'express';
import { usersService } from './service';
import { successResponse } from '@/lib/envelope';
import { ForbiddenError } from '@/lib/errors';

export const usersController = {
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const callerIsSuperAdmin = req.user!.platformRole === 'SUPER_ADMIN';

      const result = await usersService.searchUsers({ search, page, limit, callerIsSuperAdmin });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const caller = req.user!;

      // Only self or Super Admin may view a user profile
      if (caller.id !== id && caller.platformRole !== 'SUPER_ADMIN') {
        throw new ForbiddenError('You can only view your own profile');
      }

      const user = await usersService.getUser(id);
      res.status(200).json(successResponse('OK', user));
    } catch (err) {
      next(err);
    }
  },

  async changeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { platformRole } = req.body;

      const updated = await usersService.changeRole(id, platformRole);
      res.status(200).json(successResponse('Role updated', updated));
    } catch (err) {
      next(err);
    }
  },
};
