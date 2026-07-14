import { Request, Response, NextFunction } from 'express';
import { eventsService } from './service';
import { successResponse } from '@/lib/envelope';

export const eventsController = {
  async requestEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventsService.requestEvent(req.params.id, req.user!.id, req.body);
      res.status(201).json(successResponse('Event requested', result));
    } catch (err) {
      next(err);
    }
  },

  async editEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventsService.editEvent(
        req.params.id,
        req.params.eventId,
        req.user!.id,
        req.body,
      );
      res.status(200).json(successResponse('Event updated', result));
    } catch (err) {
      next(err);
    }
  },

  async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await eventsService.listEvents({
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        clubId: req.query.clubId as string | undefined,
        page,
        limit,
        callerId: req.user?.id,
      });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventsService.getEvent(req.params.id);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async approveEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventsService.approveEvent(req.params.id, req.user!.id);
      res.status(200).json(successResponse('Event approved', result));
    } catch (err) {
      next(err);
    }
  },

  async rejectEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventsService.rejectEvent(req.params.id, req.user!.id, req.body);
      res.status(200).json(successResponse('Event rejected', result));
    } catch (err) {
      next(err);
    }
  },

  async registerForEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await eventsService.registerForEvent(req.params.id, req.user!.id);
      res.status(201).json(successResponse('Registered', result));
    } catch (err) {
      next(err);
    }
  },

  async unregisterFromEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await eventsService.unregisterFromEvent(req.params.id, req.user!.id);
      res.status(200).json(successResponse('Unregistered', {}));
    } catch (err) {
      next(err);
    }
  },

  async listRegistrants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const result = await eventsService.listRegistrants(req.params.id, req.user!.id, page, limit);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },
};
