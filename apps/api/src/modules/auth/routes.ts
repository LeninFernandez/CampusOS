import { Router } from 'express';
import { authController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { registerSchema, loginSchema } from './schemas';

const router = Router();

// POST /auth/register — public
router.post('/register', validate(registerSchema), authController.register);

// POST /auth/login — public
router.post('/login', validate(loginSchema), authController.login);

// GET /auth/me — authenticated
router.get('/me', authenticate, authController.me);

export default router;
