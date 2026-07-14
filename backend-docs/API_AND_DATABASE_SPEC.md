# API and Database Specification

## Introduction

This document provides the complete API contract and database schema for CampusOS backend implementation. It serves as the single source of truth for:
- All 52 REST API endpoints with exact request/response formats
- Complete PostgreSQL database schema with all tables, relationships, and constraints
- Prisma ORM schema definitions ready for implementation

**Source Documents:**
- `FINAL_API_CONTRACT.md` - Frozen API specification (highest authority)
- `FINAL_TEAM_BUILD_GUIDE.md` - Database schema and business rules

**Critical Rules:**
- API contract is **frozen** - do not modify endpoint paths, field names, request/response formats, or status codes
- Field names use **camelCase** in API requests/responses
- Database columns use **snake_case** in PostgreSQL schema
- All endpoints follow standard success/failure envelope format
- Pagination format is consistent across all list endpoints

---

# Part 1: API Conventions and Core Modules

## 1. API Overview

### Base URL

```
/api/v1
```

### Authentication

All protected routes require a JWT in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

**Authentication Rules:**
- Public endpoints require no header
- Protected endpoints return `401` if header is missing, invalid, or token expired
- Endpoints with role restrictions return `403` when authenticated caller doesn't meet requirements
- Club-scoped and department-scoped roles are resolved fresh from database on every request


**Default Authentication Behavior:**

| Caller | Result |
|---|---|
| Logged out | `401 Unauthorized` |
| Logged in, doesn't meet role requirement | `403 Forbidden` |
| Logged in, meets requirement | Success response |

### Common Response Format

**Success Envelope:**
```json
{
  "success": true,
  "message": "string",
  "data": {}
}
```

**Failure Envelope:**
```json
{
  "success": false,
  "message": "string",
  "errors": { "field": "message" }
}
```

**Note:** `errors` object is optional and appears only on field-level validation failures (400 status).

### Global Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation failure / invalid state transition |
| 401 | Missing/invalid/expired JWT |
| 403 | Authenticated but not permitted |
| 404 | Not found / not visible to caller |
| 409 | Conflict (duplicate) |
| 500 | Server error |

### Pagination Format

Endpoints accepting `page` and `limit` query parameters follow this format:

**Request:**
```
?page=1&limit=20
```

**Response data:**
```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```


**Note:** Endpoints without `page`/`limit` in their specification return plain `items[]` array without pagination object.

---

## 2. Common Data Objects

### User (Minimal)

Returned to non-admin callers of `GET /users`:
```json
{
  "id": "uuid",
  "name": "Asha Rao",
  "email": "asha@example.edu"
}
```

### User (Admin View)

Returned to Super Admin callers:
```json
{
  "id": "uuid",
  "name": "Asha Rao",
  "email": "asha@example.edu",
  "platformRole": "STUDENT",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

### AuthUser

Returned by authentication endpoints:
```json
{
  "id": "uuid",
  "name": "Asha Rao",
  "email": "asha@example.edu",
  "platformRole": "STUDENT",
  "clubMemberships": [
    {
      "clubId": "uuid",
      "clubName": "Robotics Club",
      "role": "MEMBER",
      "department": {
        "id": "uuid",
        "name": "Web Dev",
        "head": { "id": "uuid" }
      }
    }
  ]
}
```

**Note:** `department` is `null` when membership isn't tied to a specific department.

### Club

```json
{
  "id": "uuid",
  "name": "Robotics Club",
  "description": "string",
  "facultyDetails": "string",
  "socialLinks": { "instagram": "https://...", "linkedin": "https://..." },
  "logoUrl": "https://... | null",
  "status": "ACTIVE",
  "facultyCoordinatorId": "uuid | null",
  "createdAt": "2026-01-10T09:00:00Z"
}
```


### ClubMember

**Member view (any club member):**
```json
{
  "userId": "uuid",
  "name": "Asha Rao",
  "role": "MEMBER"
}
```

**Club Head / Super Admin view:**
```json
{
  "userId": "uuid",
  "name": "Asha Rao",
  "email": "asha@example.edu",
  "role": "MEMBER"
}
```

---

## 3. Authentication Module

### POST /auth/register

**Purpose:** Create a new Student account

**Authentication:** Public

**Request Body:**
```json
{
  "name": "Asha Rao",
  "email": "asha@example.edu",
  "password": "correct-horse-1"
}
```

**Validation:**
- `name`: 2–80 characters, required
- `email`: valid email format, unique, required
- `password`: ≥ 8 characters, required

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Asha Rao",
      "email": "asha@example.edu",
      "platformRole": "STUDENT"
    },
    "token": "jwt_token"
  }
}
```

**Error Responses:**
- `400` - Field-level validation failure (name length, invalid email, weak password)
- `409` - Email already registered

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@example.edu","password":"securepass123"}'
```


---

### POST /auth/login

**Purpose:** Authenticate an existing user

**Authentication:** Public

**Request Body:**
```json
{
  "email": "asha@example.edu",
  "password": "correct-horse-1"
}
```

**Validation:**
- `email`: required
- `password`: required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Asha Rao",
      "email": "asha@example.edu",
      "platformRole": "STUDENT"
    },
    "token": "jwt_token"
  }
}
```

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid email or password (generic message regardless of which is wrong)

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@example.edu","password":"securepass123"}'
```

---

### GET /auth/me

**Purpose:** Get current user profile and club memberships

**Authentication:** Authenticated User

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "name": "Asha Rao",
    "email": "asha@example.edu",
    "platformRole": "STUDENT",
    "clubMemberships": [
      {
        "clubId": "uuid",
        "clubName": "Robotics Club",
        "role": "MEMBER",
        "department": null
      }
    ]
  }
}
```


**Error Responses:**
- `401` - Missing/invalid/expired token

**Implementation Notes:**
- Refetch after actions that change current user's role or memberships
- On any `403` response elsewhere, refetch to ensure cached data is fresh
- Frontend uses this for app load hydration

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <jwt_token>"
```

---

## 4. Users Module

### GET /users

**Purpose:** Search users to add as club or department members

**Authentication:** Role: `CLUB_HEAD`, `FACULTY_COORDINATOR`, or `SUPER_ADMIN`

**Query Parameters:**
- `search` (optional): string
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Asha Rao",
        "email": "asha@example.edu"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Note:** Super Admin callers additionally receive `platformRole` and `createdAt` per item.

**Error Responses:**
- `403` - Caller is not Club Head, Faculty Coordinator, or Super Admin

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/users?search=asha&page=1&limit=20" \
  -H "Authorization: Bearer <jwt_token>"
```


---

### GET /users/:id

**Purpose:** View a single user's profile

**Authentication:** Self, or Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: User UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "name": "Asha Rao",
    "email": "asha@example.edu",
    "platformRole": "STUDENT",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Caller is neither the target user nor Super Admin
- `404` - User not found

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <jwt_token>"
```

---

### PATCH /users/:id/role

**Purpose:** Change a user's platform-wide role

**Authentication:** Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: User UUID

**Request Body:**
```json
{
  "platformRole": "FACULTY_COORDINATOR"
}
```

**Validation:**
- `platformRole`: Must be one of `SUPER_ADMIN`, `FACULTY_COORDINATOR`, `STUDENT`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Role updated",
  "data": {
    "id": "uuid",
    "name": "Asha Rao",
    "email": "asha@example.edu",
    "platformRole": "FACULTY_COORDINATOR"
  }
}
```

**Error Responses:**
- `400` - Change would leave zero SUPER_ADMIN users on platform
- `403` - Caller is not Super Admin


**Business Rule:**
- Must maintain at least one SUPER_ADMIN user at all times
- Query total SUPER_ADMIN count before allowing demotion

**Example Request:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/550e8400-e29b-41d4-a716-446655440000/role \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"platformRole":"FACULTY_COORDINATOR"}'
```

---

# Part 2: Club Requests and Clubs Module

## 5. Club Requests Module

### POST /club-requests

**Purpose:** Submit a club creation request

**Authentication:** Authenticated User

**Request Body:**
```json
{
  "clubName": "Robotics Club",
  "description": "Building robots and competing in hackathons",
  "facultyDetails": "Dr. Smith, EE Department",
  "reason": "Many students interested in robotics"
}
```

**Validation:**
- All fields required
- `clubName`: ≤ 100 characters

**Success Response (201):**
```json
{
  "success": true,
  "message": "Request submitted",
  "data": {
    "id": "uuid",
    "status": "PENDING"
  }
}
```

**Error Responses:**
- `400` - Missing required field or clubName exceeds 100 chars

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/club-requests \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"clubName":"Robotics Club","description":"...","facultyDetails":"...","reason":"..."}'
```

---

### GET /club-requests

**Purpose:** List club creation requests for review

**Authentication:** Role: `SUPER_ADMIN`


**Query Parameters:**
- `status` (optional): `PENDING`, `APPROVED`, or `REJECTED`
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "clubName": "Robotics Club",
        "description": "string",
        "facultyDetails": "string",
        "reason": "string",
        "requestedBy": "uuid",
        "status": "PENDING",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 4,
      "totalPages": 1
    }
  }
}
```

**Error Responses:**
- `403` - Caller is not Super Admin

---

### GET /club-requests/:id

**Purpose:** View a single club creation request

**Authentication:** Role: `SUPER_ADMIN`, or original requester

**Path Parameters:**
- `id`: Request UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "clubName": "Robotics Club",
    "description": "string",
    "facultyDetails": "string",
    "reason": "string",
    "requestedBy": "uuid",
    "status": "PENDING",
    "reviewedBy": null,
    "rejectionReason": null,
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Caller is neither Super Admin nor the requester
- `404` - Request not found


---

### PATCH /club-requests/:id/approve

**Purpose:** Approve request, assign Faculty Coordinator, create club atomically

**Authentication:** Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: Request UUID

**Request Body:**
```json
{
  "facultyCoordinatorId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Request approved",
  "data": {
    "clubId": "uuid",
    "requestId": "uuid",
    "status": "APPROVED"
  }
}
```

**Business Rules:**
- Only `PENDING` requests can be approved
- Check duplicate club name (case-insensitive) → `409` before creating
- Check `facultyCoordinatorId` not already coordinating another club → `409`
- Atomically: create club (`ACTIVE`), create requester membership (`CLUB_HEAD`), update request (`APPROVED`)

**Error Responses:**
- `400` - Request is not PENDING
- `403` - Caller is not Super Admin
- `404` - Request not found
- `409` - Duplicate club name, or facultyCoordinatorId already coordinates another club

**Example Request:**
```bash
curl -X PATCH http://localhost:3000/api/v1/club-requests/550e8400-e29b-41d4-a716-446655440000/approve \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"facultyCoordinatorId":"650e8400-e29b-41d4-a716-446655440001"}'
```

---

### PATCH /club-requests/:id/reject

**Purpose:** Reject a pending request with optional reason

**Authentication:** Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: Request UUID

**Request Body:**
```json
{
  "reason": "Duplicate of an existing club"
}
```

**Note:** `reason` is optional


**Success Response (200):**
```json
{
  "success": true,
  "message": "Request rejected",
  "data": {
    "id": "uuid",
    "status": "REJECTED"
  }
}
```

**Error Responses:**
- `400` - Request is not PENDING
- `403` - Caller is not Super Admin
- `404` - Request not found

---

### DELETE /club-requests/:id

**Purpose:** Withdraw own pending request

**Authentication:** Original requester, only while status is `PENDING`

**Path Parameters:**
- `id`: Request UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Request withdrawn",
  "data": {}
}
```

**Error Responses:**
- `400` - Request is not PENDING
- `403` - Caller is not the requester

---

## 6. Clubs & Membership Module

### POST /clubs

**Purpose:** Create club directly, bypassing request/approval flow

**Authentication:** Role: `SUPER_ADMIN`

**Request Body:**
```json
{
  "name": "Robotics Club",
  "description": "Building robots",
  "facultyDetails": "Dr. Smith",
  "facultyCoordinatorId": "uuid",
  "clubHeadUserId": "uuid",
  "socialLinks": {
    "instagram": "https://instagram.com/roboticsclub",
    "linkedin": "https://linkedin.com/in/roboticsclub"
  },
  "logoUrl": "https://example.com/logo.png"
}
```

**Validation:**
- `name`: required, unique (case-insensitive)
- `description`, `facultyDetails`: required
- `facultyCoordinatorId`: must not already coordinate another club
- `clubHeadUserId`: must be existing user
- `socialLinks`, `logoUrl`: optional, URLs must match `https?://` pattern


**Success Response (201):**
```json
{
  "success": true,
  "message": "Club created",
  "data": {
    "id": "uuid",
    "name": "Robotics Club",
    "description": "Building robots",
    "facultyDetails": "Dr. Smith",
    "socialLinks": {},
    "logoUrl": null,
    "status": "ACTIVE",
    "facultyCoordinatorId": "uuid",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Missing required field, invalid URL, or clubHeadUserId doesn't exist
- `409` - Duplicate club name, or facultyCoordinatorId already coordinates another club

---

### GET /clubs

**Purpose:** Browse/search all clubs

**Authentication:** Public

**Query Parameters:**
- `search` (optional): string
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Robotics Club",
        "description": "string",
        "facultyDetails": "string",
        "socialLinks": {},
        "logoUrl": null,
        "status": "ACTIVE",
        "facultyCoordinatorId": "uuid",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

---

### GET /clubs/:id

**Purpose:** View club profile including departments

**Authentication:** Public


**Path Parameters:**
- `id`: Club UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "name": "Robotics Club",
    "description": "string",
    "facultyDetails": "string",
    "socialLinks": {},
    "logoUrl": null,
    "status": "ACTIVE",
    "facultyCoordinatorId": "uuid",
    "createdAt": "2026-01-10T09:00:00Z",
    "departments": [
      {
        "id": "uuid",
        "name": "Web Dev"
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Club not found

---

### PATCH /clubs/:id

**Purpose:** Edit club description, faculty details, social links, or logo

**Authentication:** Club Head (own club), or Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: Club UUID

**Request Body (all fields optional):**
```json
{
  "description": "Updated description",
  "facultyDetails": "Updated faculty details",
  "socialLinks": {
    "instagram": "https://instagram.com/newhandle"
  },
  "logoUrl": "https://example.com/newlogo.png"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Club updated",
  "data": {
    "id": "uuid",
    "name": "Robotics Club",
    "description": "Updated description",
    "facultyDetails": "Updated faculty details",
    "socialLinks": {},
    "logoUrl": "https://example.com/newlogo.png",
    "status": "ACTIVE",
    "facultyCoordinatorId": "uuid",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Caller is neither this club's Club Head nor Super Admin


---

### PATCH /clubs/:id/faculty-coordinator

**Purpose:** Reassign Faculty Coordinator

**Authentication:** Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "facultyCoordinatorId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Faculty Coordinator updated",
  "data": {
    "id": "uuid",
    "name": "Robotics Club",
    "description": "string",
    "facultyDetails": "string",
    "socialLinks": {},
    "logoUrl": null,
    "status": "ACTIVE",
    "facultyCoordinatorId": "uuid",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Caller is not Super Admin
- `409` - Target user already coordinates another club

**Business Rule:**
- Enforced via unique constraint on `faculty_coordinator_id`
- One Faculty Coordinator per club at a time

---

### GET /clubs/:id/members

**Purpose:** List club roster

**Authentication:** Authenticated club member (any role), or Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: Club UUID

**Query Parameters:**
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "userId": "uuid",
        "name": "Asha Rao",
        "role": "MEMBER"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "totalPages": 1
    }
  }
}
```

**Note:** Club Head or Super Admin callers receive `email` field on each item.


**Error Responses:**
- `403` - Caller is authenticated but not a member of this club (and not Super Admin)

---

### POST /clubs/:id/members

**Purpose:** Add existing user to club as Member

**Authentication:** Club Head (own club)

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Member added",
  "data": {
    "userId": "uuid",
    "clubId": "uuid",
    "role": "MEMBER"
  }
}
```

**Error Responses:**
- `403` - Caller is not this club's Club Head
- `404` - userId doesn't exist
- `409` - User is already a member of this club

---

### DELETE /clubs/:id/members/:userId

**Purpose:** Remove member or leave club

**Authentication:** Club Head (own club), or the member removing themself

**Path Parameters:**
- `id`: Club UUID
- `userId`: User UUID to remove

**Success Response (200):**
```json
{
  "success": true,
  "message": "Member removed",
  "data": {}
}
```

**Error Responses:**
- `400` - Target is the sole remaining Club Head (message: "cannot remove sole Club Head")
- `403` - Caller is neither this club's Club Head nor the member themself
- `404` - userId is not a member of this club

**Business Rule:**
- Must maintain at least one Club Head per club
- Check club membership count with role `CLUB_HEAD` before allowing deletion


---

### PATCH /clubs/:id/members/:userId/role

**Purpose:** Demote Club Head or Member to Member (cannot promote to Club Head)

**Authentication:** Club Head (own club)

**Path Parameters:**
- `id`: Club UUID
- `userId`: User UUID to update

**Request Body:**
```json
{
  "role": "MEMBER"
}
```

**Validation:**
- `role`: Must be exactly `MEMBER` (only value accepted)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Role updated",
  "data": {
    "userId": "uuid",
    "clubId": "uuid",
    "role": "MEMBER"
  }
}
```

**Error Responses:**
- `400` - role value other than MEMBER was supplied
- `403` - Caller is not this club's Club Head

**Note:** Promotion to Club Head only happens via `POST /clubs/:id/transfer-head`

---

### POST /clubs/:id/transfer-head

**Purpose:** Atomically transfer Club Head role

**Authentication:** Role: `SUPER_ADMIN`

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "newClubHeadUserId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Club Head transferred",
  "data": {
    "clubId": "uuid",
    "newClubHeadUserId": "uuid"
  }
}
```

**Error Responses:**
- `403` - Caller is not Super Admin
- `404` - Club or target user not found

**Business Rule:**
- Atomically demote outgoing Club Head and promote incoming one
- Target user must already be a club member


---

# Part 3: Departments, Events, and Projects Module

## 7. Departments Module

### POST /clubs/:id/departments

**Purpose:** Create department inside a club

**Authentication:** Club Head (own club)

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "name": "Web Dev"
}
```

**Validation:**
- `name`: 2–50 characters, unique per club (case-insensitive)

**Success Response (201):**
```json
{
  "success": true,
  "message": "Department created",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "name": "Web Dev"
  }
}
```

**Error Responses:**
- `403` - Caller is not this club's Club Head
- `409` - Department name already exists in this club (case-insensitive)

---

### GET /clubs/:id/departments

**Purpose:** List departments in a club

**Authentication:** Public

**Path Parameters:**
- `id`: Club UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "clubId": "uuid",
        "name": "Web Dev",
        "headUserId": "uuid | null",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ]
  }
}
```

**Note:** No pagination - returns plain array


---

### GET /departments/:id

**Purpose:** View department detail including members

**Authentication:** Public

**Path Parameters:**
- `id`: Department UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "name": "Web Dev",
    "headUserId": "uuid | null",
    "createdAt": "2026-01-10T09:00:00Z",
    "members": [
      {
        "userId": "uuid",
        "name": "Asha Rao"
      }
    ]
  }
}
```

**Error Responses:**
- `404` - Department not found

---

### PATCH /departments/:id/head

**Purpose:** Set or clear department head

**Authentication:** Club Head (of department's club)

**Path Parameters:**
- `id`: Department UUID

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Note:** Set `userId` to `null` to clear the head

**Validation:**
- If setting head: user must already be a department member

**Success Response (200):**
```json
{
  "success": true,
  "message": "Department head updated",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "name": "Web Dev",
    "headUserId": "uuid | null",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `400` - User is not a department member
- `403` - Caller is not this club's Club Head


---

### POST /departments/:id/members

**Purpose:** Add member to department

**Authentication:** Club Head, or Department Head (of this department)

**Path Parameters:**
- `id`: Department UUID

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Validation:**
- User must already be a club member first

**Success Response (201):**
```json
{
  "success": true,
  "message": "Member added to department",
  "data": {
    "userId": "uuid",
    "departmentId": "uuid"
  }
}
```

**Error Responses:**
- `400` - User must be a club member first
- `403` - Caller is not Club Head or Department Head
- `409` - User is already a member of this department

**Business Rule:**
- Department membership requires existing club membership
- Query club_memberships before allowing department membership creation

---

### DELETE /departments/:id/members/:userId

**Purpose:** Remove member from department

**Authentication:** Club Head, or Department Head (of this department)

**Path Parameters:**
- `id`: Department UUID
- `userId`: User UUID to remove

**Success Response (200):**
```json
{
  "success": true,
  "message": "Member removed from department",
  "data": {}
}
```

**Error Responses:**
- `403` - Caller is not Club Head or Department Head

**Business Rule:**
- If removed user is current department head, set `head_user_id` to null


---

## 8. Events Module

### POST /clubs/:id/events

**Purpose:** Submit new event for Faculty Coordinator approval

**Authentication:** Club Head (of this club)

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "title": "Hack Night",
  "description": "Build projects and learn together",
  "location": "Room 301",
  "type": "PUBLIC",
  "capacity": 50,
  "startTime": "2026-08-01T18:00:00Z",
  "endTime": "2026-08-01T21:00:00Z"
}
```

**Validation:**
- All fields required except `capacity`
- `type`: Must be `PUBLIC` or `CLUB_EXCLUSIVE`
- `capacity`: null (unlimited) or > 0
- `endTime` must be after `startTime`

**Success Response (201):**
```json
{
  "success": true,
  "message": "Event submitted for approval",
  "data": {
    "id": "uuid",
    "status": "PENDING"
  }
}
```

**Error Responses:**
- `400` - endTime not after startTime, or capacity ≤ 0
- `403` - Caller is not this club's Club Head

---

### PATCH /clubs/:id/events/:eventId

**Purpose:** Edit PENDING or REJECTED event (resets to PENDING)

**Authentication:** Club Head (of this club)

**Path Parameters:**
- `id`: Club UUID
- `eventId`: Event UUID

**Request Body (all fields optional):**
```json
{
  "title": "Updated Hack Night",
  "description": "Updated description",
  "location": "Room 302",
  "type": "CLUB_EXCLUSIVE",
  "capacity": 60,
  "startTime": "2026-08-01T19:00:00Z",
  "endTime": "2026-08-01T22:00:00Z"
}
```


**Success Response (200):**
```json
{
  "success": true,
  "message": "Event updated",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "title": "Updated Hack Night",
    "description": "Updated description",
    "location": "Room 302",
    "type": "CLUB_EXCLUSIVE",
    "capacity": 60,
    "registeredCount": 12,
    "startTime": "2026-08-01T19:00:00Z",
    "endTime": "2026-08-01T22:00:00Z",
    "status": "PENDING",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `400` - endTime not after startTime, or event status is APPROVED
- `403` - Caller is not this club's Club Head

**Business Rule:**
- Can only edit PENDING or REJECTED events
- Editing resets status to PENDING
- APPROVED events cannot be edited

---

### GET /events

**Purpose:** Browse all approved events

**Authentication:** Public (logged-out users see PUBLIC events only; logged-in users also see CLUB_EXCLUSIVE events for their clubs)

**Query Parameters:**
- `search` (optional): string
- `status` (optional): `PENDING`, `APPROVED`, `REJECTED`
- `type` (optional): `PUBLIC`, `CLUB_EXCLUSIVE`
- `clubId` (optional): UUID
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "clubId": "uuid",
        "title": "Hack Night",
        "description": "string",
        "location": "Room 301",
        "type": "PUBLIC",
        "capacity": 50,
        "registeredCount": 12,
        "startTime": "2026-08-01T18:00:00Z",
        "endTime": "2026-08-01T21:00:00Z",
        "status": "APPROVED",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```


---

### GET /events/:id

**Purpose:** View event detail

**Authentication:** Public for PUBLIC events; authenticated club member for CLUB_EXCLUSIVE events

**Path Parameters:**
- `id`: Event UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "title": "Hack Night",
    "description": "string",
    "location": "Room 301",
    "type": "PUBLIC",
    "capacity": 50,
    "registeredCount": 12,
    "startTime": "2026-08-01T18:00:00Z",
    "endTime": "2026-08-01T21:00:00Z",
    "status": "APPROVED",
    "requestedBy": "uuid",
    "reviewedBy": "uuid | null",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `404` - Event not found

---

### PATCH /events/:id/approve

**Purpose:** Approve pending event

**Authentication:** Faculty Coordinator (of event's club)

**Path Parameters:**
- `id`: Event UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Event approved",
  "data": {
    "id": "uuid",
    "status": "APPROVED"
  }
}
```

**Error Responses:**
- `400` - Event is not PENDING
- `403` - Caller is not Faculty Coordinator of this event's club

**Business Rule:**
- Only PENDING events can be approved

---

### PATCH /events/:id/reject

**Purpose:** Reject pending event with optional reason

**Authentication:** Faculty Coordinator (of event's club)

**Path Parameters:**
- `id`: Event UUID


**Request Body:**
```json
{
  "reason": "Conflicts with another event"
}
```

**Note:** `reason` is optional

**Success Response (200):**
```json
{
  "success": true,
  "message": "Event rejected",
  "data": {
    "id": "uuid",
    "status": "REJECTED"
  }
}
```

**Error Responses:**
- `400` - Event is not PENDING
- `403` - Caller is not Faculty Coordinator of this event's club

---

### POST /events/:id/register

**Purpose:** Register for an event

**Authentication:** Authenticated User

**Path Parameters:**
- `id`: Event UUID

**Success Response (201):**
```json
{
  "success": true,
  "message": "Registered successfully",
  "data": {
    "eventId": "uuid",
    "userId": "uuid"
  }
}
```

**Error Responses:**
- `400` - Event not approved or already full
- `403` - CLUB_EXCLUSIVE event and caller is not a member of the club
- `409` - Already registered

**Business Rules:**
- Can only register for APPROVED events
- PUBLIC events: any authenticated user
- CLUB_EXCLUSIVE events: authenticated club members only
- Check capacity: if capacity is not null and registrations >= capacity, return 400
- Calculate registeredCount: SELECT COUNT(*) FROM event_registrations WHERE event_id = ?

---

### DELETE /events/:id/register

**Purpose:** Unregister from an event

**Authentication:** Authenticated User

**Path Parameters:**
- `id`: Event UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Unregistered successfully",
  "data": {}
}
```

**Error Responses:**
- `404` - Not registered for this event


---

### GET /events/:id/registrations

**Purpose:** List event registrants

**Authentication:** Club Head or Faculty Coordinator (of event's club)

**Path Parameters:**
- `id`: Event UUID

**Query Parameters:**
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "userId": "uuid",
        "name": "Asha Rao",
        "registeredAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

**Error Responses:**
- `403` - Caller is not Club Head or Faculty Coordinator of this event's club

---

## 9. Projects Module

### POST /clubs/:id/projects

**Purpose:** Publish a project

**Authentication:** Club Head or Department Head (of this club)

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "title": "Campus Nav App",
  "description": "Navigate campus easily",
  "techStack": ["React", "Node.js", "MongoDB"],
  "githubLink": "https://github.com/club/project",
  "demoLink": "https://demo.example.com",
  "thumbnailUrl": "https://example.com/thumb.png",
  "contributors": ["Asha Rao", "John Doe"],
  "status": "IN_PROGRESS",
  "departmentId": "uuid"
}
```

**Validation:**
- `title`, `description`: required
- `techStack`, `contributors`: optional arrays
- `githubLink`, `demoLink`, `thumbnailUrl`: optional URLs
- `status`: Must be `IN_PROGRESS`, `COMPLETED`, or `ARCHIVED`
- `departmentId`: optional, must exist if provided


**Success Response (201):**
```json
{
  "success": true,
  "message": "Project created",
  "data": {
    "id": "uuid"
  }
}
```

**Error Responses:**
- `400` - Missing required field or invalid URL
- `403` - Caller is not Club Head or Department Head of this club

---

### GET /projects

**Purpose:** Browse all published projects

**Authentication:** Public

**Query Parameters:**
- `search` (optional): string
- `clubId` (optional): UUID
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "clubId": "uuid",
        "departmentId": "uuid | null",
        "title": "Campus Nav App",
        "description": "Navigate campus easily",
        "techStack": ["React", "Node.js"],
        "thumbnailUrl": "https://example.com/thumb.png",
        "status": "IN_PROGRESS",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  }
}
```

---

### GET /projects/:id

**Purpose:** View project detail

**Authentication:** Public

**Path Parameters:**
- `id`: Project UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "departmentId": "uuid | null",
    "title": "Campus Nav App",
    "description": "Navigate campus easily",
    "techStack": ["React", "Node.js"],
    "thumbnailUrl": "https://example.com/thumb.png",
    "status": "IN_PROGRESS",
    "createdAt": "2026-01-10T09:00:00Z",
    "githubLink": "https://github.com/club/project",
    "demoLink": "https://demo.example.com",
    "contributors": ["Asha Rao", "John Doe"],
    "createdBy": "uuid"
  }
}
```

**Error Responses:**
- `404` - Project not found


---

### PATCH /projects/:id

**Purpose:** Edit project

**Authentication:** Club Head or Department Head (of project's club), or project creator

**Path Parameters:**
- `id`: Project UUID

**Request Body (all fields optional):**
```json
{
  "title": "Updated Campus Nav App",
  "description": "Updated description",
  "techStack": ["React", "Node.js", "PostgreSQL"],
  "githubLink": "https://github.com/club/new-project",
  "demoLink": "https://new-demo.example.com",
  "thumbnailUrl": "https://example.com/new-thumb.png",
  "contributors": ["Asha Rao", "Jane Smith"],
  "status": "COMPLETED",
  "departmentId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Project updated",
  "data": {
    "id": "uuid",
    "clubId": "uuid",
    "departmentId": "uuid | null",
    "title": "Updated Campus Nav App",
    "description": "Updated description",
    "techStack": ["React", "Node.js", "PostgreSQL"],
    "thumbnailUrl": "https://example.com/new-thumb.png",
    "status": "COMPLETED",
    "createdAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Caller is not authorized to edit this project

---

### DELETE /projects/:id

**Purpose:** Delete project

**Authentication:** Club Head or Department Head (of project's club), or project creator

**Path Parameters:**
- `id`: Project UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Project deleted",
  "data": {}
}
```

**Error Responses:**
- `403` - Caller is not authorized to delete this project


---

## 10. Blogs Module

### POST /clubs/:id/blogs

**Purpose:** Publish a blog post

**Authentication:** Club Head or Department Head (of this club)

**Path Parameters:**
- `id`: Club UUID

**Request Body:**
```json
{
  "title": "How We Won Hackathon X",
  "content": "Full blog post content here...",
  "tags": ["hackathon", "robotics"],
  "thumbnailUrl": "https://example.com/thumb.png",
  "departmentId": "uuid"
}
```

**Validation:**
- `title`, `content`: required
- `tags`: optional array
- `thumbnailUrl`: optional URL
- `departmentId`: optional, must exist if provided

**Success Response (201):**
```json
{
  "success": true,
  "message": "Blog published",
  "data": {
    "id": "uuid"
  }
}
```

**Error Responses:**
- `400` - Missing required field or invalid URL
- `403` - Caller is not Club Head or Department Head of this club

---

### GET /blogs

**Purpose:** Browse all published blogs

**Authentication:** Public

**Query Parameters:**
- `search` (optional): string
- `clubId` (optional): UUID
- `tag` (optional): string
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "clubId": "uuid | null",
        "departmentId": "uuid | null",
        "title": "How We Won Hackathon X",
        "tags": ["hackathon", "robotics"],
        "thumbnailUrl": "https://example.com/thumb.png",
        "authorId": "uuid",
        "publishedAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 30,
      "totalPages": 2
    }
  }
}
```


---

### GET /blogs/:id

**Purpose:** Read full blog post

**Authentication:** Public

**Path Parameters:**
- `id`: Blog UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "clubId": "uuid | null",
    "departmentId": "uuid | null",
    "title": "How We Won Hackathon X",
    "tags": ["hackathon", "robotics"],
    "thumbnailUrl": "https://example.com/thumb.png",
    "authorId": "uuid",
    "publishedAt": "2026-01-10T09:00:00Z",
    "content": "Full blog post content here..."
  }
}
```

**Error Responses:**
- `404` - Blog not found

---

### PATCH /blogs/:id

**Purpose:** Edit blog post

**Authentication:** Club Head or Department Head (of blog's club), or blog author

**Path Parameters:**
- `id`: Blog UUID

**Request Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "tags": ["hackathon", "robotics", "ai"],
  "thumbnailUrl": "https://example.com/new-thumb.png",
  "departmentId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Blog updated",
  "data": {
    "id": "uuid",
    "clubId": "uuid | null",
    "departmentId": "uuid | null",
    "title": "Updated Title",
    "tags": ["hackathon", "robotics", "ai"],
    "thumbnailUrl": "https://example.com/new-thumb.png",
    "authorId": "uuid",
    "publishedAt": "2026-01-10T09:00:00Z"
  }
}
```

**Error Responses:**
- `403` - Caller is not authorized to edit this blog


---

### DELETE /blogs/:id

**Purpose:** Delete blog post

**Authentication:** Club Head or Department Head (of blog's club), or blog author

**Path Parameters:**
- `id`: Blog UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Blog deleted",
  "data": {}
}
```

**Error Responses:**
- `403` - Caller is not authorized to delete this blog

---

## 11. Announcements Module

### POST /announcements

**Purpose:** Post a new announcement

**Authentication:** 
- Super Admin (for GLOBAL)
- Club Head (for CLUB)
- Department Head (for DEPARTMENT)

**Request Body:**
```json
{
  "title": "Midterm Break Notice",
  "content": "Campus will be closed...",
  "visibility": "GLOBAL",
  "clubId": "uuid",
  "departmentId": "uuid"
}
```

**Validation:**
- `title`, `content`, `visibility`: required
- `visibility`: Must be `GLOBAL`, `CLUB`, or `DEPARTMENT`
- `clubId`: required for CLUB visibility, ignored for GLOBAL
- `departmentId`: required for DEPARTMENT visibility

**Success Response (201):**
```json
{
  "success": true,
  "message": "Announcement posted",
  "data": {
    "id": "uuid"
  }
}
```

**Error Responses:**
- `403` - Caller lacks scope for chosen visibility (e.g., non-Super-Admin trying GLOBAL)

**Business Rules:**
- GLOBAL: Super Admin only
- CLUB: Club Head of specified club
- DEPARTMENT: Department Head of specified department
- For DEPARTMENT visibility, derive clubId server-side from department's club


---

### GET /announcements

**Purpose:** View announcements visible to current user

**Authentication:** Authenticated User

**Query Parameters:**
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Midterm Break Notice",
        "visibility": "GLOBAL",
        "clubId": "uuid | null",
        "departmentId": "uuid | null",
        "createdBy": "uuid",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

**Error Responses:**
- `401` - Not authenticated

**Business Rule:**
- Filter server-side to show only announcements visible to caller:
  - GLOBAL: everyone
  - CLUB: members of that club
  - DEPARTMENT: members of that department

---

### GET /announcements/:id

**Purpose:** View full announcement

**Authentication:** Public (but filtered by visibility)

**Path Parameters:**
- `id`: Announcement UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "title": "Midterm Break Notice",
    "visibility": "GLOBAL",
    "clubId": "uuid | null",
    "departmentId": "uuid | null",
    "createdBy": "uuid",
    "createdAt": "2026-01-10T09:00:00Z",
    "content": "Campus will be closed..."
  }
}
```

**Error Responses:**
- `404` - Announcement not found or not visible to caller


---

### DELETE /announcements/:id

**Purpose:** Delete announcement

**Authentication:** Announcement creator, or moderator (Club Head for CLUB, Department Head for DEPARTMENT, Super Admin for GLOBAL)

**Path Parameters:**
- `id`: Announcement UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Announcement deleted",
  "data": {}
}
```

**Error Responses:**
- `403` - Caller is not authorized to delete this announcement

**Business Rule:**
- Creator can always delete their own announcement
- Club Head can delete CLUB announcements from their club
- Department Head can delete DEPARTMENT announcements from their department
- Super Admin can delete GLOBAL announcements

---

## 12. Search Module

### GET /search

**Purpose:** Cross-entity search across clubs, events, projects, and blogs

**Authentication:** Public

**Query Parameters:**
- `q` (required): search query string, ≥ 2 characters
- `type` (optional): filter by entity type (`clubs`, `events`, `projects`, `blogs`)
- `page` (optional): integer, default 1
- `limit` (optional): integer, default 20

**Success Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "clubs": [
      {
        "id": "uuid",
        "name": "Robotics Club",
        "description": "string",
        "facultyDetails": "string",
        "socialLinks": {},
        "logoUrl": null,
        "status": "ACTIVE",
        "facultyCoordinatorId": "uuid",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "events": [
      {
        "id": "uuid",
        "clubId": "uuid",
        "title": "Hack Night",
        "description": "string",
        "location": "Room 301",
        "type": "PUBLIC",
        "capacity": 50,
        "registeredCount": 12,
        "startTime": "2026-08-01T18:00:00Z",
        "endTime": "2026-08-01T21:00:00Z",
        "status": "APPROVED",
        "createdAt": "2026-01-10T09:00:00Z"
      }
    ],
    "projects": [],
    "blogs": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "totalPages": 1
    }
  }
}
```


**Error Responses:**
- `400` - Query string `q` is missing or < 2 characters

**Implementation Notes:**
- All four entity arrays (clubs, events, projects, blogs) are always present in response
- Empty arrays indicate no results for that entity type
- Use PostgreSQL ILIKE for case-insensitive search
- Search fields:
  - Clubs: name, description
  - Events: title, description (APPROVED only)
  - Projects: title, description, techStack
  - Blogs: title, content, tags
- If `type` parameter provided, only return results for that entity type, others as empty arrays

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/v1/search?q=robotics&page=1&limit=20"
```

---

# Part 4: Database Schema

## Database Design Principles

The CampusOS database follows these principles:
- **Simplicity:** MVP-focused schema without unnecessary tables
- **Referential Integrity:** Foreign keys with explicit cascade behavior
- **Constraints:** Unique constraints, nullability, and check constraints enforce business rules
- **Enums:** Type-safe constrained values for roles and statuses
- **Timestamps:** created_at/updated_at for audit trails
- **Hard Deletes:** No soft delete columns (out of MVP scope)

---

## Enums

### PlatformRole
```sql
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'FACULTY_COORDINATOR', 'STUDENT');
```

**Usage:** users.platform_role

**Values:**
- `SUPER_ADMIN` - Platform-wide administrator
- `FACULTY_COORDINATOR` - Faculty member assigned to one club
- `STUDENT` - Default role for all new users

---

### ClubRole
```sql
CREATE TYPE "ClubRole" AS ENUM ('CLUB_HEAD', 'MEMBER');
```

**Usage:** club_memberships.role

**Values:**
- `CLUB_HEAD` - Exactly one per club (enforced via business logic)
- `MEMBER` - Standard club member

---

### ClubStatus
```sql
CREATE TYPE "ClubStatus" AS ENUM ('ACTIVE');
```

**Usage:** clubs.status

**Note:** Only ACTIVE status in MVP


---

### RequestStatus
```sql
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
```

**Usage:** club_creation_requests.status

**Values:**
- `PENDING` - Awaiting Super Admin review
- `APPROVED` - Request approved, club created
- `REJECTED` - Request rejected with optional reason

---

### EventType
```sql
CREATE TYPE "EventType" AS ENUM ('PUBLIC', 'CLUB_EXCLUSIVE');
```

**Usage:** events.type

**Values:**
- `PUBLIC` - Open to all authenticated users
- `CLUB_EXCLUSIVE` - Restricted to club members only

---

### EventStatus
```sql
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
```

**Usage:** events.status

**Values:**
- `PENDING` - Awaiting Faculty Coordinator approval
- `APPROVED` - Approved for registration
- `REJECTED` - Rejected with optional reason

**Note:** COMPLETED status not used in MVP

---

### ProjectStatus
```sql
CREATE TYPE "ProjectStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
```

**Usage:** projects.status

**Values:**
- `IN_PROGRESS` - Active development
- `COMPLETED` - Project finished
- `ARCHIVED` - No longer active

---

### AnnouncementVisibility
```sql
CREATE TYPE "AnnouncementVisibility" AS ENUM ('GLOBAL', 'CLUB', 'DEPARTMENT');
```

**Usage:** announcements.visibility

**Values:**
- `GLOBAL` - Visible to all users (Super Admin only)
- `CLUB` - Visible to club members (Club Head)
- `DEPARTMENT` - Visible to department members (Department Head)


---

## PostgreSQL Tables

### users

**Purpose:** Store user accounts and platform-level roles

**Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  platform_role "PlatformRole" NOT NULL DEFAULT 'STUDENT',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_platform_role ON users(platform_role);
```

**Constraints:**
- `email` must be unique (enforced by unique index)
- `name`: 2–80 characters (validate in application layer)
- `password_hash`: bcrypt hash, never store plain passwords
- `platform_role`: Defaults to STUDENT

**Cascade Rules:**
- Users cannot be deleted in MVP (no DELETE endpoint)
- If user deletion added later: consider RESTRICT on critical foreign keys

**Validation:**
- Email format validated in application layer using RFC 5322 pattern
- Password: ≥ 8 characters before hashing

---

### club_creation_requests

**Purpose:** Store club creation requests pending Super Admin review

**Schema:**
```sql
CREATE TABLE club_creation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  faculty_details TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status "RequestStatus" NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_club_requests_status ON club_creation_requests(status);
CREATE INDEX idx_club_requests_requested_by ON club_creation_requests(requested_by);
```

**Constraints:**
- `club_name`: ≤ 100 characters
- `status`: Defaults to PENDING
- `reviewed_by`: Nullable until reviewed
- `rejection_reason`: Nullable, populated on rejection

**Cascade Rules:**
- `requested_by` user deleted → RESTRICT (prevent orphaned requests)
- `reviewed_by` user deleted → SET NULL (preserve audit trail)


---

### clubs

**Purpose:** Store active clubs

**Schema:**
```sql
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  faculty_details TEXT NOT NULL,
  social_links JSONB,
  logo_url VARCHAR(500),
  status "ClubStatus" NOT NULL DEFAULT 'ACTIVE',
  faculty_coordinator_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_clubs_name ON clubs(LOWER(name));
CREATE UNIQUE INDEX idx_clubs_faculty_coordinator ON clubs(faculty_coordinator_id) WHERE faculty_coordinator_id IS NOT NULL;
CREATE INDEX idx_clubs_status ON clubs(status);
```

**Constraints:**
- `name`: Unique (case-insensitive via functional index)
- `social_links`: JSONB object, nullable (e.g., `{"instagram": "https://...", "linkedin": "https://..."}`)
- `logo_url`: Nullable, must match `https?://` pattern (validate in application)
- `faculty_coordinator_id`: Unique and nullable (enforces one coordinator per club)

**Cascade Rules:**
- `faculty_coordinator_id` user deleted → SET NULL
- Club deleted → CASCADE to club_memberships, departments, events, projects

**Business Rules:**
- One Club Head per club (enforced via application logic on club_memberships)
- One Faculty Coordinator per club (enforced via unique constraint)
- Name uniqueness case-insensitive (enforced via functional index)

---

### club_memberships

**Purpose:** Store user memberships in clubs with roles

**Schema:**
```sql
CREATE TABLE club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role "ClubRole" NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, club_id)
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_club_memberships_user_club ON club_memberships(user_id, club_id);
CREATE INDEX idx_club_memberships_club_id ON club_memberships(club_id);
CREATE INDEX idx_club_memberships_user_id ON club_memberships(user_id);
CREATE INDEX idx_club_memberships_role ON club_memberships(club_id, role);
```

**Constraints:**
- Unique combination of (user_id, club_id)
- `role`: CLUB_HEAD or MEMBER
- Exactly one CLUB_HEAD per club (enforced in application logic)

**Cascade Rules:**
- User deleted → CASCADE (remove all memberships)
- Club deleted → CASCADE (remove all memberships)
- Membership deleted → CASCADE to department_memberships for same club


---

### departments

**Purpose:** Store departments within clubs

**Schema:**
```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_departments_club_name ON departments(club_id, LOWER(name));
CREATE INDEX idx_departments_club_id ON departments(club_id);
CREATE INDEX idx_departments_head_user_id ON departments(head_user_id);
```

**Constraints:**
- `name`: 2–50 characters, unique per club (case-insensitive via functional index)
- `head_user_id`: Nullable (Department Head is derived, not a stored role)

**Cascade Rules:**
- Club deleted → CASCADE (delete all departments)
- `head_user_id` user deleted → SET NULL
- Department deleted → CASCADE to department_memberships
- Department deleted → SET NULL on projects.department_id, blogs.department_id
- Department deleted → CASCADE to announcements with DEPARTMENT visibility

**Business Rules:**
- Department Head is NOT a stored role
- User becomes Department Head when `head_user_id` matches their user ID
- Removing Department Head (via club or department membership removal) → set `head_user_id` to NULL

---

### department_memberships

**Purpose:** Store user memberships in departments

**Schema:**
```sql
CREATE TABLE department_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, department_id)
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_department_memberships_user_dept ON department_memberships(user_id, department_id);
CREATE INDEX idx_department_memberships_department_id ON department_memberships(department_id);
CREATE INDEX idx_department_memberships_user_id ON department_memberships(user_id);
```

**Constraints:**
- Unique combination of (user_id, department_id)
- User must be club member before joining department (enforced in application)

**Cascade Rules:**
- User deleted → CASCADE
- Department deleted → CASCADE
- Club membership deleted → CASCADE (remove all department memberships in that club)


---

### events

**Purpose:** Store event requests and registrations

**Schema:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(200) NOT NULL,
  type "EventType" NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL CHECK (end_time > start_time),
  status "EventStatus" NOT NULL DEFAULT 'PENDING',
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_events_club_id ON events(club_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_status_type ON events(status, type);
```

**Constraints:**
- `capacity`: Nullable (unlimited) or > 0
- `end_time` must be after `start_time` (CHECK constraint)
- `status`: Defaults to PENDING
- `requested_by`: Must be Club Head (validated in application)
- `reviewed_by`: Nullable until reviewed
- `rejection_reason`: Nullable

**Cascade Rules:**
- Club deleted → CASCADE (delete all events)
- `requested_by` user deleted → RESTRICT
- `reviewed_by` user deleted → SET NULL
- Event deleted → CASCADE to event_registrations

**Business Rules:**
- Only PENDING events can be approved or rejected
- Only PENDING or REJECTED events can be edited
- Editing resets status to PENDING
- APPROVED events cannot be edited

---

### event_registrations

**Purpose:** Store user registrations for events

**Schema:**
```sql
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_event_registrations_event_user ON event_registrations(event_id, user_id);
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);
```

**Constraints:**
- Unique combination of (event_id, user_id)
- Can only register for APPROVED events (enforced in application)

**Cascade Rules:**
- Event deleted → CASCADE
- User deleted → CASCADE

**Business Rules:**
- Calculate registeredCount: `SELECT COUNT(*) FROM event_registrations WHERE event_id = ?`
- Check capacity before registration: if capacity NOT NULL and count >= capacity, reject with 400


---

### projects

**Purpose:** Store club projects and showcases

**Schema:**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  github_link VARCHAR(500),
  demo_link VARCHAR(500),
  thumbnail_url VARCHAR(500),
  contributors TEXT[] NOT NULL DEFAULT '{}',
  status "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_projects_club_id ON projects(club_id);
CREATE INDEX idx_projects_department_id ON projects(department_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);
```

**Constraints:**
- `tech_stack`: Array of strings (e.g., `['React', 'Node.js']`)
- `github_link`, `demo_link`, `thumbnail_url`: Nullable URLs
- `contributors`: Array of contributor names (strings, not user IDs)
- `status`: Defaults to IN_PROGRESS

**Cascade Rules:**
- Club deleted → CASCADE
- Department deleted → SET NULL (project remains, loses department association)
- `created_by` user deleted → RESTRICT

**Validation:**
- URLs must match `https?://` pattern (validate in application)

---

### blogs

**Purpose:** Store blog posts

**Schema:**
```sql
CREATE TABLE blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url VARCHAR(500),
  published_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_blogs_club_id ON blogs(club_id);
CREATE INDEX idx_blogs_department_id ON blogs(department_id);
CREATE INDEX idx_blogs_author_id ON blogs(author_id);
CREATE INDEX idx_blogs_published_at ON blogs(published_at DESC);
CREATE INDEX idx_blogs_tags ON blogs USING GIN(tags);
```

**Constraints:**
- `club_id`: Nullable (can be club-wide or department-specific)
- `department_id`: Nullable
- `tags`: Array of strings
- `thumbnail_url`: Nullable URL

**Cascade Rules:**
- Club deleted → CASCADE
- Department deleted → SET NULL
- `author_id` user deleted → RESTRICT


---

### announcements

**Purpose:** Store announcements with visibility scoping

**Schema:**
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  visibility "AnnouncementVisibility" NOT NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_announcements_visibility ON announcements(visibility);
CREATE INDEX idx_announcements_club_id ON announcements(club_id);
CREATE INDEX idx_announcements_department_id ON announcements(department_id);
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
```

**Constraints:**
- `visibility`: GLOBAL, CLUB, or DEPARTMENT
- `club_id`: Required for CLUB visibility, nullable for GLOBAL
- `department_id`: Required for DEPARTMENT visibility, nullable otherwise

**Cascade Rules:**
- Club deleted → CASCADE (delete CLUB announcements)
- Department deleted → CASCADE (delete DEPARTMENT announcements)
- `created_by` user deleted → RESTRICT

**Business Rules:**
- GLOBAL visibility: Super Admin only
- CLUB visibility: Club Head of specified club
- DEPARTMENT visibility: Department Head of specified department
- For DEPARTMENT visibility, server must derive `club_id` from department's club

**Query Logic:**
- Filter announcements visible to user:
  ```sql
  WHERE visibility = 'GLOBAL'
  OR (visibility = 'CLUB' AND club_id IN (user's clubs))
  OR (visibility = 'DEPARTMENT' AND department_id IN (user's departments))
  ```

---

## Database Relationships Summary

### One-to-Many Relationships

| Parent Table | Child Table | Foreign Key | Cascade |
|---|---|---|---|
| users | club_creation_requests | requested_by | RESTRICT |
| users | club_creation_requests | reviewed_by | SET NULL |
| users | club_memberships | user_id | CASCADE |
| users | department_memberships | user_id | CASCADE |
| users | events | requested_by | RESTRICT |
| users | events | reviewed_by | SET NULL |
| users | projects | created_by | RESTRICT |
| users | blogs | author_id | RESTRICT |
| users | announcements | created_by | RESTRICT |
| clubs | club_memberships | club_id | CASCADE |
| clubs | departments | club_id | CASCADE |
| clubs | events | club_id | CASCADE |
| clubs | projects | club_id | CASCADE |
| clubs | blogs | club_id | CASCADE |
| clubs | announcements | club_id | CASCADE |
| departments | department_memberships | department_id | CASCADE |
| departments | projects | department_id | SET NULL |
| departments | blogs | department_id | SET NULL |
| departments | announcements | department_id | CASCADE |
| events | event_registrations | event_id | CASCADE |


### One-to-One Relationships

| Table | Column | References | Constraint |
|---|---|---|---|
| clubs | faculty_coordinator_id | users(id) | UNIQUE (one coordinator per club) |
| departments | head_user_id | users(id) | NOT UNIQUE (user can head multiple depts) |

### Many-to-Many Relationships

| Relationship | Junction Table | Unique Constraint |
|---|---|---|
| Users ↔ Clubs | club_memberships | (user_id, club_id) |
| Users ↔ Departments | department_memberships | (user_id, department_id) |
| Users ↔ Events | event_registrations | (event_id, user_id) |

---

## Key Business Rule Enforcement

### Database-Level Enforcement

**Unique Constraints:**
- User email (users.email)
- Club name case-insensitive (functional index on LOWER(clubs.name))
- Faculty Coordinator uniqueness (clubs.faculty_coordinator_id)
- Department name per club case-insensitive (functional index)
- User-club membership pairs (club_memberships)
- User-department membership pairs (department_memberships)
- Event registration pairs (event_registrations)

**Check Constraints:**
- Event capacity > 0 if not null
- Event end_time > start_time

**Foreign Key Cascades:**
- Club deleted → cascade to memberships, departments, events, projects
- User deleted from club → cascade to department memberships in that club
- Department deleted → SET NULL on projects/blogs, CASCADE on announcements

### Application-Level Enforcement

**Required Business Logic:**
- Exactly one Club Head per club (query before delete/demote)
- At least one SUPER_ADMIN user platform-wide (query before role change)
- Department membership requires club membership first
- Can only register for APPROVED events
- Check event capacity before registration
- Can only edit PENDING or REJECTED events
- Club name uniqueness is case-insensitive
- Department name uniqueness per club is case-insensitive

---

## Indexing Strategy

### Performance Indexes

**High-frequency queries:**
- User lookup by email: `idx_users_email` (unique)
- Club membership lookups: `idx_club_memberships_club_id`, `idx_club_memberships_user_id`
- Event filtering: `idx_events_status_type` (composite)
- Search queries: `idx_blogs_tags` (GIN index for array search)

**List/pagination queries:**
- Events by start time: `idx_events_start_time`
- Blogs by published date: `idx_blogs_published_at`
- Announcements by created date: `idx_announcements_created_at`

**Foreign key indexes:**
- All foreign key columns indexed for JOIN performance
- Composite indexes where filtering by multiple columns is common

---

## Data Types Reference

| Type | Usage | Notes |
|---|---|---|
| UUID | All primary keys, foreign keys | gen_random_uuid() |
| VARCHAR(n) | Short strings with length limit | name, email, title, URLs |
| TEXT | Long content | description, content, reason |
| TEXT[] | String arrays | tags, tech_stack, contributors |
| JSONB | Structured JSON | social_links |
| INTEGER | Numeric values | capacity, counts |
| TIMESTAMP | Date/time fields | created_at, updated_at, timestamps |
| ENUM | Constrained values | roles, statuses, visibility |

---

## PostgreSQL Schema Complete

This completes the PostgreSQL database schema for CampusOS MVP. All tables, relationships, constraints, indexes, and cascade rules are defined above.

**Schema Statistics:**
- **12 tables** (users, club_creation_requests, clubs, club_memberships, departments, department_memberships, events, event_registrations, projects, blogs, announcements)
- **8 enums** (PlatformRole, ClubRole, ClubStatus, RequestStatus, EventType, EventStatus, ProjectStatus, AnnouncementVisibility)
- **45+ indexes** (unique, foreign key, composite, GIN)
- **30+ foreign key relationships** with explicit cascade behavior

The schema enforces referential integrity, supports efficient queries, and aligns with MVP scope constraints.

# Appendix: Implementation Corrections

## Correction 1: `ClubMembership.department` still contains a removed `head` field

Affected Section:
`## 2. Common Data Objects` → `### AuthUser` (the `clubMemberships[].department` example)

Problem:
The `department` object nested inside `clubMemberships[]` still shows `"head": { "id": "uuid" }` alongside `id` and `name`.

Source of Truth:
`FINAL_API_CONTRACT.md` §6.2, "`ClubMembership.department` — Final Shape" — this section explicitly overrides the earlier draft and states `department` is finalized as `id` + `name` only, with `head` dropped.

Correct Implementation:
```json
"department": {
  "id": "uuid",
  "name": "Web Dev"
}
```
`department` remains `null` when the membership isn't tied to a specific department. No `head` key is returned under any circumstance.

Implementation Impact:
- Backend: the `GET /auth/me` serializer (and any shared `AuthUser`/`ClubMembership` mapper) must not select or return `head_user_id`-derived data inside this nested object.
- Frontend: the client-side "Department Head" derivation described elsewhere in source (comparing `department.head.id === user.id`) can no longer work from this object. Per §6.2's own note, the frontend needs an alternate source (e.g. comparing against `Department.headUserId` from `GET /departments/:id`) if that behavior is still required. Flag this to whoever owns permission-based UI rendering.

---

## Correction 2: `GET /events/:id` is missing `rejectionReason`

Affected Section:
`## 8. Events Module` → `### GET /events/:id`

Problem:
The success response example returns `id, clubId, title, description, location, type, capacity, registeredCount, startTime, endTime, status, requestedBy, reviewedBy, createdAt` but omits `rejectionReason`.

Source of Truth:
`FINAL_API_CONTRACT.md` §6.5, "`rejectionReason` on `GET /events/:id`" — explicitly adds this field to the detail response.

Correct Implementation:
Add `"rejectionReason": "string | null"` to the response object, alongside the existing fields. It is `null` unless `status` is `REJECTED`.

Implementation Impact:
- Backend: include `rejection_reason` in the Prisma `select`/mapping for this endpoint's detail response.
- Frontend: the Event Detail page needs this field to show the rejection reason before a Club Head edits/resubmits a rejected event — this is a real, stated UX dependency, not an optional addition.

---

## Correction 3: `GET /events/:id/registrations` is missing `email`

Affected Section:
`## 8. Events Module` → `### GET /events/:id/registrations`

Problem:
Each item in `items[]` is documented as `{ userId, name, registeredAt }`.

Source of Truth:
`FINAL_API_CONTRACT.md` §6.6, "`GET /events/:id/registrations` — Final Shape" — finalizes the shape as `{ userId, name, email, registeredAt }`. (`department` and `phone` are explicitly excluded — do not add those.)

Correct Implementation:
```json
{ "userId": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "registeredAt": "2026-01-10T09:00:00Z" }
```

Implementation Impact:
- Backend: add `email` to the query/select for this endpoint. This endpoint is already restricted to Club Head/Faculty Coordinator of the event's club, so no new exposure risk is introduced by adding it.
- Frontend: the registrant list view can now show/use email for contacting registrants.

---

## Correction 4: Department Head over-authorized on Project and Blog edit/delete

Affected Section:
`## 9. Projects Module` → `### PATCH /projects/:id`, `### DELETE /projects/:id`
`## 10. Blogs Module` → `### PATCH /blogs/:id`, `### DELETE /blogs/:id`

Problem:
All four endpoints list authentication as "Club Head or Department Head (of project's/blog's club), or project creator / blog author." Department Head is not an authorized editor or deleter for either entity in the frozen source.

Source of Truth:
`FINAL_API_CONTRACT.md` — "Edit Project" / "Delete Project": *"The project's creator, or the club's Club Head."* "Edit Blog" / "Delete Blog": *"The blog's author, or the club's Club Head."* `FINAL_TEAM_BUILD_GUIDE.md`'s Projects/Blogs Module Permissions state the same: *"edit/delete = creator or Club Head."*

Correct Implementation:
- `PATCH /projects/:id`, `DELETE /projects/:id`: authorized callers are the project's creator, or the club's Club Head — **no Department Head path**.
- `PATCH /blogs/:id`, `DELETE /blogs/:id`: authorized callers are the blog's author, or the club's Club Head — **no Department Head path**.

Implementation Impact:
- Backend: remove any Department Head check from these four route handlers/middleware. This matters beyond a documentation nit — if `authorizeClubRole` is reused here with a club-wide "heads any department in this club" check (see the related `ARCHITECTURE.md` correction), a Department Head could wrongly edit or delete another department's project or blog post within the same club.
- Frontend: hide edit/delete controls on Project/Blog pages for users who are only a Department Head (not the creator/author and not Club Head).

---

## Correction 5: `POST /announcements` — GLOBAL validation and missing error cases

Affected Section:
`## 11. Announcements Module` → `### POST /announcements`

Problem:
Validation notes state `clubId: ... ignored for GLOBAL`, and the Error Responses list shows only `403`.

Source of Truth:
`FINAL_API_CONTRACT.md`, Announcements Module, Auth State Rules: *"visibility = GLOBAL: Requires Role: SUPER_ADMIN. clubId and departmentId must be null."* Error Responses list: `400` for the three specific validation cases plus `403`. `FINAL_TEAM_BUILD_GUIDE.md` Announcements Module Validation Rules confirm the same three `400` cases.

Correct Implementation:
- A `GLOBAL` request carrying a non-null `clubId` or `departmentId` must be **rejected with `400`**, not silently ignored.
- Document all three `400` cases explicitly:

400   GLOBAL sent with a non-null clubId/departmentId
400   CLUB sent without clubId
400   DEPARTMENT sent without departmentId
403   Caller lacks the required scope for the chosen visibility

Implementation Impact:
- Backend: add explicit validation that fails a GLOBAL request if `clubId`/`departmentId` are present, rather than dropping/ignoring those fields. This is a behavioral change, not just documentation — implementing "ignored" as currently written would silently accept malformed requests.
- Frontend: the Create Announcement form/error handling should expect and surface these three distinct `400` messages, not just `403`.

---

## Correction 6: Department Head over-authorized on `DELETE /announcements/:id`

Affected Section:
`## 11. Announcements Module` → `### DELETE /announcements/:id`

Problem:
Authentication is documented as "Announcement creator, or moderator (Club Head for CLUB, Department Head for DEPARTMENT, Super Admin for GLOBAL)," and the Business Rule section repeats "Department Head can delete DEPARTMENT announcements from their department."

Source of Truth:
`FINAL_API_CONTRACT.md`, "Delete Announcement": *"The announcement's creator, Role: `SUPER_ADMIN`, or the Club Head of the announcement's club."* No Department Head deletion path exists for any visibility level, including DEPARTMENT.

Correct Implementation:
Authorized deleters for any announcement, regardless of visibility, are: the announcement's creator, a Super Admin, or the Club Head of the announcement's club. Remove the Department Head moderator path entirely.

Implementation Impact:
- Backend: remove the Department Head branch from the delete-authorization check. A DEPARTMENT-visibility announcement can still be deleted by its creator, a Super Admin, or that department's club's Club Head — just not by the Department Head acting as moderator.
- Frontend: hide the delete control on the Announcement Feed for users who are only a Department Head (not the creator, Super Admin, or Club Head of that announcement's club).

---

## Correction 7: Introduction overstates Prisma schema readiness

Affected Section:
`## Introduction`

Problem:
States the document provides *"Prisma ORM schema definitions ready for implementation"*, but Part 4 (Database Schema) contains only raw PostgreSQL DDL (`CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX`) — no Prisma `model`/`generator`/`datasource` blocks appear anywhere in the file.

Source of Truth:
`FINAL_TEAM_BUILD_GUIDE.md`'s Database Setup section is itself expressed as table/field/constraint descriptions, not Prisma syntax either — so this document's raw-DDL content is a faithful translation of source, but the Introduction's own claim about *format* is inaccurate.

Correct Implementation:
Reword the Introduction's third bullet to: *"Complete PostgreSQL DDL (tables, enums, constraints, indexes), to be translated into `schema.prisma` syntax during backend setup."* Do not claim ready-to-use Prisma output unless actual `model` blocks are added.

Implementation Impact:
- Backend: whoever owns Day-1 setup must budget explicit time to hand-translate the 11 tables' DDL into `schema.prisma` — this is not a copy-paste step regardless of how the Introduction currently reads.

---

## Correction 8: `Club.socialLinks` closed key set not documented

Affected Section:
`## 2. Common Data Objects` → `### Club`

Problem:
`socialLinks` is shown only as a generic two-key example (`instagram`, `linkedin`) with no statement of a closed, validated key set.

Source of Truth:
`FINAL_API_CONTRACT.md` §6.3, "`Club.socialLinks` — Supported Keys" — finalizes the complete set as `instagram`, `linkedin`, `github`, `website`, and states other keys (e.g. `youtube`) must be rejected or ignored server-side.

Correct Implementation:
Add a note under the `Club` object: *"`socialLinks` accepts exactly these four keys: `instagram`, `linkedin`, `github`, `website`. Any other key must be rejected or ignored server-side. Each value must still match `https?://`."*

Implementation Impact:
- Backend: validation schema (e.g. the zod schema for `PATCH /clubs/:id`, `POST /clubs`) should whitelist exactly these four keys rather than accepting an arbitrary object.

---

## Correction 9: Table count stated as 12, actual count is 11

Affected Section:
Closing `## PostgreSQL Schema Complete` → **Schema Statistics**

Problem:
States "**12 tables**" and then lists 11 table names in the same sentence (`users, club_creation_requests, clubs, club_memberships, departments, department_memberships, events, event_registrations, projects, blogs, announcements`).

Source of Truth:
`FINAL_TEAM_BUILD_GUIDE.md`'s Database Setup section lists the same 11 tables.

Correct Implementation:
Change "**12 tables**" to "**11 tables**" (the listed names are already correct and complete — only the count number is wrong).

Implementation Impact:
- None beyond correcting the stated figure; no schema change is needed.