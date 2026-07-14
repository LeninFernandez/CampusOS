import { z } from 'zod';
import { PlatformRole } from '@prisma/client';

export const changeRoleSchema = z.object({
  platformRole: z.nativeEnum(PlatformRole, {
    errorMap: () => ({ message: 'platformRole must be SUPER_ADMIN, FACULTY_COORDINATOR, or STUDENT' }),
  }),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
