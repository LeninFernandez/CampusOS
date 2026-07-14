import jwt from 'jsonwebtoken';
import { config } from '@/config';

export interface JwtPayload {
  userId: string;
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  // Throws TokenExpiredError or JsonWebTokenError on failure.
  // Callers handle these by name — do not catch here.
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};
