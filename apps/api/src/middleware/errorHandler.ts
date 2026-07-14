import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '@/lib/errors';
import { errorResponse } from '@/lib/envelope';
import { config } from '@/config';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // Four-argument signature is required by Express to recognise this as an
  // error handler — do not remove _next even though it is unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // Logging
  if (config.nodeEnv === 'development') {
    console.error(err);
  } else if (err instanceof Error) {
    console.error(`[${err.name}] ${err.message}`);
  }

  // ── Custom domain errors ─────────────────────────────────────────────────

  if (err instanceof UnauthorizedError) {
    res.status(401).json(errorResponse(err.message));
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json(errorResponse(err.message));
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json(errorResponse(err.message));
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json(errorResponse(err.message));
    return;
  }

  if (err instanceof BadRequestError) {
    res.status(400).json(errorResponse(err.message, err.errors));
    return;
  }

  // ── Prisma known request errors ──────────────────────────────────────────

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        res.status(409).json(errorResponse('A record with this value already exists'));
        return;
      case 'P2025': // Record required for operation not found
        res.status(404).json(errorResponse('Record not found'));
        return;
      case 'P2003': // Foreign key constraint failure
        res.status(400).json(errorResponse('Referenced record does not exist'));
        return;
    }
  }

  // ── Fallback 500 ─────────────────────────────────────────────────────────

  const message =
    config.nodeEnv === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  res.status(500).json(errorResponse(message));
};
