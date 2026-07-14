import { z } from 'zod';

export const postAnnouncementSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(1).max(200),
  content: z.string({ required_error: 'Content is required' }).min(1),
  visibility: z.enum(['GLOBAL', 'CLUB', 'DEPARTMENT'], { required_error: 'visibility is required' }),
  clubId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

export type PostAnnouncementInput = z.infer<typeof postAnnouncementSchema>;
