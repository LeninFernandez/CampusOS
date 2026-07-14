import { z } from 'zod';

// Validated URL helper — must start with http:// or https://
const urlSchema = z.string().regex(/^https?:\/\//, 'URL must start with http:// or https://');

export const publishProjectSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(1, 'Description is required'),
  techStack: z.array(z.string()).optional(),
  githubLink: urlSchema.optional(),
  demoLink: urlSchema.optional(),
  thumbnailUrl: urlSchema.optional(),
  contributors: z.array(z.string()).optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  techStack: z.array(z.string()).optional(),
  githubLink: urlSchema.nullable().optional(),
  demoLink: urlSchema.nullable().optional(),
  thumbnailUrl: urlSchema.nullable().optional(),
  contributors: z.array(z.string()).optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').nullable().optional(),
});

export type PublishProjectInput = z.infer<typeof publishProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
