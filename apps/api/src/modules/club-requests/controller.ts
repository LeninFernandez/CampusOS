import { Request, Response, NextFunction } from 'express';
import { clubRequestsService } from './service';
import { successResponse } from '@/lib/envelope';
import { BadRequestError } from '@/lib/errors';
import { listStatusSchema } from './schemas';
import { RequestStatus } from '@prisma/client';

export const clubRequestsController = {
  async submitRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const callerId = req.user!.id;
      const result = await clubRequestsService.submitRequest(callerId, req.body);
      res.status(201).json(successResponse('Request submitted', result));
    } catch (err) {
      next(err);
    }
  },

  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      // Validate optional status filter
      const rawStatus = req.query.status as string | undefined;
      let status: RequestStatus | undefined;
      if (rawStatus !== undefined) {
        const parsed = listStatusSchema.safeParse(rawStatus);
        if (!parsed.success) {
          throw new BadRequestError('Invalid status value. Must be PENDING, APPROVED, or REJECTED');
        }
        status = parsed.data;
      }

      const result = await clubRequestsService.listRequests({ status, page, limit });
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const caller = req.user!;
      const result = await clubRequestsService.getRequest(
        id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
      );
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async approveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const callerId = req.user!.id;
      const result = await clubRequestsService.approveRequest(id, callerId, req.body);
      res.status(200).json(successResponse('Request approved', result));
    } catch (err) {
      next(err);
    }
  },

  async rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const callerId = req.user!.id;
      const result = await clubRequestsService.rejectRequest(id, callerId, req.body);
      res.status(200).json(successResponse('Request rejected', result));
    } catch (err) {
      next(err);
    }
  },

  async withdrawRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const callerId = req.user!.id;
      await clubRequestsService.withdrawRequest(id, callerId);
      res.status(200).json(successResponse('Request withdrawn', {}));
    } catch (err) {
      next(err);
    }
  },
};
