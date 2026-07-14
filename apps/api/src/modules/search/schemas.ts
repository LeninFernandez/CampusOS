import { z } from 'zod';

export const searchSchema = z.object({
  q: z
    .string({ required_error: 'Search query is required' })
    .min(2, 'Search query must be at least 2 characters'),
  type: z.enum(['clubs', 'events', 'projects', 'blogs']).optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;
