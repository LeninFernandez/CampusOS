import { Router } from 'express';
import { departmentsController } from './controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { createDepartmentSchema, setHeadSchema, addDeptMemberSchema } from './schemas';

// ── Routes mounted under /clubs/:id ──────────────────────────────────────────
// POST /clubs/:id/departments  — authenticated; Club Head auth enforced in service
// GET  /clubs/:id/departments  — public

export const clubDepartmentRoutes = Router({ mergeParams: true });

clubDepartmentRoutes.post(
  '/',
  authenticate,
  validate(createDepartmentSchema),
  departmentsController.createDepartment,
);

clubDepartmentRoutes.get('/', departmentsController.listDepartments);

// ── Routes mounted under /departments ────────────────────────────────────────
// GET    /departments/:id                 — authenticated; member/head/admin check in service
// PATCH  /departments/:id/head            — authenticated; Club Head auth enforced in service
// POST   /departments/:id/members         — authenticated; Club Head OR Dept Head check in service
// DELETE /departments/:id/members/:userId — authenticated; Club Head OR Dept Head check in service

export const departmentRoutes = Router();

departmentRoutes.get('/:id', authenticate, departmentsController.getDepartment);

departmentRoutes.patch(
  '/:id/head',
  authenticate,
  validate(setHeadSchema),
  departmentsController.setDepartmentHead,
);

departmentRoutes.post(
  '/:id/members',
  authenticate,
  validate(addDeptMemberSchema),
  departmentsController.addDepartmentMember,
);

departmentRoutes.delete(
  '/:id/members/:userId',
  authenticate,
  departmentsController.removeDepartmentMember,
);
