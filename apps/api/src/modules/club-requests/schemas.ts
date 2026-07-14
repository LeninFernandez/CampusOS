import { z } from 'zod';
import { RequestStatus } from '@prisma/client';

export const submitRequestSchema = z.object({
  clubName: z
    .string({ required_error: 'Club name is required' })
    .min(1, 'Club name is required')
    .max(100, 'Club name must be at most 100 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(1, 'Description is required'),
  facultyDetails: z
    .string({ required_error: 'Faculty details are required' })
    .min(1, 'Faculty details are required'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .min(1, 'Reason is required'),
});

export const approveRequestSchema = z.object({
  facultyCoordinatorId: z
    .string({ required_error: 'Faculty coordinator ID is required' })
    .uuid('Faculty coordinator ID must be a valid UUID'),
});

export const rejectRequestSchema = z.object({
  reason: z.string().optional(),
});

// Optional status filter for list endpoint — validated in controller, not via body schema
export const listStatusSchema = z.nativeEnum(RequestStatus).optional();

export type SubmitRequestInput = z.infer<typeof submitRequestSchema>;
export type ApproveRequestInput = z.infer<typeof approveRequestSchema>;
export type RejectRequestInput = z.infer<typeof rejectRequestSchema>;
