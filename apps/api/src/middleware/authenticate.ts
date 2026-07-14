import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError } from '@/lib/errors';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or invalid Authorization header'));
    }

    const token = authHeader.slice(7);

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        return next(new UnauthorizedError('Token expired'));
      }
      return next(new UnauthorizedError('Invalid token'));
    }

    // Always fetch fresh from DB — never trust JWT role claims
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, platformRole: true },
    });

    if (!user) {
      return next(new UnauthorizedError('User not found'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
