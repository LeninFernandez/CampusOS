import { z } from 'zod';

// Validated URL helper — must start with http:// or https://
const urlSchema = z.string().regex(/^https?:\/\//, 'URL must start with http:// or https://');

export const publishBlogSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  content: z
    .string({ required_error: 'Content is required' })
    .min(1, 'Content is required'),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: urlSchema.optional(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').optional(),
});

export const updateBlogSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: urlSchema.nullable().optional(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').nullable().optional(),
});

export type PublishBlogInput = z.infer<typeof publishBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;
