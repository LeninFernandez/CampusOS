import { Request, Response, NextFunction } from 'express';
import { announcementsService } from './service';
import { successResponse } from '@/lib/envelope';

export const announcementsController = {
  async postAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await announcementsService.postAnnouncement(
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
        req.body,
      );
      res.status(201).json(successResponse('Announcement posted', result));
    } catch (err) {
      next(err);
    }
  },

  async getAnnouncementFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await announcementsService.getAnnouncementFeed(req.user!.id, page, limit);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await announcementsService.getAnnouncement(req.params.id, req.user!.id);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      await announcementsService.deleteAnnouncement(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
      );
      res.status(200).json(successResponse('Announcement deleted', {}));
    } catch (err) {
      next(err);
    }
  },
};
