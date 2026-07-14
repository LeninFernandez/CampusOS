import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '@/lib/errors';

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {};
        for (const issue of err.errors) {
          const field = issue.path.join('.');
          // Keep first error per field
          if (field && !errors[field]) {
            errors[field] = issue.message;
          }
        }
        return next(new BadRequestError('Validation failed', errors));
      }
      next(err);
    }
  };
};
