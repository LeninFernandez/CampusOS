import { Request, Response, NextFunction } from 'express';
import { authService } from './service';
import { successResponse } from '@/lib/envelope';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(successResponse('Registration successful', result));
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(successResponse('Login successful', result));
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.user is guaranteed by authenticate middleware
      const userId = req.user!.id;
      const result = await authService.getCurrentUser(userId);
      res.status(200).json(successResponse('OK', result));
    } catch (err) {
      next(err);
    }
  },
};
