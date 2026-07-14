import { Request, Response, NextFunction } from 'express';
import { searchService } from './service';
import { successResponse } from '@/lib/envelope';
import { BadRequestError } from '@/lib/errors';

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q     = req.query.q     as string | undefined;
      const type  = req.query.type  as string | undefined;
      const page  = Math.max(1, parseInt(req.query.page  as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      if (!q || q.trim().length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const validTypes = ['clubs', 'events', 'projects', 'blogs'];
      if (type && !validTypes.includes(type)) {
        throw new BadRequestError('type must be one of: clubs, events, projects, blogs');
      }

      const result = await searchService.search({ q, type, page, limit });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },
};
