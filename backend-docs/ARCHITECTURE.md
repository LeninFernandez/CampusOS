# Backend Architecture

## Introduction

This document defines the CampusOS backend architecture, including system structure, layer responsibilities, module organization, and design patterns. The architecture follows a **modular monolith** approach with clean separation of concerns, enabling MVP delivery speed while maintaining extensibility for future growth.

**Architecture Goals:**
- Clear separation between routing, business logic, and data access
- Module independence for parallel development
- Reusable middleware and utilities across all modules
- Type-safe database access via Prisma ORM
- Consistent error handling and response formatting
- Easy onboarding for new developers

---

## Architecture Style

### Modular Monolith

**Pattern:** Single codebase with well-defined module boundaries

**Why Chosen:**
- **MVP Speed:** Single deployment artifact, simpler CI/CD
- **Shared Database:** No distributed transaction complexity
- **Development Velocity:** Easier debugging, testing, and local development
- **Operational Simplicity:** No service discovery, API gateways, or distributed tracing
- **Future-Ready:** Clear module boundaries enable extraction to microservices if needed

**Constraints:**
- No inter-module service layer dependencies
- Modules communicate only through database and shared utilities
- Each module is self-contained with its own routes, controllers, and services

---

## Three-Layer Architecture

CampusOS backend follows a strict three-layer pattern:

```
┌─────────────────────────────────────┐
│         Routes Layer                │  HTTP verb/path mapping
│  (routes.ts)                        │  Middleware application
└─────────────┬───────────────────────┘  Request/response coordination
              │
              ▼
┌─────────────────────────────────────┐
│       Controllers Layer             │  Request parsing
│  (controller.ts)                    │  Service orchestration
└─────────────┬───────────────────────┘  Response envelope formatting
              │
              ▼
┌─────────────────────────────────────┐
│        Services Layer               │  Business logic
│  (service.ts)                       │  Database transactions
└─────────────────────────────────────┘  Domain rule enforcement
```


### Layer 1: Routes Layer

**File:** `modules/{feature}/routes.ts`

**Responsibilities:**
1. **HTTP Verb/Path Mapping:** Define Express routes (GET, POST, PATCH, DELETE)
2. **Middleware Application:** Apply authentication, authorization, validation middleware
3. **Request/Response Flow Coordination:** Wire controllers to HTTP endpoints

**Rules:**
- ❌ **Never** put business logic in routes
- ❌ **Never** access database directly from routes
- ✅ **Always** apply middleware in correct order: authenticate → authorize → validate
- ✅ **Always** delegate to controllers for request handling

**Example Structure:**
```typescript
// modules/clubs/routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { clubController } from './controller';
import { createClubSchema } from './schemas';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(['SUPER_ADMIN']),
  validate(createClubSchema),
  clubController.createClub
);

router.get('/', clubController.listClubs); // Public route

router.get('/:id', clubController.getClub); // Public route

router.patch(
  '/:id',
  authenticate,
  // Custom authorization: Club Head of this club OR Super Admin
  clubController.updateClub
);

export default router;
```

**Middleware Order:**
1. `authenticate` - Verify JWT, attach user to req
2. `authorize` - Check platform role or custom logic
3. `validate` - Validate request body/params/query
4. Controller function - Handle business logic

---

### Layer 2: Controllers Layer

**File:** `modules/{feature}/controller.ts`

**Responsibilities:**
1. **Request Parsing:** Extract data from req.body, req.params, req.query, req.user
2. **Service Orchestration:** Call service layer methods with parsed data
3. **Response Envelope Formatting:** Wrap results in standard success/failure envelopes

**Rules:**
- ❌ **Never** put business logic in controllers
- ❌ **Never** access database directly from controllers
- ✅ **Always** delegate to service layer for business operations
- ✅ **Always** use standard response envelopes
- ✅ **Always** handle errors via try-catch and pass to error handler


**Example Structure:**
```typescript
// modules/clubs/controller.ts
import { Request, Response, NextFunction } from 'express';
import { clubService } from './service';
import { successResponse, errorResponse } from '@/lib/envelope';

export const clubController = {
  async createClub(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const club = await clubService.createClub(data);
      
      return res.status(201).json(successResponse('Club created', club));
    } catch (error) {
      next(error); // Pass to centralized error handler
    }
  },

  async listClubs(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page = 1, limit = 20 } = req.query;
      const result = await clubService.listClubs({
        search: search as string,
        page: Number(page),
        limit: Number(limit)
      });
      
      return res.status(200).json(successResponse('OK', result));
    } catch (error) {
      next(error);
    }
  },

  async updateClub(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;
      const userId = req.user.id; // From authenticate middleware
      
      // Authorization check in controller when logic is endpoint-specific
      const isAuthorized = await clubService.canUpdateClub(id, userId);
      if (!isAuthorized) {
        throw new ForbiddenError('Not authorized to update this club');
      }
      
      const club = await clubService.updateClub(id, data);
      return res.status(200).json(successResponse('Club updated', club));
    } catch (error) {
      next(error);
    }
  }
};
```

**Key Patterns:**
- Async/await for all service calls
- Try-catch blocks delegate errors to centralized handler
- Extract query params with defaults for pagination
- Perform endpoint-specific authorization in controller when needed
- Always return standard response envelopes

---

### Layer 3: Services Layer

**File:** `modules/{feature}/service.ts`

**Responsibilities:**
1. **Business Logic:** Implement domain rules and workflows
2. **Database Transactions:** Execute Prisma queries and manage transactions
3. **Domain Rule Enforcement:** Validate constraints (e.g., "cannot remove sole Club Head")

**Rules:**
- ✅ **This is where business logic belongs**
- ✅ **All database access happens here** (via Prisma)
- ✅ **Enforce business rules before database operations**
- ✅ **Use transactions for multi-step operations**
- ✅ **Throw domain-specific errors** (NotFoundError, ConflictError, etc.)
- ❌ **Never** import service functions from other modules
- ❌ **Never** access req/res objects directly


**Example Structure:**
```typescript
// modules/clubs/service.ts
import { prisma } from '@/lib/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '@/lib/errors';

export const clubService = {
  async createClub(data: CreateClubInput) {
    // Business rule: Check duplicate club name (case-insensitive)
    const existing = await prisma.club.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } }
    });
    if (existing) {
      throw new ConflictError('Club name already exists');
    }

    // Business rule: Check faculty coordinator not already assigned
    if (data.facultyCoordinatorId) {
      const coordinator = await prisma.club.findUnique({
        where: { faculty_coordinator_id: data.facultyCoordinatorId }
      });
      if (coordinator) {
        throw new ConflictError('Faculty Coordinator already assigned to another club');
      }
    }

    // Transaction: Create club + create Club Head membership
    const club = await prisma.$transaction(async (tx) => {
      const newClub = await tx.club.create({ data: { ...data, status: 'ACTIVE' } });
      
      await tx.clubMembership.create({
        data: {
          user_id: data.clubHeadUserId,
          club_id: newClub.id,
          role: 'CLUB_HEAD'
        }
      });
      
      return newClub;
    });

    return club;
  },

  async listClubs(params: { search?: string; page: number; limit: number }) {
    const where = params.search
      ? { name: { contains: params.search, mode: 'insensitive' } }
      : {};

    const [items, total] = await Promise.all([
      prisma.club.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { created_at: 'desc' }
      }),
      prisma.club.count({ where })
    ]);

    return {
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    };
  },

  async removeMember(clubId: string, userId: string) {
    const membership = await prisma.clubMembership.findUnique({
      where: { user_id_club_id: { user_id: userId, club_id: clubId } }
    });

    if (!membership) {
      throw new NotFoundError('User is not a member of this club');
    }

    // Business rule: Cannot remove sole Club Head
    if (membership.role === 'CLUB_HEAD') {
      const clubHeadCount = await prisma.clubMembership.count({
        where: { club_id: clubId, role: 'CLUB_HEAD' }
      });

      if (clubHeadCount === 1) {
        throw new BadRequestError('Cannot remove sole Club Head');
      }
    }

    // Cascade: Removing club membership cascades to department memberships
    await prisma.clubMembership.delete({
      where: { id: membership.id }
    });
  },

  async canUpdateClub(clubId: string, userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.platform_role === 'SUPER_ADMIN') return true;

    const membership = await prisma.clubMembership.findFirst({
      where: { user_id: userId, club_id: clubId, role: 'CLUB_HEAD' }
    });

    return !!membership;
  }
};
```

**Key Patterns:**
- Always check business rules before database operations
- Use Prisma transactions for multi-step operations
- Throw specific error types (NotFoundError, ConflictError, etc.)
- Return plain data objects (no Express req/res)
- Use Prisma's type-safe query builder


---

## Directory Structure

```
src/
├── modules/                    # Feature modules (10 total)
│   ├── auth/
│   │   ├── routes.ts          # Express routes for /auth/*
│   │   ├── controller.ts      # Request handlers
│   │   ├── service.ts         # Business logic + database access
│   │   └── schemas.ts         # Request validation schemas
│   ├── users/
│   ├── club-requests/
│   ├── clubs/
│   ├── departments/
│   ├── events/
│   ├── projects/
│   ├── blogs/
│   ├── announcements/
│   └── search/
│
├── middleware/                 # Reusable middleware
│   ├── authenticate.ts        # JWT verification + user attachment
│   ├── authorize.ts           # Platform role checks
│   ├── authorizeClubRole.ts   # Club-scoped role checks
│   ├── validate.ts            # Request validation
│   ├── paginate.ts            # Pagination helper
│   └── errorHandler.ts        # Centralized error handler
│
├── lib/                       # Shared utilities
│   ├── prisma.ts             # Prisma client singleton
│   ├── jwt.ts                # JWT sign/verify utilities
│   ├── password.ts           # bcrypt hash/compare utilities
│   ├── envelope.ts           # Response envelope helpers
│   └── errors.ts             # Custom error classes
│
├── routes/
│   └── v1/
│       └── index.ts          # Main router aggregating all modules
│
├── config/
│   └── index.ts              # Environment variables
│
├── types/
│   └── express.d.ts          # Express type extensions (req.user)
│
├── app.ts                    # Express app setup
└── server.ts                 # HTTP server entry point
```

---

## Module Organization

### Module Structure

Each module follows the same pattern:

```
modules/{feature}/
├── routes.ts       # Express Router with middleware
├── controller.ts   # Request handlers
├── service.ts      # Business logic + database access
└── schemas.ts      # Validation schemas (zod, joi, etc.)
```

**Why This Structure:**
- **Consistency:** Same pattern across all 10 modules
- **Discoverability:** Developers know exactly where to find code
- **Testability:** Services can be tested without HTTP layer
- **Parallel Development:** Teams can work on different modules independently

### Module Registration

**Main Router (`routes/v1/index.ts`):**
```typescript
import { Router } from 'express';
import authRoutes from '@/modules/auth/routes';
import userRoutes from '@/modules/users/routes';
import clubRequestRoutes from '@/modules/club-requests/routes';
import clubRoutes from '@/modules/clubs/routes';
import departmentRoutes from '@/modules/departments/routes';
import eventRoutes from '@/modules/events/routes';
import projectRoutes from '@/modules/projects/routes';
import blogRoutes from '@/modules/blogs/routes';
import announcementRoutes from '@/modules/announcements/routes';
import searchRoutes from '@/modules/search/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/club-requests', clubRequestRoutes);
router.use('/clubs', clubRoutes);
router.use('/departments', departmentRoutes);
router.use('/events', eventRoutes);
router.use('/projects', projectRoutes);
router.use('/blogs', blogRoutes);
router.use('/announcements', announcementRoutes);
router.use('/search', searchRoutes);

export default router;
```

**Adding New Module:**
1. Create `modules/new-feature/` directory
2. Add routes.ts, controller.ts, service.ts
3. Register in main router
4. No changes needed to existing modules


---

## Middleware Architecture

### authenticate

**File:** `middleware/authenticate.ts`

**Purpose:** Verify JWT and attach user to request

**Implementation:**
```typescript
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError } from '@/lib/errors';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid token');
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Always fetch user fresh from database (don't trust JWT claims for roles)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, platform_role: true }
    });
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    req.user = user; // Attach to request
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};
```

**Usage:**
```typescript
router.get('/protected', authenticate, controller.handler);
```

---

### authorize

**File:** `middleware/authorize.ts`

**Purpose:** Check platform-level role requirements

**Implementation:**
```typescript
import { ForbiddenError } from '@/lib/errors';

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    
    if (!allowedRoles.includes(req.user.platform_role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};
```

**Usage:**
```typescript
router.post('/clubs', authenticate, authorize(['SUPER_ADMIN']), controller.createClub);
router.get('/users', authenticate, authorize(['SUPER_ADMIN', 'FACULTY_COORDINATOR', 'CLUB_HEAD']), controller.listUsers);
```


---

### authorizeClubRole

**File:** `middleware/authorizeClubRole.ts`

**Purpose:** Check club-scoped role requirements (Club Head, Department Head)

**Implementation:**
```typescript
import { prisma } from '@/lib/prisma';
import { ForbiddenError } from '@/lib/errors';

export const authorizeClubRole = (options: {
  clubIdParam: string; // e.g., 'id' or 'clubId'
  allowedRoles: ('CLUB_HEAD' | 'DEPARTMENT_HEAD')[];
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }
      
      const clubId = req.params[options.clubIdParam];
      
      // Check Club Head
      if (options.allowedRoles.includes('CLUB_HEAD')) {
        const membership = await prisma.clubMembership.findFirst({
          where: {
            user_id: req.user.id,
            club_id: clubId,
            role: 'CLUB_HEAD'
          }
        });
        
        if (membership) {
          return next();
        }
      }
      
      // Check Department Head (derived from department's head_user_id)
      if (options.allowedRoles.includes('DEPARTMENT_HEAD')) {
        const isDeptHead = await prisma.department.findFirst({
          where: {
            club_id: clubId,
            head_user_id: req.user.id
          }
        });
        
        if (isDeptHead) {
          return next();
        }
      }
      
      // Check Super Admin fallback
      if (req.user.platform_role === 'SUPER_ADMIN') {
        return next();
      }
      
      throw new ForbiddenError('Not authorized for this club');
    } catch (error) {
      next(error);
    }
  };
};
```

**Usage:**
```typescript
router.post(
  '/clubs/:id/events',
  authenticate,
  authorizeClubRole({ clubIdParam: 'id', allowedRoles: ['CLUB_HEAD'] }),
  controller.createEvent
);
```

---

### validate

**File:** `middleware/validate.ts`

**Purpose:** Validate request body/params/query using schemas

**Implementation:**
```typescript
import { z } from 'zod';
import { BadRequestError } from '@/lib/errors';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.reduce((acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        }, {});
        
        next(new BadRequestError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
};
```

**Schema Example:**
```typescript
// modules/clubs/schemas.ts
import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  facultyDetails: z.string().min(1),
  facultyCoordinatorId: z.string().uuid(),
  clubHeadUserId: z.string().uuid(),
  socialLinks: z.record(z.string().url()).optional(),
  logoUrl: z.string().url().optional()
});
```

**Usage:**
```typescript
router.post('/', authenticate, validate(createClubSchema), controller.createClub);
```


---

### paginate

**File:** `middleware/paginate.ts`

**Purpose:** Parse and validate pagination query parameters

**Implementation:**
```typescript
export const paginate = (req: Request, res: Response, next: NextFunction) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  
  req.pagination = { page, limit };
  next();
};
```

**Usage:**
```typescript
router.get('/', paginate, controller.listClubs);

// In controller:
const { page, limit } = req.pagination;
```

---

### errorHandler

**File:** `middleware/errorHandler.ts`

**Purpose:** Centralized error handling and response formatting

**Implementation:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError, 
  ConflictError, 
  BadRequestError 
} from '@/lib/errors';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);
  
  // Map custom errors to status codes
  if (error instanceof UnauthorizedError) {
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
  
  if (error instanceof ForbiddenError) {
    return res.status(403).json({
      success: false,
      message: error.message
    });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message
    });
  }
  
  if (error instanceof ConflictError) {
    return res.status(409).json({
      success: false,
      message: error.message
    });
  }
  
  if (error instanceof BadRequestError) {
    return res.status(400).json({
      success: false,
      message: error.message,
      errors: error.errors // Field-level errors
    });
  }
  
  // Prisma errors
  if (error.code === 'P2002') { // Unique constraint violation
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry'
    });
  }
  
  if (error.code === 'P2025') { // Record not found
    return res.status(404).json({
      success: false,
      message: 'Record not found'
    });
  }
  
  // Default 500 error
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};
```

**Registration:**
```typescript
// app.ts
app.use('/api/v1', routes);
app.use(errorHandler); // Must be last middleware
```


---

## Shared Libraries

### Prisma Client

**File:** `lib/prisma.ts`

**Purpose:** Singleton Prisma client instance

**Implementation:**
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Usage:**
```typescript
import { prisma } from '@/lib/prisma';

const user = await prisma.user.findUnique({ where: { id: userId } });
```

---

### JWT Utilities

**File:** `lib/jwt.ts`

**Purpose:** Sign and verify JWT tokens

**Implementation:**
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const signToken = (payload: { userId: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
};
```

**Usage:**
```typescript
import { signToken } from '@/lib/jwt';

const token = signToken({ userId: user.id });
```

---

### Password Utilities

**File:** `lib/password.ts`

**Purpose:** Hash and compare passwords using bcrypt

**Implementation:**
```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
```

**Usage:**
```typescript
import { hashPassword, comparePassword } from '@/lib/password';

// Registration
const passwordHash = await hashPassword(plainPassword);
await prisma.user.create({ data: { ...data, password_hash: passwordHash } });

// Login
const isValid = await comparePassword(plainPassword, user.password_hash);
```


---

### Response Envelope Helpers

**File:** `lib/envelope.ts`

**Purpose:** Standard response envelope formatting

**Implementation:**
```typescript
export const successResponse = (message: string, data: any = {}) => {
  return {
    success: true,
    message,
    data
  };
};

export const errorResponse = (message: string, errors?: Record<string, string>) => {
  return {
    success: false,
    message,
    ...(errors && { errors })
  };
};
```

**Usage:**
```typescript
import { successResponse } from '@/lib/envelope';

return res.status(200).json(successResponse('OK', { items, pagination }));
```

---

### Custom Error Classes

**File:** `lib/errors.ts`

**Purpose:** Domain-specific error types for consistent error handling

**Implementation:**
```typescript
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class BadRequestError extends Error {
  errors?: Record<string, string>;
  
  constructor(message: string = 'Bad request', errors?: Record<string, string>) {
    super(message);
    this.name = 'BadRequestError';
    this.errors = errors;
  }
}
```

**Usage:**
```typescript
import { NotFoundError, ConflictError } from '@/lib/errors';

if (!club) {
  throw new NotFoundError('Club not found');
}

if (existingClub) {
  throw new ConflictError('Club name already exists');
}
```


---

## Transaction Management

### When to Use Transactions

**Use Prisma transactions for:**
- Multi-step operations that must succeed or fail together
- Operations that create/update multiple related records
- Operations that check-then-modify (to avoid race conditions)

**Examples:**
1. **Club Request Approval:** Create club + create Club Head membership + update request status
2. **Club Head Transfer:** Demote old Club Head + promote new Club Head
3. **Remove Club Membership:** Check if sole Club Head + delete membership + cascade to departments

### Transaction Pattern

```typescript
// Sequential operations
const result = await prisma.$transaction(async (tx) => {
  // Step 1: Create club
  const club = await tx.club.create({
    data: { ...clubData }
  });
  
  // Step 2: Create Club Head membership
  await tx.clubMembership.create({
    data: {
      user_id: requestedBy,
      club_id: club.id,
      role: 'CLUB_HEAD'
    }
  });
  
  // Step 3: Update request status
  await tx.clubCreationRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', reviewed_by: reviewerId }
  });
  
  return club;
});
```

### Transaction Rules

- ✅ Use `prisma.$transaction()` for atomic multi-step operations
- ✅ Always return a value from transaction callback
- ✅ Use transaction parameter (`tx`) for all queries inside transaction
- ❌ Don't use global `prisma` client inside transaction callback
- ❌ Don't catch errors inside transaction (let them bubble up for rollback)
- ❌ Don't call external APIs inside transactions (keep them fast)

---

## Error Handling Strategy

### Error Flow

```
Service Layer          Controller Layer       Error Handler         Client
     │                      │                      │                   │
     │  throw Error         │                      │                   │
     ├─────────────────────>│                      │                   │
     │                      │  next(error)         │                   │
     │                      ├─────────────────────>│                   │
     │                      │                      │  Map to status    │
     │                      │                      │  Format response  │
     │                      │                      ├──────────────────>│
     │                      │                      │   { success,      │
     │                      │                      │     message,      │
     │                      │                      │     errors }      │
```

### Error Handling Best Practices

**In Services:**
```typescript
// ✅ Good: Throw specific error types
if (!user) {
  throw new NotFoundError('User not found');
}

if (existingEmail) {
  throw new ConflictError('Email already registered');
}

// ❌ Bad: Generic Error
throw new Error('Something went wrong');
```

**In Controllers:**
```typescript
// ✅ Good: Try-catch with next()
try {
  const result = await service.method();
  return res.status(200).json(successResponse('OK', result));
} catch (error) {
  next(error);
}

// ❌ Bad: Catch and respond directly
try {
  const result = await service.method();
  res.json(result);
} catch (error) {
  res.status(500).json({ error: error.message });
}
```

**In Error Handler:**
- Map custom error types to HTTP status codes
- Format response with standard envelope
- Log errors for debugging (production: error only; dev: all details)
- Never expose internal error details to client in production


---

## Authentication & Authorization Flow

### JWT Authentication Flow

```
1. User Login
   │
   ├─> POST /auth/login { email, password }
   │
   ├─> Service: Verify credentials
   │   - Find user by email
   │   - Compare password with bcrypt
   │
   ├─> Service: Generate JWT
   │   - Sign token with userId payload
   │   - Set expiration (7 days default)
   │
   └─> Return { user, token }

2. Protected Request
   │
   ├─> GET /protected (Authorization: Bearer <token>)
   │
   ├─> authenticate middleware
   │   - Extract token from header
   │   - Verify token signature
   │   - Decode userId from payload
   │   - Fetch user from database (fresh roles)
   │   - Attach user to req.user
   │
   ├─> authorize middleware (optional)
   │   - Check req.user.platform_role
   │   - Allow/deny based on role
   │
   └─> Controller: Access req.user
```

### Authorization Levels

**Level 1: Public**
- No authentication required
- Anyone can access
- Examples: GET /clubs, GET /events (with visibility filtering)

**Level 2: Authenticated**
- JWT required
- Any logged-in user can access
- Examples: POST /events/:id/register, GET /announcements

**Level 3: Platform Role**
- JWT + specific platform role required
- Checked via `authorize(['SUPER_ADMIN'])` middleware
- Examples: POST /clubs, PATCH /users/:id/role

**Level 4: Club/Department Role**
- JWT + club or department role required
- Checked via `authorizeClubRole` middleware or controller logic
- Examples: POST /clubs/:id/events (Club Head only)

**Level 5: Custom Logic**
- Complex authorization in controller/service
- Examples: "Club Head of this club OR Super Admin", "Self or Super Admin"

### Role Evaluation Rules

**Platform Roles:**
- Stored in `users.platform_role`
- Evaluated once per request from database
- Never trust JWT claims (always query fresh)

**Club Roles:**
- Stored in `club_memberships.role`
- Query per request: `WHERE user_id = ? AND club_id = ?`
- One user can have different roles in different clubs

**Department Head:**
- **NOT a stored role**
- Derived from `departments.head_user_id`
- Query per request: `WHERE head_user_id = ? AND department_id = ?`


---

## Dependency Injection

### Prisma Client Injection

**Pattern:** Import singleton instance

```typescript
// Service
import { prisma } from '@/lib/prisma';

export const clubService = {
  async getClub(id: string) {
    return prisma.club.findUnique({ where: { id } });
  }
};
```

**Why Not Constructor Injection:**
- Singleton pattern simpler for MVP
- Prisma manages connection pooling internally
- Easier testing with Prisma mocks

### Service Injection

**Pattern:** Import service directly (for same-module use only)

```typescript
// Controller
import { clubService } from './service';

export const clubController = {
  async getClub(req, res, next) {
    const club = await clubService.getClub(req.params.id);
    return res.json(successResponse('OK', club));
  }
};
```

**Cross-Module Rule:**
- ❌ Never import service from another module
- ✅ Modules communicate via database only
- ✅ Use shared utilities (lib/) for common logic

---

## Module Boundaries

### Module Independence

**Rules:**
1. **No cross-module service imports**
   ```typescript
   // ❌ Bad
   import { clubService } from '@/modules/clubs/service';
   
   // ✅ Good
   const club = await prisma.club.findUnique({ where: { id } });
   ```

2. **Communication via database**
   - Modules query database independently
   - No direct function calls between modules
   - Maintains loose coupling

3. **Shared code in lib/**
   - Reusable utilities (JWT, password, Prisma client)
   - Common middleware
   - Never business logic

### Why Module Boundaries Matter

**Benefits:**
- **Parallel Development:** Teams work independently
- **Testing:** Each module tested in isolation
- **Future Extraction:** Modules can become microservices if needed
- **Clear Ownership:** Each module has clear responsibility

**Example Violation:**
```typescript
// ❌ BAD: Department service calling Club service
import { clubService } from '@/modules/clubs/service';

export const departmentService = {
  async createDepartment(data) {
    const club = await clubService.getClub(data.clubId); // Violation!
    // ...
  }
};
```

**Correct Pattern:**
```typescript
// ✅ GOOD: Department service querying database directly
export const departmentService = {
  async createDepartment(data) {
    const club = await prisma.club.findUnique({ where: { id: data.clubId } });
    if (!club) throw new NotFoundError('Club not found');
    // ...
  }
};
```


---

## Future Scalability

### Adding New Modules

The architecture supports adding new modules without refactoring:

**Steps:**
1. Create `modules/new-feature/` directory
2. Add routes.ts, controller.ts, service.ts, schemas.ts
3. Register route in `routes/v1/index.ts`
4. Add database tables via Prisma migration
5. No changes to existing modules

**Example: Adding Notifications Module**
```
modules/notifications/
├── routes.ts          # POST /notifications, GET /notifications
├── controller.ts      # Request handlers
├── service.ts         # Business logic
└── schemas.ts         # Validation schemas

// Register in routes/v1/index.ts
import notificationRoutes from '@/modules/notifications/routes';
router.use('/notifications', notificationRoutes);
```

### Shared Middleware Reuse

New modules automatically benefit from:
- ✅ Authentication (JWT verification)
- ✅ Authorization (role checks)
- ✅ Validation (schema-based)
- ✅ Error handling (centralized)
- ✅ Response formatting (standard envelopes)

### Database Evolution

**Adding Tables:**
1. Add model to `prisma/schema.prisma`
2. Run `prisma migrate dev --name add-notifications`
3. Prisma client auto-updates with new types

**Adding Relationships:**
1. Add foreign key in Prisma schema
2. Run migration
3. Update related services to handle cascade behavior

### RESTful Conventions

All modules follow consistent REST patterns:
- `GET /resource` - List resources
- `GET /resource/:id` - Get single resource
- `POST /resource` - Create resource
- `PATCH /resource/:id` - Update resource
- `DELETE /resource/:id` - Delete resource

New modules should follow this pattern for consistency.

---

## Testing Strategy

### Unit Testing Services

**Pattern:** Test service layer in isolation with Prisma mocks

```typescript
// services/club.service.test.ts
import { prismaMock } from '@/lib/prisma.mock';
import { clubService } from './service';

describe('clubService.createClub', () => {
  it('should create club successfully', async () => {
    prismaMock.club.create.mockResolvedValue(mockClub);
    
    const result = await clubService.createClub(clubData);
    
    expect(result).toEqual(mockClub);
    expect(prismaMock.club.create).toHaveBeenCalledWith({
      data: expect.objectContaining(clubData)
    });
  });
  
  it('should throw ConflictError for duplicate name', async () => {
    prismaMock.club.findFirst.mockResolvedValue(existingClub);
    
    await expect(clubService.createClub(clubData)).rejects.toThrow(ConflictError);
  });
});
```

### Integration Testing Controllers

**Pattern:** Test full HTTP request/response cycle

```typescript
// controllers/club.controller.test.ts
import request from 'supertest';
import app from '@/app';

describe('POST /clubs', () => {
  it('should create club with valid data', async () => {
    const response = await request(app)
      .post('/api/v1/clubs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(clubData)
      .expect(201);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
  });
  
  it('should return 401 without token', async () => {
    await request(app)
      .post('/api/v1/clubs')
      .send(clubData)
      .expect(401);
  });
});
```

### Testing Middleware

**Pattern:** Test middleware functions in isolation

```typescript
// middleware/authenticate.test.ts
describe('authenticate middleware', () => {
  it('should attach user to request with valid token', async () => {
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = {};
    const next = jest.fn();
    
    await authenticate(req, res, next);
    
    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalledWith();
  });
  
  it('should call next with error for invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    const next = jest.fn();
    
    await authenticate(req, {}, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
```



### Testing Database Operations

**Pattern:** Use test database with real Prisma client

```typescript
// Setup test database
beforeAll(async () => {
  await prisma.$connect();
  await prisma.$executeRaw`TRUNCATE TABLE users, clubs CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

test('should handle transactions correctly', async () => {
  const result = await clubService.createClubFromRequest(requestId);
  
  // Verify club created
  const club = await prisma.club.findUnique({ where: { id: result.id } });
  expect(club).toBeDefined();
  
  // Verify membership created
  const membership = await prisma.clubMembership.findFirst({
    where: { club_id: result.id, role: 'CLUB_HEAD' }
  });
  expect(membership).toBeDefined();
});
```

### Test Organization

```
src/
├── modules/
│   ├── clubs/
│   │   ├── service.ts
│   │   ├── service.test.ts        # Unit tests
│   │   ├── controller.ts
│   │   └── controller.test.ts     # Integration tests
│   └── ...
├── middleware/
│   ├── authenticate.ts
│   └── authenticate.test.ts
└── lib/
    ├── jwt.ts
    └── jwt.test.ts
```

### Testing Best Practices

**Unit Tests:**
- Test service layer in isolation
- Mock Prisma client
- Focus on business logic
- Fast execution (no database)

**Integration Tests:**
- Test full HTTP flow
- Use test database
- Verify middleware chain
- Test authentication/authorization

**Coverage Goals:**
- Services: 90%+ (critical business logic)
- Controllers: 80%+ (HTTP layer)
- Middleware: 90%+ (security critical)


---

## Conclusion

The CampusOS backend architecture is designed for **MVP delivery speed** while maintaining **production-grade quality**. Key architectural principles:

1. **Three-Layer Separation:** Routes → Controllers → Services enforces clean separation of concerns
2. **Modular Monolith:** Single codebase with independent modules enables parallel development
3. **Shared Middleware:** Authentication, authorization, validation, and error handling reused across all endpoints
4. **Type-Safe Database Access:** Prisma ORM eliminates SQL injection and runtime type errors
5. **Consistent Error Handling:** Custom error classes map to HTTP status codes with standard response envelopes
6. **Module Boundaries:** No cross-module service dependencies maintains loose coupling
7. **Transaction Support:** Atomic multi-step operations ensure data consistency
8. **Scalable Foundation:** Adding new modules requires no changes to existing code

**This architecture balances:**
- Speed (monolith simplicity)
- Quality (clean code patterns)
- Maintainability (clear structure)
- Extensibility (module boundaries)

**Next Steps:**
1. Review `API_AND_DATABASE_SPEC.md` for complete API contracts
2. Review `DECISIONS.md` for technology choices and rationale
3. Follow `IMPLEMENTATION_PLAN.md` for phased development roadmap
4. Reference `AI_RULES.md` when writing code to ensure architectural consistency


# Appendix: Implementation Corrections

## Correction 1: `authorize()` usage example makes `GET /users` unreachable for Club Heads

Affected Section:
`## Middleware Architecture` → `### authorize` (Usage example, ~line 532)

Problem:
The usage example shows:
```typescript
router.get('/users', authenticate, authorize(['SUPER_ADMIN', 'FACULTY_COORDINATOR', 'CLUB_HEAD']), controller.listUsers);
```
The `authorize` middleware defined immediately above checks `allowedRoles.includes(req.user.platform_role)`. `platform_role` can only ever be `SUPER_ADMIN`, `FACULTY_COORDINATOR`, or `STUDENT` — `CLUB_HEAD` is a per-club `ClubRole`, never a value of `platform_role`. As written, this condition can never be true for a Club Head, so this code permanently blocks every Club Head from `GET /users`.

Source of Truth:
`FINAL_TEAM_BUILD_GUIDE.md` Roles Reference: *"Club roles (stored per membership): `CLUB_HEAD`... Platform roles:... `SUPER_ADMIN`, `FACULTY_COORDINATOR`, `STUDENT`."* `FINAL_API_CONTRACT.md`, "Search Users" (`GET /users`): *"Authentication: Role: `CLUB_HEAD`, `FACULTY_COORDINATOR`, or `SUPER_ADMIN`"* — Club Head access is required, so the endpoint must actually grant it.

Correct Implementation:
`authorize()` alone cannot express this requirement, because it only ever checks `platform_role`. `GET /users` needs a check that passes if **either** (a) `platform_role` is `SUPER_ADMIN` or `FACULTY_COORDINATOR`, **or** (b) the caller holds a `CLUB_HEAD` `club_memberships` row for *any* club (this endpoint's Club Head requirement is not scoped to one specific club — it's "is this user a Club Head of some club"). Two acceptable approaches:
1. Write a dedicated middleware (e.g. `authorizeUsersSearch`) that performs this OR-check directly, instead of reusing `authorize()`.
2. Compose `authorize(['SUPER_ADMIN', 'FACULTY_COORDINATOR'])` with a separate middleware step that additionally admits any caller with at least one `CLUB_HEAD` membership row, using an OR-style combinator.

Either way, do not list `'CLUB_HEAD'` inside a plain `authorize([...])` call — that pattern only ever compares against `platform_role` and cannot succeed.

Implementation Impact:
- Backend: replace this usage line with one of the two approaches above before implementing the Users module. Since this is presented as literal example code, a coding agent or developer following it verbatim will ship a broken, fail-closed endpoint.
- No frontend impact beyond confirming Club Heads can in fact search users (used by Club Management's member-add flow).

---

## Correction 2: `authorizeClubRole` cannot correctly scope Department Head to a specific department

Affected Section:
`## Middleware Architecture` → `### authorizeClubRole` (~lines 549–600)

Problem:
`authorizeClubRole` is parameterized only by `clubIdParam`. Its Department Head check is:
```typescript
const isDeptHead = await prisma.department.findFirst({
  where: { club_id: clubId, head_user_id: req.user.id }
});
```
This verifies "the caller heads **some** department in this club," not "the caller heads **this specific** department." There is also no parameter or usage example for routes whose URL identifies a *department*, not a club — specifically `PATCH /departments/:id/head`, `POST /departments/:id/members`, and `DELETE /departments/:id/members/:userId`, all of which take a department UUID, not a club UUID.

Source of Truth:
`FINAL_TEAM_BUILD_GUIDE.md` Departments Module Permissions: *"add/remove department member = Club Head or that department's Head"* (emphasis on **that** department, singular) and *"head must already be a department member"* for `PATCH /departments/:id/head`. `FINAL_API_CONTRACT.md`'s equivalent endpoints scope authorization to "that department's Head," not any department head in the club.

Correct Implementation:
Add a `departmentIdParam` option alongside `clubIdParam`, and a specific-department check:
```typescript
const isThisDeptHead = await prisma.department.findFirst({
  where: { id: req.params[options.departmentIdParam], head_user_id: req.user.id }
});
```
Add explicit usage examples for all three department-scoped routes, showing that the club ID (needed for the Club Head branch of the OR-check) is resolved from the department record itself — e.g. `department.club_id` — rather than expected as a separate URL param, since these routes' URL only contains a department ID.

Implementation Impact:
- Backend: without this fix, a Department Head of Department A could pass authorization for Department B's membership management within the same club — a real object-level authorization gap, not just a documentation gap. This must be resolved before implementing the three department-scoped endpoints, and is closely related to the Project/Blog Department-Head-scope correction in `API_AND_DATABASE_SPEC.md`'s appendix (Correction 4) — both stem from the same underlying "any department in the club" vs. "this specific department/entity" distinction.

---

## Correction 3: Coverage Goals are not sourced from the build guide

Affected Section:
`## Testing Strategy` → `### Testing Best Practices` → **Coverage Goals**

Problem:
States "Services: 90%+, Controllers: 80%+, Middleware: 90%+." These figures do not appear in either frozen source document.

Source of Truth:
`FINAL_TEAM_BUILD_GUIDE.md` Backend Completion Checklist only requires: *"Integration tests: one happy-path + one failure-path per module."* No percentage coverage target is specified anywhere in source.

Correct Implementation:
No change is required if the team knowingly adopts these percentages as an internal quality bar beyond MVP scope. If strict adherence to source is preferred, replace this subsection with the one testing requirement source actually states (one happy-path + one failure-path test per module) and drop the percentage targets, or keep them but label them explicitly as "team-adopted, not sourced from the build guide."

Implementation Impact:
- Informational only — no functional or security impact. Flagging so the team makes this an explicit choice rather than an unstated assumption, since the same unsourced numbers also appear in other planning documents outside this patch's scope.