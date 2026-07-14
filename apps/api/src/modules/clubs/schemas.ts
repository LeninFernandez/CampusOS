import { z } from 'zod';

// Validated URL helper — must start with http:// or https://
const urlSchema = z.string().regex(/^https?:\/\//, 'URL must start with http:// or https://');

// socialLinks: only the four allowed keys; each value must be a valid URL
const socialLinksSchema = z
  .object({
    instagram: urlSchema.optional(),
    linkedin: urlSchema.optional(),
    github: urlSchema.optional(),
    website: urlSchema.optional(),
  })
  .optional();

export const createClubSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(1, 'Description is required'),
  facultyDetails: z
    .string({ required_error: 'Faculty details are required' })
    .min(1, 'Faculty details are required'),
  facultyCoordinatorId: z
    .string()
    .uuid('facultyCoordinatorId must be a valid UUID')
    .optional(),
  clubHeadUserId: z
    .string({ required_error: 'Club head user ID is required' })
    .uuid('clubHeadUserId must be a valid UUID'),
  socialLinks: socialLinksSchema,
  logoUrl: urlSchema.optional(),
});

export const updateClubSchema = z.object({
  description: z.string().min(1).optional(),
  facultyDetails: z.string().min(1).optional(),
  socialLinks: socialLinksSchema,
  logoUrl: urlSchema.nullable().optional(),
});

export const reassignCoordinatorSchema = z.object({
  facultyCoordinatorId: z
    .string({ required_error: 'facultyCoordinatorId is required' })
    .uuid('facultyCoordinatorId must be a valid UUID'),
});

export const addMemberSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
});

export const demoteRoleSchema = z.object({
  role: z.literal('MEMBER', { errorMap: () => ({ message: 'role must be MEMBER' }) }),
});

export const transferHeadSchema = z.object({
  newClubHeadUserId: z
    .string({ required_error: 'newClubHeadUserId is required' })
    .uuid('newClubHeadUserId must be a valid UUID'),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type UpdateClubInput = z.infer<typeof updateClubSchema>;
export type ReassignCoordinatorInput = z.infer<typeof reassignCoordinatorSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type TransferHeadInput = z.infer<typeof transferHeadSchema>;
