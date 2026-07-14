import { Router } from 'express';
import { announcementsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { postAnnouncementSchema } from './schemas';

const router = Router();

// POST /announcements — authenticated; role/scope auth handled in service
router.post('/', authenticate, validate(postAnnouncementSchema), announcementsController.postAnnouncement);

// GET /announcements — authenticated
router.get('/', authenticate, announcementsController.getAnnouncementFeed);

// GET /announcements/:id — authenticated
router.get('/:id', authenticate, announcementsController.getAnnouncement);

// DELETE /announcements/:id — authenticated; creator/Super Admin/Club Head auth in service
router.delete('/:id', authenticate, announcementsController.deleteAnnouncement);

export default router;
