import { Router } from 'express';
import { searchController } from './controller';

const router = Router();

// GET /search — public, no auth required
router.get('/', searchController.search);

export default router;
