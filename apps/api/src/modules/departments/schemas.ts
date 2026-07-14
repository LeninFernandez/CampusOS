import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
});

export const setHeadSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID').nullable(),
});

export const addDeptMemberSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type SetHeadInput = z.infer<typeof setHeadSchema>;
export type AddDeptMemberInput = z.infer<typeof addDeptMemberSchema>;
