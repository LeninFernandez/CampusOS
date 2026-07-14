import { Request, Response, NextFunction } from 'express';
import { departmentsService } from './service';
import { successResponse } from '@/lib/envelope';

export const departmentsController = {
  async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await departmentsService.createDepartment(
        req.params.id,
        req.user!.id,
        req.body,
      );
      res.status(201).json(successResponse('Department created', result));
    } catch (err) {
      next(err);
    }
  },

  async listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await departmentsService.listDepartments(req.params.id);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async getDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const caller = req.user!;
      const result = await departmentsService.getDepartment(
        req.params.id,
        caller.id,
        caller.platformRole === 'SUPER_ADMIN',
      );
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },

  async setDepartmentHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await departmentsService.setDepartmentHead(
        req.params.id,
        req.user!.id,
        req.body,
      );
      res.status(200).json(successResponse('Department head updated', result));
    } catch (err) {
      next(err);
    }
  },

  async addDepartmentMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await departmentsService.addDepartmentMember(
        req.params.id,
        req.user!.id,
        req.body,
      );
      res.status(201).json(successResponse('Member added to department', result));
    } catch (err) {
      next(err);
    }
  },

  async removeDepartmentMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await departmentsService.removeDepartmentMember(
        req.params.id,
        req.params.userId,
        req.user!.id,
      );
      res.status(200).json(successResponse('Member removed from department', {}));
    } catch (err) {
      next(err);
    }
  },
};
