import { Router } from 'express';

// Default-export routers
import authRouter from '@/modules/auth/routes';
import usersRouter from '@/modules/users/routes';
import clubRequestsRouter from '@/modules/club-requests/routes';
import clubsRouter from '@/modules/clubs/routes';
import announcementsRouter from '@/modules/announcements/routes';
import searchRouter from '@/modules/search/routes';

// Dual-export routers
import { clubDepartmentRoutes, departmentRoutes } from '@/modules/departments/routes';
import { clubEventRoutes, eventRoutes } from '@/modules/events/routes';
import { clubProjectRoutes, projectRoutes } from '@/modules/projects/routes';
import { clubBlogRoutes, blogRoutes } from '@/modules/blogs/routes';

const router = Router();

// Auth
router.use('/auth', authRouter);

// Users
router.use('/users', usersRouter);

// Club Requests
router.use('/club-requests', clubRequestsRouter);

// Clubs — nested sub-routers FIRST, then the top-level clubs router
router.use('/clubs/:id/departments', clubDepartmentRoutes);
router.use('/clubs/:id/events', clubEventRoutes);
router.use('/clubs/:id/projects', clubProjectRoutes);
router.use('/clubs/:id/blogs', clubBlogRoutes);
router.use('/clubs', clubsRouter);

// Standalone resource routers
router.use('/departments', departmentRoutes);
router.use('/events', eventRoutes);
router.use('/projects', projectRoutes);
router.use('/blogs', blogRoutes);

// Announcements
router.use('/announcements', announcementsRouter);

// Search
router.use('/search', searchRouter);

export default router;
