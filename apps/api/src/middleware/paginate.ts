import { Request, Response, NextFunction } from 'express';

/**
 * Normalises `page` and `limit` query params.
 * - page: integer ≥ 1, defaults to 1
 * - limit: integer 1–100, defaults to 20
 *
 * After this middleware req.query.page and req.query.limit are guaranteed
 * to be valid numeric strings that Number() can parse without NaN.
 */
export const paginate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const rawPage = parseInt(req.query.page as string, 10);
  const rawLimit = parseInt(req.query.limit as string, 10);

  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);

  // Overwrite with normalised values so every downstream handler reads
  // consistent numbers without re-parsing.
  req.query.page = String(page);
  req.query.limit = String(limit);

  next();
};
