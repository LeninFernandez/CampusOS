import { z } from 'zod';

const isoDateString = z.string().datetime({ message: 'Must be a valid ISO 8601 date-time string' });

export const createEventSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(1, 'Title is required').max(200),
  description: z.string({ required_error: 'Description is required' }).min(1, 'Description is required'),
  location: z.string({ required_error: 'Location is required' }).min(1, 'Location is required').max(200),
  type: z.enum(['PUBLIC', 'CLUB_EXCLUSIVE'], {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be PUBLIC or CLUB_EXCLUSIVE',
  }),
  capacity: z.number().int().positive('Capacity must be greater than 0').nullable().optional(),
  startTime: isoDateString,
  endTime: isoDateString,
});

export const editEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  location: z.string().min(1).max(200).optional(),
  type: z.enum(['PUBLIC', 'CLUB_EXCLUSIVE']).optional(),
  capacity: z.number().int().positive('Capacity must be greater than 0').nullable().optional(),
  startTime: isoDateString.optional(),
  endTime: isoDateString.optional(),
});

export const rejectEventSchema = z.object({
  reason: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EditEventInput = z.infer<typeof editEventSchema>;
export type RejectEventInput = z.infer<typeof rejectEventSchema>;
