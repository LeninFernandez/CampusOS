# CampusOS API_CONTRACT.md

This document defines exactly how the CampusOS frontend and backend communicate. It is an API communication contract only — it does not restate feature requirements, architecture, or database implementation details beyond what's needed to shape a response. It is generated from, and must stay in sync with, `FINAL_TEAM_BUILD_GUIDE.md`.

Where the build guide didn't spell out an exact field name or nested shape, that item is marked **Needs confirmation** rather than invented.

---

# 1. API Overview

## Base URL

```
/api/v1
```

## Authentication

All protected routes require a JWT in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

- Public endpoints require no header.
- Any protected endpoint returns `401` if the header is missing, invalid, or the token has expired — this applies globally and isn't re-listed under every endpoint below.
- Endpoints restricted to a specific role or relationship (e.g. "Club Head of that club") return `403` when an authenticated caller doesn't meet the requirement, even on rows where the source table's error column didn't re-list `403` — the restriction itself is stated explicitly in the build guide's module Permissions, so this contract applies it consistently rather than only where the summary table happened to repeat it.
- Club-scoped, department-scoped, and faculty-coordinator roles are resolved fresh from the database on every request — the frontend must not assume a role from a cached JWT claim.

**Default authentication state behavior** (applies to every protected endpoint unless an endpoint's own section says otherwise):

| Caller | Result |
|---|---|
| Logged out | `401 Unauthorized` |
| Logged in, doesn't meet the endpoint's role/relationship requirement | `403 Forbidden` |
| Logged in, meets the requirement | Success response |

## Common Response Format

Every endpoint response follows one of these two envelopes.

Success:

```json
{
  "success": true,
  "message": "string",
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "message": "string",
  "errors": { "field": "message" }
}
```

`errors` is optional and appears only on field-level validation failures (`400`). Do not create custom response envelopes for individual endpoints.

## Global Status Codes

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

`500` is a generic server-error fallback and isn't listed per endpoint below.

## Pagination Format

Any endpoint whose route accepts `page`/`limit` query params follows this shape. Endpoints that don't list `page`/`limit` in their Query Parameters section return a plain `items[]` with no `pagination` object — don't add one.

Request:

```
?page=1&limit=20
```

Response (`data`):

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

---

# 2. Common Data Objects

## Conventions

**Naming:** field names are camelCase and identical across requests, responses, query params, and path params (e.g. always `clubId`, never `club_id` or `clubID`). This mirrors the field names used in the build guide's own Frontend API Reference, not the snake_case column names used internally in the database.

**Empty data:** collections are always returned as `[]`, never `null`. Optional single objects/fields are returned as `null` when absent, not omitted.

**List vs. detail shapes:** for Event, Project, Blog, and Announcement, the build guide's Frontend API Reference explicitly shows detail responses as "base object + extra named fields" (e.g. `GET /projects/:id` → *"project + githubLink, demoLink, contributors, createdBy"*). This contract treats that literally: the list endpoint for that entity returns a **Summary** object, and the detail endpoint returns that same Summary plus the extra fields named in the source. Don't fetch detail-only fields from a list response.

---

## User

Returned in different subsets depending on caller permission — see the specific endpoint for which subset applies.

**User (Minimal)** — non-admin caller of `GET /users`:
```json
{ "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu" }
```

**User (Admin View)** — Super Admin caller of `GET /users`, and `GET /users/:id`:
```json
{ "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "STUDENT", "createdAt": "2026-01-10T09:00:00Z" }
```

## AuthUser

Returned by `POST /auth/register`, `POST /auth/login`, and `GET /auth/me`.

```json
{ "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "STUDENT" }
```

`GET /auth/me` additionally includes `clubMemberships[]` (see below), since that's the call the frontend explicitly uses to hydrate memberships on app load.

**Needs confirmation:** whether `POST /auth/register` and `POST /auth/login` also include `clubMemberships[]` inline, or whether the frontend always relies on a separate `GET /auth/me` call for that. The build guide describes the hydration flow only for app load via `GET /auth/me`.

## ClubMembership (nested in AuthUser.clubMemberships[])

**Needs confirmation** — the build guide doesn't give this object a field table; the shape below is the minimum needed to support the two behaviors it explicitly describes: permission-gated UI by club role, and deriving Department Head status client-side from *"a club membership whose department has `head.id === user.id`"*.

```json
{
  "clubId": "uuid",
  "clubName": "Robotics Club",
  "role": "CLUB_HEAD",
  "department": {
    "id": "uuid",
    "name": "Web Dev",
    "head": { "id": "uuid" }
  }
}
```

`department` is `null` when the membership isn't tied to a specific department.

## ClubMember (nested in club members list)

`userId` and `role` aren't explicitly listed in the build guide's Response Data column for `GET /clubs/:id/members`, but are included here as the minimum needed to implement the page's own described actions (promote/demote/remove target a specific `userId`; the `MemberTable` displays a `RoleBadge`).

**Member view** (any club member):
```json
{ "userId": "uuid", "name": "Asha Rao", "role": "MEMBER" }
```

**Club Head / Super Admin view** (adds `email`):
```json
{ "userId": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "role": "MEMBER" }
```

## DepartmentMember (nested in department detail)

```json
{ "userId": "uuid", "name": "Asha Rao" }
```

## Club

```json
{
  "id": "uuid",
  "name": "Robotics Club",
  "description": "string",
  "facultyDetails": "string",
  "socialLinks": { "instagram": "https://instagram.com/...", "linkedin": "https://..." },
  "logoUrl": "https://... | null",
  "status": "ACTIVE",
  "facultyCoordinatorId": "uuid | null",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

**Needs confirmation:** the exact key set inside `socialLinks` (e.g. which platforms). The build guide only establishes that it's a JSON object whose values must each match `https?://`.

`GET /clubs/:id` (detail) returns this object plus `departments: [DepartmentSummary]` where `DepartmentSummary` is `{ "id": "uuid", "name": "string" }`. `GET /clubs` (list) returns this object without the `departments[]` nesting.

## Department

Used for both list and detail responses; `headUserId` is `null` until assigned.

```json
{
  "id": "uuid",
  "clubId": "uuid",
  "name": "Web Dev",
  "headUserId": "uuid | null",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

`GET /departments/:id` (detail) returns this object plus `members: [DepartmentMember]`.

## Event

**EventSummary** (used in `GET /events` list results and inside Search results):

```json
{
  "id": "uuid",
  "clubId": "uuid",
  "title": "Hack Night",
  "description": "string",
  "location": "string",
  "type": "PUBLIC",
  "capacity": 50,
  "registeredCount": 12,
  "startTime": "2026-08-01T18:00:00Z",
  "endTime": "2026-08-01T21:00:00Z",
  "status": "APPROVED",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

**Needs confirmation:** the exact field name for the registered-count value. The build guide's Event Detail page explicitly requires showing "registered count" alongside capacity, but doesn't give the response key — `registeredCount` above is the minimum inferred field to satisfy that stated requirement.

`GET /events/:id` (detail) returns EventSummary plus `requestedBy` and `reviewedBy` (both `uuid | null`), per the build guide's Response Data column. **Needs confirmation:** whether `rejectionReason` is also returned on the detail response — the database stores it and the frontend needs to show why an event was rejected before allowing edit/resubmit, but it isn't named in the Response Data column.

## Project

**ProjectSummary** (used in `GET /projects` list and Search results):

```json
{
  "id": "uuid",
  "clubId": "uuid",
  "departmentId": "uuid | null",
  "title": "Campus Nav App",
  "description": "string",
  "techStack": ["React", "Node.js"],
  "thumbnailUrl": "https://... | null",
  "status": "IN_PROGRESS",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

`GET /projects/:id` (detail) returns ProjectSummary plus `githubLink`, `demoLink`, `contributors` (`string[]`), and `createdBy` (`uuid`) — exactly the fields the build guide names as additive for the detail view.

## Blog

**BlogSummary** (used in `GET /blogs` list and Search results — excludes `content`):

```json
{
  "id": "uuid",
  "clubId": "uuid | null",
  "departmentId": "uuid | null",
  "title": "How We Won Hackathon X",
  "tags": ["hackathon", "robotics"],
  "thumbnailUrl": "https://... | null",
  "authorId": "uuid",
  "publishedAt": "2026-01-10T09:00:00Z"
}
```

`GET /blogs/:id` (detail) returns BlogSummary plus `content` — the build guide's Response Data column literally names the detail addition as *"full content"*.

## Announcement

**AnnouncementSummary** (used in `GET /announcements` feed — excludes `content`):

```json
{
  "id": "uuid",
  "title": "Midterm Break Notice",
  "visibility": "GLOBAL",
  "clubId": "uuid | null",
  "departmentId": "uuid | null",
  "createdBy": "uuid",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

`GET /announcements/:id` (detail) returns AnnouncementSummary plus `content`.

## ClubRequest

```json
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
```

`GET /club-requests/:id` (detail) additionally includes `reviewedBy` (`uuid | null`) and `rejectionReason` (`string | null`) — both are stored on the underlying record and relevant once a request has been reviewed.

## EventRegistrant (nested in `GET /events/:id/registrations`)

**Needs confirmation** — the build guide's Response Data column for this endpoint only says `items[], pagination` without a field list. Minimum shape to support the Faculty Approval Queue / Club Head "view registrations" use case:

```json
{ "userId": "uuid", "name": "Asha Rao", "registeredAt": "2026-01-10T09:00:00Z" }
```

## Pagination

```json
{ "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
```

---

# 3. Endpoint Inventory

```
Authentication:
* POST   /auth/register
* POST   /auth/login
* GET    /auth/me

Users:
* GET    /users
* GET    /users/:id
* PATCH  /users/:id/role

Club Requests:
* POST   /club-requests
* GET    /club-requests
* GET    /club-requests/:id
* PATCH  /club-requests/:id/approve
* PATCH  /club-requests/:id/reject
* DELETE /club-requests/:id

Clubs & Membership:
* POST   /clubs
* GET    /clubs
* GET    /clubs/:id
* PATCH  /clubs/:id
* PATCH  /clubs/:id/faculty-coordinator
* GET    /clubs/:id/members
* POST   /clubs/:id/members
* DELETE /clubs/:id/members/:userId
* PATCH  /clubs/:id/members/:userId/role
* POST   /clubs/:id/transfer-head

Departments:
* POST   /clubs/:id/departments
* GET    /clubs/:id/departments
* GET    /departments/:id
* PATCH  /departments/:id/head
* POST   /departments/:id/members
* DELETE /departments/:id/members/:userId

Events:
* POST   /clubs/:id/events
* PATCH  /clubs/:id/events/:eventId
* GET    /events
* GET    /events/:id
* PATCH  /events/:id/approve
* PATCH  /events/:id/reject
* POST   /events/:id/register
* DELETE /events/:id/register
* GET    /events/:id/registrations

Projects:
* POST   /clubs/:id/projects
* GET    /projects
* GET    /projects/:id
* PATCH  /projects/:id
* DELETE /projects/:id

Blogs:
* POST   /clubs/:id/blogs
* GET    /blogs
* GET    /blogs/:id
* PATCH  /blogs/:id
* DELETE /blogs/:id

Announcements:
* POST   /announcements
* GET    /announcements
* GET    /announcements/:id
* DELETE /announcements/:id

Search:
* GET    /search
```

52 endpoints total. Every endpoint above has a detailed section in Part 4; no section in Part 4 documents an endpoint outside this list.

---

# 4. API Reference

## Authentication Module

### Register

**Method:** `POST`
**Endpoint:** `/auth/register`
**Purpose:** Create a new Student account.
**Authentication:** Public

**Request Body:**
```json
{ "name": "Asha Rao", "email": "asha@example.edu", "password": "correct-horse-1" }
```
Validation: `name` 2–80 chars; `email` valid and unique; `password` ≥ 8 chars.

**Success Response — 201:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": { "user": { "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "STUDENT" }, "token": "jwt_token" }
}
```

**Error Responses:**
```
400   Field-level validation failure (name length, invalid email, weak password) — returned in `errors`
409   Email already registered
```

---

### Login

**Method:** `POST`
**Endpoint:** `/auth/login`
**Purpose:** Authenticate an existing user.
**Authentication:** Public

**Request Body:**
```json
{ "email": "asha@example.edu", "password": "correct-horse-1" }
```

**Success Response — 200:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": { "user": { "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "STUDENT" }, "token": "jwt_token" }
}
```

**Error Responses:**
```
400   Missing email or password
401   Invalid email or password — show this generic message regardless of whether the email or the password was wrong
```

---

### Get Current User

**Method:** `GET`
**Endpoint:** `/auth/me`
**Purpose:** Resolve the logged-in user's profile and club memberships, fresh from the database.
**Authentication:** Authenticated User

**Success Response — 200:**
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
      { "clubId": "uuid", "clubName": "Robotics Club", "role": "MEMBER", "department": null }
    ]
  }
}
```

**Error Responses:**
```
401   Missing/invalid/expired token — frontend clears the stored token and treats the user as logged out
```

**Auth State Rules:**
- Refetch this endpoint after any action that changes the current user's own role or club/department membership (transfer-head, role update, being added/removed from a club or department).
- On receiving any `403` elsewhere in the app, refetch this endpoint before surfacing the error — cached role/membership data may be stale.

**Frontend Dependency Notes**

```
Depends On:
(none)

Reason:
No prerequisite module — build Authentication first. Every other module's
protected endpoints depend on JWTs issued here.
```

---

## Users Module

### Search Users

**Method:** `GET`
**Endpoint:** `/users`
**Purpose:** Find users to add as club or department members.
**Authentication:** Role: `CLUB_HEAD`, `FACULTY_COORDINATOR`, or `SUPER_ADMIN`

**Query Parameters:**
```json
{ "search": "asha", "page": 1, "limit": 20 }
```
`search` is optional.

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu" } ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
  }
}
```
Super Admin callers additionally receive `platformRole` and `createdAt` per item.

**Error Responses:**
```
403   Caller is not a Club Head, Faculty Coordinator, or Super Admin
```

---

### Get One User

**Method:** `GET`
**Endpoint:** `/users/:id`
**Purpose:** View a single user's profile.
**Authentication:** Self, or Role: `SUPER_ADMIN`

**Path Parameters:**
```json
{ "id": "user_uuid" }
```

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": { "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "STUDENT", "createdAt": "2026-01-10T09:00:00Z" }
}
```

**Error Responses:**
```
403   Caller is neither the target user nor a Super Admin
404   User not found
```

---

### Change Platform Role

**Method:** `PATCH`
**Endpoint:** `/users/:id/role`
**Purpose:** Change a user's platform-wide role.
**Authentication:** Role: `SUPER_ADMIN`

**Path Parameters:**
```json
{ "id": "user_uuid" }
```

**Request Body:**
```json
{ "platformRole": "FACULTY_COORDINATOR" }
```

**Success Response — 200:**
```json
{
  "success": true,
  "message": "Role updated",
  "data": { "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "FACULTY_COORDINATOR" }
}
```

**Error Responses:**
```
400   Change would leave zero SUPER_ADMIN users on the platform — rejected
403   Caller is not a Super Admin
```

**Frontend Dependency Notes**

```
Depends On:
Not explicitly stated in FINAL_TEAM_BUILD_GUIDE.md — Needs confirmation.

Reason:
The Full Stack Team Tasks section doesn't call out a Users workflow with
explicit dependencies. Every endpoint in this module requires a logged-in
caller, so Authentication is a practical prerequisite even though it isn't
stated as one for this module specifically.
```

---

## Club Requests Module

### Submit Request

**Method:** `POST`
**Endpoint:** `/club-requests`
**Purpose:** Request creation of a new club.
**Authentication:** Authenticated User

**Request Body:**
```json
{ "clubName": "Robotics Club", "description": "string", "facultyDetails": "string", "reason": "string" }
```
Validation: all four fields required; `clubName` ≤ 100 chars.

**Success Response — 201:**
```json
{ "success": true, "message": "Request submitted", "data": { "id": "uuid", "status": "PENDING" } }
```

**Error Responses:**
```
400   Missing required field, or clubName over 100 chars
```

---

### List Requests

**Method:** `GET`
**Endpoint:** `/club-requests`
**Purpose:** List club creation requests for review.
**Authentication:** Role: `SUPER_ADMIN`

**Query Parameters:**
```json
{ "status": "PENDING", "page": 1, "limit": 20 }
```
`status` is optional (`PENDING` | `APPROVED` | `REJECTED`).

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "clubName": "Robotics Club", "description": "string", "facultyDetails": "string", "reason": "string", "requestedBy": "uuid", "status": "PENDING", "createdAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
  }
}
```

**Error Responses:**
```
403   Caller is not a Super Admin
```

---

### Get One Request

**Method:** `GET`
**Endpoint:** `/club-requests/:id`
**Purpose:** View a single club creation request.
**Authentication:** Role: `SUPER_ADMIN`, or the original requester

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": { "id": "uuid", "clubName": "Robotics Club", "description": "string", "facultyDetails": "string", "reason": "string", "requestedBy": "uuid", "status": "PENDING", "reviewedBy": null, "rejectionReason": null, "createdAt": "2026-01-10T09:00:00Z" }
}
```

**Error Responses:**
```
403   Caller is neither Super Admin nor the requester
404   Request not found
```

---

### Approve Request

**Method:** `PATCH`
**Endpoint:** `/club-requests/:id/approve`
**Purpose:** Approve a pending request, assign a Faculty Coordinator, and create the club atomically.
**Authentication:** Role: `SUPER_ADMIN`

**Request Body:**
```json
{ "facultyCoordinatorId": "uuid" }
```

**Success Response — 200:**
```json
{ "success": true, "message": "Request approved", "data": { "clubId": "uuid", "requestId": "uuid", "status": "APPROVED" } }
```

**Business Rules:**
- Only `PENDING` requests can be approved.
- Checked in order: duplicate club name (case-insensitive) → `409`; chosen `facultyCoordinatorId` already coordinating another club → `409`.
- On success, this creates the club (`status: ACTIVE`), creates a `club_memberships` row for the requester as `CLUB_HEAD`, and sets the request to `APPROVED` — all in a single transaction.

**Error Responses:**
```
400   Request is not PENDING
403   Caller is not a Super Admin
404   Request not found
409   Duplicate club name, or facultyCoordinatorId already coordinates another club
```

---

### Reject Request

**Method:** `PATCH`
**Endpoint:** `/club-requests/:id/reject`
**Purpose:** Reject a pending request with an optional reason.
**Authentication:** Role: `SUPER_ADMIN`

**Request Body:**
```json
{ "reason": "Duplicate of an existing club" }
```
`reason` is optional; stored in `rejection_reason` when present.

**Success Response — 200:**
```json
{ "success": true, "message": "Request rejected", "data": { "id": "uuid", "status": "REJECTED" } }
```

**Error Responses:**
```
400   Request is not PENDING
403   Caller is not a Super Admin
404   Request not found
```

---

### Withdraw Request

**Method:** `DELETE`
**Endpoint:** `/club-requests/:id`
**Purpose:** Withdraw your own pending request.
**Authentication:** The original requester, only while the request is `PENDING`

**Success Response — 200:**
```json
{ "success": true, "message": "Request withdrawn", "data": {} }
```

**Error Responses:**
```
400   Request is not PENDING
403   Caller is not the requester
```

**Frontend Dependency Notes**

```
Depends On:
Authentication

Reason:
Stated explicitly in the build guide's Full Stack Team Tasks as part of the
"Club Creation Workflow," which bundles this module with Clubs.
```

---

## Clubs & Membership Module

### Create Club Directly

**Method:** `POST`
**Endpoint:** `/clubs`
**Purpose:** Create a club directly, bypassing the request/approval flow.
**Authentication:** Role: `SUPER_ADMIN`

**Request Body:**
```json
{
  "name": "Robotics Club",
  "description": "string",
  "facultyDetails": "string",
  "facultyCoordinatorId": "uuid",
  "clubHeadUserId": "uuid",
  "socialLinks": { "instagram": "https://instagram.com/..." },
  "logoUrl": "https://..."
}
```
`socialLinks` and `logoUrl` are optional. Validation: `name` required and unique; `facultyCoordinatorId` (if set) must not already coordinate another club; `clubHeadUserId` must be an existing user.

**Success Response — 201:**
```json
{ "success": true, "message": "Club created", "data": { "id": "uuid", "name": "Robotics Club", "description": "string", "facultyDetails": "string", "socialLinks": {}, "logoUrl": null, "status": "ACTIVE", "facultyCoordinatorId": "uuid", "createdAt": "2026-01-10T09:00:00Z" } }
```

**Error Responses:**
```
400   Missing required field, invalid logoUrl/socialLinks URL, or clubHeadUserId doesn't exist
409   Duplicate club name, or facultyCoordinatorId already coordinates another club
```
**Needs confirmation:** the build guide's error column for this row lists only `400, 409` without spelling out exactly which validation failures map to which code beyond what's shown above; the mapping here follows the same duplicate-name/coordinator-conflict → `409` pattern used explicitly elsewhere (approval flow, `PATCH /clubs/:id/faculty-coordinator`).

---

### List Clubs

**Method:** `GET`
**Endpoint:** `/clubs`
**Purpose:** Browse/search all clubs.
**Authentication:** Public

**Query Parameters:**
```json
{ "search": "robotics", "page": 1, "limit": 20 }
```
`search` is optional.

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "name": "Robotics Club", "description": "string", "facultyDetails": "string", "socialLinks": {}, "logoUrl": null, "status": "ACTIVE", "facultyCoordinatorId": "uuid", "createdAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
  }
}
```

**Error Responses:** none.

---

### Get One Club

**Method:** `GET`
**Endpoint:** `/clubs/:id`
**Purpose:** View a club's public profile, including its departments.
**Authentication:** Public

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid", "name": "Robotics Club", "description": "string", "facultyDetails": "string",
    "socialLinks": {}, "logoUrl": null, "status": "ACTIVE", "facultyCoordinatorId": "uuid", "createdAt": "2026-01-10T09:00:00Z",
    "departments": [ { "id": "uuid", "name": "Web Dev" } ]
  }
}
```

**Error Responses:**
```
404   Club not found
```

---

### Edit Club Info

**Method:** `PATCH`
**Endpoint:** `/clubs/:id`
**Purpose:** Edit a club's description, faculty details, social links, or logo.
**Authentication:** Club Head (own club), or Role: `SUPER_ADMIN`

**Request Body** (all fields optional):
```json
{ "description": "string", "facultyDetails": "string", "socialLinks": {}, "logoUrl": "https://..." }
```

**Success Response — 200:** updated Club object (see Common Data Objects).

**Error Responses:**
```
403   Caller is neither this club's Club Head nor a Super Admin
```

---

### Reassign Faculty Coordinator

**Method:** `PATCH`
**Endpoint:** `/clubs/:id/faculty-coordinator`
**Purpose:** Change the club's assigned Faculty Coordinator.
**Authentication:** Role: `SUPER_ADMIN`

**Request Body:**
```json
{ "facultyCoordinatorId": "uuid" }
```

**Success Response — 200:** updated Club object.

**Error Responses:**
```
403   Caller is not a Super Admin
409   Target user already coordinates another club — enforced via a unique constraint on faculty_coordinator_id
```

---

### List Club Members

**Method:** `GET`
**Endpoint:** `/clubs/:id/members`
**Purpose:** List a club's roster.
**Authentication:** Authenticated club member (any role), or Role: `SUPER_ADMIN`

**Query Parameters:**
```json
{ "page": 1, "limit": 20 }
```

**Success Response — 200:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [ { "userId": "uuid", "name": "Asha Rao", "role": "MEMBER" } ],
    "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
  }
}
```
Club Head or Super Admin callers receive `email` on each item as well (see ClubMember in Common Data Objects).

**Error Responses:**
```
403   Caller is authenticated but not a member of this club (and not Super Admin)
```

---

### Add Member

**Method:** `POST`
**Endpoint:** `/clubs/:id/members`
**Purpose:** Add an existing user to the club as a Member.
**Authentication:** Club Head (own club)

**Request Body:**
```json
{ "userId": "uuid" }
```

**Success Response — 201:**
```json
{ "success": true, "message": "Member added", "data": { "userId": "uuid", "clubId": "uuid", "role": "MEMBER" } }
```

**Error Responses:**
```
403   Caller is not this club's Club Head
404   userId doesn't exist
409   User is already a member of this club
```

---

### Remove Member / Leave Club

**Method:** `DELETE`
**Endpoint:** `/clubs/:id/members/:userId`
**Purpose:** Remove a member, or leave the club yourself.
**Authentication:** Club Head (own club), or the member removing themself

**Success Response — 200:**
```json
{ "success": true, "message": "Member removed", "data": {} }
```

**Error Responses:**
```
400   Target is the sole remaining Club Head — rejected, "cannot remove sole Club Head"
403   Caller is neither this club's Club Head nor the member themself
404   userId is not a member of this club
```

---

### Demote Member

**Method:** `PATCH`
**Endpoint:** `/clubs/:id/members/:userId/role`
**Purpose:** Demote a Club Head or Member back to Member. This endpoint can only set `MEMBER` — promotion to Club Head only happens via transfer-head.
**Authentication:** Club Head (own club)

**Request Body:**
```json
{ "role": "MEMBER" }
```

**Success Response — 200:**
```json
{ "success": true, "message": "Role updated", "data": { "userId": "uuid", "clubId": "uuid", "role": "MEMBER" } }
```

**Error Responses:**
```
400   role value other than MEMBER was supplied
403   Caller is not this club's Club Head
```

---

### Transfer Club Head

**Method:** `POST`
**Endpoint:** `/clubs/:id/transfer-head`
**Purpose:** Atomically demote the outgoing Club Head and promote the incoming one.
**Authentication:** Role: `SUPER_ADMIN`

**Request Body:**
```json
{ "newClubHeadUserId": "uuid" }
```

**Success Response — 200:**
```json
{ "success": true, "message": "Club Head transferred", "data": { "clubId": "uuid", "newClubHeadUserId": "uuid" } }
```

**Error Responses:**
```
403   Caller is not a Super Admin
404   Club or target user not found
```

**Frontend Dependency Notes**

```
Depends On:
Authentication

Reason:
Stated explicitly in the build guide's Full Stack Team Tasks as part of the
"Club Creation Workflow."
```

---

## Departments Module

### Create Department

**Method:** `POST`
**Endpoint:** `/clubs/:id/departments`
**Purpose:** Create a department inside a club.
**Authentication:** Club Head (own club)

**Request Body:**
```json
{ "name": "Web Dev" }
```
Validation: unique per club, case-insensitive, 2–50 chars.

**Success Response — 201:**
```json
{ "success": true, "message": "Department created", "data": { "id": "uuid", "clubId": "uuid", "name": "Web Dev" } }
```

**Error Responses:**
```
403   Caller is not this club's Club Head
409   Department name already exists in this club (case-insensitive)
```

---

### List Departments

**Method:** `GET`
**Endpoint:** `/clubs/:id/departments`
**Purpose:** List a club's departments.
**Authentication:** Public

**Success Response — 200:**
```json
{ "success": true, "message": "OK", "data": { "items": [ { "id": "uuid", "clubId": "uuid", "name": "Web Dev", "headUserId": null, "createdAt": "2026-01-10T09:00:00Z" } ] } }
```
No `page`/`limit` params on this route in the source, so no `pagination` object is returned.

**Error Responses:** none.

---

### Get One Department

**Method:** `GET`
**Endpoint:** `/departments/:id`
**Purpose:** View one department's members and head.
**Authentication:** Club Head (owning club), that department's Head, or Role: `SUPER_ADMIN`

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": { "id": "uuid", "clubId": "uuid", "name": "Web Dev", "headUserId": "uuid", "createdAt": "2026-01-10T09:00:00Z", "members": [ { "userId": "uuid", "name": "Asha Rao" } ] }
}
```

**Error Responses:**
```
403   Caller is not this club's Club Head, this department's Head, or a Super Admin
404   Department not found
```

---

### Set / Clear Department Head

**Method:** `PATCH`
**Endpoint:** `/departments/:id/head`
**Purpose:** Assign or clear the department's head. The head must already be a department member.
**Authentication:** Club Head (owning club)

**Request Body:**
```json
{ "userId": "uuid" }
```
Pass `userId: null` to clear the head.

**Success Response — 200:** updated Department object.

**Error Responses:**
```
400   Target user is not already a department member
403   Caller is not this club's Club Head
```

---

### Add Department Member

**Method:** `POST`
**Endpoint:** `/departments/:id/members`
**Purpose:** Add a club member to the department.
**Authentication:** Club Head (owning club), or that department's Head

**Request Body:**
```json
{ "userId": "uuid" }
```
Validation: `userId` must already be a member of the department's club.

**Success Response — 201:**
```json
{ "success": true, "message": "Member added", "data": { "userId": "uuid", "departmentId": "uuid" } }
```

**Error Responses:**
```
400   User must be a club member first
403   Caller is neither this club's Club Head nor this department's Head
409   User is already a member of this department
```

---

### Remove Department Member

**Method:** `DELETE`
**Endpoint:** `/departments/:id/members/:userId`
**Purpose:** Remove a member from the department.
**Authentication:** Club Head (owning club), or that department's Head

**Success Response — 200:**
```json
{ "success": true, "message": "Member removed", "data": {} }
```
If the removed member was the department's head, `headUserId` is cleared as a side effect.

**Error Responses:**
```
403   Caller is neither this club's Club Head nor this department's Head
```

**Frontend Dependency Notes**

```
Depends On:
Not explicitly stated as a standalone workflow dependency in
FINAL_TEAM_BUILD_GUIDE.md — Needs confirmation.

Reason:
Departments belong to clubs at the schema level (departments.club_id is a
required FK), so the Clubs module must exist first. The build guide states
this implicitly through the schema rather than through an explicit ordering
statement like the ones given for other modules. The Announcements workflow
does explicitly list "Clubs and Departments" as its own dependency, which
confirms Departments should be complete before Announcements.
```

---

## Events Module

### Request New Event

**Method:** `POST`
**Endpoint:** `/clubs/:id/events`
**Purpose:** Submit a new event for Faculty Coordinator approval.
**Authentication:** Club Head (own club)

**Request Body:**
```json
{ "title": "Hack Night", "description": "string", "type": "PUBLIC", "capacity": 50, "location": "string", "startTime": "2026-08-01T18:00:00Z", "endTime": "2026-08-01T21:00:00Z" }
```
`capacity` is optional (`null` = unlimited). Validation: `endTime` must be after `startTime`; `capacity` must be `null` or `> 0`; `type` ∈ `PUBLIC | CLUB_EXCLUSIVE`.

**Success Response — 201:**
```json
{ "success": true, "message": "Event requested", "data": { "id": "uuid", "status": "PENDING" } }
```

**Error Responses:**
```
400   endTime not after startTime, or capacity <= 0
403   Caller is not this club's Club Head
```

---

### Edit Event

**Method:** `PATCH`
**Endpoint:** `/clubs/:id/events/:eventId`
**Purpose:** Edit a `PENDING` or `REJECTED` event. Editing resets its status to `PENDING`. `APPROVED` events cannot be edited.
**Authentication:** Club Head (own club)

**Request Body:** any field from Request New Event, e.g.:
```json
{ "title": "Hack Night v2", "capacity": 80 }
```

**Success Response — 200:** updated Event object with `status` reset to `"PENDING"`.

**Error Responses:**
```
400   Validation failure (same rules as create), or event status is APPROVED
403   Caller is not this club's Club Head
```

---

### List Events

**Method:** `GET`
**Endpoint:** `/events`
**Purpose:** Browse approved events.
**Authentication:** Public — visibility varies by caller (see Auth State Rules)

**Query Parameters:**
```json
{ "search": "hack", "status": "APPROVED", "type": "PUBLIC", "clubId": "uuid", "page": 1, "limit": 20 }
```
All optional. The Faculty Approval Queue page uses `status=PENDING&clubId=` specifically.

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "clubId": "uuid", "title": "Hack Night", "description": "string", "location": "string", "type": "PUBLIC", "capacity": 50, "registeredCount": 12, "startTime": "2026-08-01T18:00:00Z", "endTime": "2026-08-01T21:00:00Z", "status": "APPROVED", "createdAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 6, "totalPages": 1 }
  }
}
```

**Error Responses:** none listed.

**Auth State Rules:**
```
Logged out:
Returns only PUBLIC, APPROVED events.

Logged in:
Additionally returns APPROVED CLUB_EXCLUSIVE events for clubs the caller
belongs to.
```

---

### Get One Event

**Method:** `GET`
**Endpoint:** `/events/:id`
**Purpose:** View one event's full details.
**Authentication:** Public

**Success Response — 200:** EventSummary plus `requestedBy` and `reviewedBy` (see Common Data Objects).

**Error Responses:**
```
404   Event not found
```

---

### Approve Event

**Method:** `PATCH`
**Endpoint:** `/events/:id/approve`
**Purpose:** Approve a pending event.
**Authentication:** Faculty Coordinator (of that club)

**Success Response — 200:**
```json
{ "success": true, "message": "Event approved", "data": { "id": "uuid", "status": "APPROVED" } }
```

**Error Responses:**
```
400   Event is not PENDING
403   Caller is not the Faculty Coordinator of this club
```

---

### Reject Event

**Method:** `PATCH`
**Endpoint:** `/events/:id/reject`
**Purpose:** Reject a pending event, optionally with a reason.
**Authentication:** Faculty Coordinator (of that club)

**Request Body:**
```json
{ "reason": "Conflicts with the midterm schedule" }
```
`reason` is optional; stored in `rejection_reason` when present.

**Success Response — 200:**
```json
{ "success": true, "message": "Event rejected", "data": { "id": "uuid", "status": "REJECTED" } }
```

**Error Responses:**
```
400   Event is not PENDING
403   Caller is not the Faculty Coordinator of this club
```

---

### Register for Event

**Method:** `POST`
**Endpoint:** `/events/:id/register`
**Purpose:** Register the caller for an approved event.
**Authentication:** Authenticated User

**Success Response — 201:**
```json
{ "success": true, "message": "Registered", "data": { "eventId": "uuid", "userId": "uuid" } }
```

**Business Rules:** the capacity check and the registration insert happen inside a single database transaction — never implemented as a separate read-then-write, to avoid overbooking under concurrent requests.

**Error Responses:**
```
400   Event is full, or not APPROVED
403   Event is CLUB_EXCLUSIVE and caller is not a member of that club
409   Caller is already registered for this event
```

---

### Unregister from Event

**Method:** `DELETE`
**Endpoint:** `/events/:id/register`
**Purpose:** Cancel the caller's own registration.
**Authentication:** Authenticated User (self)

**Success Response — 200:**
```json
{ "success": true, "message": "Unregistered", "data": {} }
```

**Error Responses:**
```
404   Caller is not registered for this event
```

---

### List Registrants

**Method:** `GET`
**Endpoint:** `/events/:id/registrations`
**Purpose:** View who has registered for an event.
**Authentication:** Club Head or Faculty Coordinator (of that club)

**Query Parameters:**
```json
{ "page": 1, "limit": 20 }
```

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": {
    "items": [ { "userId": "uuid", "name": "Asha Rao", "registeredAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
  }
}
```
See EventRegistrant in Common Data Objects — exact field set is **Needs confirmation**.

**Error Responses:**
```
403   Caller is neither this club's Club Head nor its Faculty Coordinator
```

**Frontend Dependency Notes**

```
Depends On:
Club Creation Workflow (Club Requests + Clubs modules)

Reason:
Stated explicitly in the build guide's Full Stack Team Tasks: events belong
to clubs and are requested by a Club Head, so clubs must exist first.
```

---

## Projects Module

### Publish Project

**Method:** `POST`
**Endpoint:** `/clubs/:id/projects`
**Purpose:** Publish a project under a club.
**Authentication:** Club Head or Department Head (of that club)

**Request Body:**
```json
{
  "title": "Campus Nav App", "description": "string", "techStack": ["React", "Node.js"],
  "githubLink": "https://github.com/...", "demoLink": "https://...", "thumbnailUrl": "https://...",
  "contributors": ["Asha Rao"], "status": "IN_PROGRESS", "departmentId": "uuid"
}
```
`departmentId` is optional; if set, it must belong to the same club. Validation: `title`, `description` required; all URL fields must match `https?://`.

**Success Response — 201:**
```json
{ "success": true, "message": "Project published", "data": { "id": "uuid" } }
```

**Error Responses:**
```
400   Missing title/description, or departmentId belongs to a different club
403   Caller is neither this club's Club Head nor a Department Head of this club
```

---

### List Projects

**Method:** `GET`
**Endpoint:** `/projects`
**Purpose:** Browse all projects.
**Authentication:** Public

**Query Parameters:**
```json
{ "search": "nav", "clubId": "uuid", "page": 1, "limit": 20 }
```
All optional.

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "clubId": "uuid", "departmentId": null, "title": "Campus Nav App", "description": "string", "techStack": ["React"], "thumbnailUrl": null, "status": "IN_PROGRESS", "createdAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 9, "totalPages": 1 }
  }
}
```

**Error Responses:** none.

---

### Get One Project

**Method:** `GET`
**Endpoint:** `/projects/:id`
**Purpose:** View a project's full details.
**Authentication:** Public

**Success Response — 200:** ProjectSummary plus `githubLink`, `demoLink`, `contributors`, `createdBy` (see Common Data Objects).

**Error Responses:**
```
404   Project not found
```

---

### Edit Project

**Method:** `PATCH`
**Endpoint:** `/projects/:id`
**Purpose:** Edit a project.
**Authentication:** The project's creator, or the club's Club Head

**Request Body:** any field from Publish Project.

**Success Response — 200:** updated Project object (full, including detail-only fields).

**Error Responses:**
```
403   Caller is neither the creator nor this club's Club Head
```

---

### Delete Project

**Method:** `DELETE`
**Endpoint:** `/projects/:id`
**Purpose:** Delete a project.
**Authentication:** The project's creator, or the club's Club Head

**Success Response — 200:**
```json
{ "success": true, "message": "Project deleted", "data": {} }
```

**Error Responses:**
```
403   Caller is neither the creator nor this club's Club Head
```

**Frontend Dependency Notes**

```
Depends On:
Not explicitly stated as its own workflow in FINAL_TEAM_BUILD_GUIDE.md —
Needs confirmation.

Reason:
The Search workflow's dependencies explicitly require "Clubs, Events,
Projects, and Blogs modules must be functionally complete first," which
confirms Projects must precede Search, but no explicit prerequisite is
given for Projects itself beyond needing a club to publish under.
```

---

## Blogs Module

### Publish Blog

**Method:** `POST`
**Endpoint:** `/clubs/:id/blogs`
**Purpose:** Publish a blog post under a club. There is no draft state in MVP — `publishedAt` is set at creation.
**Authentication:** Club Head or Department Head (of that club)

**Request Body:**
```json
{ "title": "How We Won Hackathon X", "content": "string", "tags": ["hackathon", "robotics"], "thumbnailUrl": "https://...", "departmentId": "uuid" }
```
`departmentId` is optional. Validation: `title`, `content` required.

**Success Response — 201:**
```json
{ "success": true, "message": "Blog published", "data": { "id": "uuid" } }
```

**Error Responses:**
```
400   Missing title or content
403   Caller is neither this club's Club Head nor a Department Head of this club
```

---

### List Blogs

**Method:** `GET`
**Endpoint:** `/blogs`
**Purpose:** Browse all blog posts.
**Authentication:** Public

**Query Parameters:**
```json
{ "search": "hackathon", "clubId": "uuid", "tag": "robotics", "page": 1, "limit": 20 }
```
All optional.

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "clubId": "uuid", "departmentId": null, "title": "How We Won Hackathon X", "tags": ["hackathon"], "thumbnailUrl": null, "authorId": "uuid", "publishedAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
  }
}
```

**Error Responses:** none.

---

### Get One Blog

**Method:** `GET`
**Endpoint:** `/blogs/:id`
**Purpose:** Read a blog post in full.
**Authentication:** Public

**Success Response — 200:** BlogSummary plus `content` (see Common Data Objects).

**Error Responses:**
```
404   Blog not found
```

---

### Edit Blog

**Method:** `PATCH`
**Endpoint:** `/blogs/:id`
**Purpose:** Edit a blog post.
**Authentication:** The blog's author, or the club's Club Head

**Request Body:** any field from Publish Blog.

**Success Response — 200:** updated Blog object (full, including `content`).

**Error Responses:**
```
403   Caller is neither the author nor this club's Club Head
```

---

### Delete Blog

**Method:** `DELETE`
**Endpoint:** `/blogs/:id`
**Purpose:** Delete a blog post.
**Authentication:** The blog's author, or the club's Club Head

**Success Response — 200:**
```json
{ "success": true, "message": "Blog deleted", "data": {} }
```

**Error Responses:**
```
403   Caller is neither the author nor this club's Club Head
```

**Frontend Dependency Notes**

```
Depends On:
Not explicitly stated as its own workflow in FINAL_TEAM_BUILD_GUIDE.md —
Needs confirmation.

Reason:
Same basis as the Projects module: required complete before Search per
the Search workflow's stated dependencies, but no explicit prerequisite is
given for Blogs itself beyond needing a club to publish under.
```

---

## Announcements Module

### Post Announcement

**Method:** `POST`
**Endpoint:** `/announcements`
**Purpose:** Post a new announcement at GLOBAL, CLUB, or DEPARTMENT visibility.
**Authentication:** varies by chosen `visibility` — see Auth State Rules

**Request Body:**
```json
{ "title": "Midterm Break Notice", "content": "string", "visibility": "CLUB", "clubId": "uuid" }
```
`clubId` / `departmentId` are conditionally required based on `visibility` (see Auth State Rules).

**Success Response — 201:**
```json
{ "success": true, "message": "Announcement posted", "data": { "id": "uuid" } }
```

**Business Rules:** for `DEPARTMENT` visibility, `clubId` is always derived server-side from the department's own club — a client-supplied `clubId` is never trusted for this case.

**Error Responses:**
```
400   GLOBAL sent with a non-null clubId/departmentId; CLUB sent without clubId; DEPARTMENT sent without departmentId
403   Caller lacks the required scope for the chosen visibility
```

**Auth State Rules:**
```
visibility = GLOBAL:
Requires Role: SUPER_ADMIN. clubId and departmentId must be null.

visibility = CLUB:
Requires the target club's Club Head. clubId required.

visibility = DEPARTMENT:
Requires the target department's Head. departmentId required; clubId is
derived server-side and must not be trusted from the request.
```

---

### Get Announcement Feed

**Method:** `GET`
**Endpoint:** `/announcements`
**Purpose:** View announcements visible to the caller.
**Authentication:** Authenticated User

**Query Parameters:**
```json
{ "page": 1, "limit": 20 }
```

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": {
    "items": [ { "id": "uuid", "title": "Midterm Break Notice", "visibility": "GLOBAL", "clubId": null, "departmentId": null, "createdBy": "uuid", "createdAt": "2026-01-10T09:00:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
  }
}
```

**Business Rules:** auto-filtered server-side to: all GLOBAL + CLUB announcements for clubs the caller belongs to + DEPARTMENT announcements for departments the caller belongs to.

**Error Responses:**
```
401   Not authenticated
```

---

### Get One Announcement

**Method:** `GET`
**Endpoint:** `/announcements/:id`
**Purpose:** Read one announcement in full.
**Authentication:** Authenticated User (visibility-scoped)

**Success Response — 200:** AnnouncementSummary plus `content` (see Common Data Objects).

**Business Rules:** returns `404` (never `403`) when the announcement isn't visible to the caller, to avoid confirming its existence.

**Error Responses:**
```
404   Announcement not found, or not visible to the caller
```

---

### Delete Announcement

**Method:** `DELETE`
**Endpoint:** `/announcements/:id`
**Purpose:** Delete an announcement.
**Authentication:** The announcement's creator, Role: `SUPER_ADMIN`, or the Club Head of the announcement's club

**Success Response — 200:**
```json
{ "success": true, "message": "Announcement deleted", "data": {} }
```

**Error Responses:**
```
403   Caller is none of: creator, Super Admin, or the announcement's club's Club Head
```

**Frontend Dependency Notes**

```
Depends On:
Clubs and Departments modules

Reason:
Stated explicitly in the build guide's Full Stack Team Tasks — CLUB and
DEPARTMENT visibility both require the corresponding club/department to
already exist, and role checks resolve against club/department membership.
```

---

## Search Module

### Cross-Entity Search

**Method:** `GET`
**Endpoint:** `/search`
**Purpose:** Search across clubs, events, projects, and blogs at once.
**Authentication:** Public

**Query Parameters:**
```json
{ "q": "robotics", "type": "clubs", "page": 1, "limit": 20 }
```
`q` is required, minimum 2 characters. `type` is optional (`clubs | events | projects | blogs`) — when provided, only that entity type is populated.

**Success Response — 200:**
```json
{
  "success": true, "message": "OK",
  "data": {
    "clubs": [ { "id": "uuid", "name": "Robotics Club", "description": "string", "facultyDetails": "string", "socialLinks": {}, "logoUrl": null, "status": "ACTIVE", "facultyCoordinatorId": "uuid", "createdAt": "2026-01-10T09:00:00Z" } ],
    "events": [],
    "projects": [],
    "blogs": [],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
}
```
All four keys (`clubs`, `events`, `projects`, `blogs`) are always present, populated with the respective **Summary** objects, and set to `[]` when not applicable or not matching the requested `type`. `pagination.total` reflects only the entity types included in the current query.

**Error Responses:**
```
400   q missing or under 2 characters
```

**Frontend Dependency Notes**

```
Depends On:
Clubs, Events, Projects, and Blogs modules (all must be functionally
complete)

Reason:
Stated explicitly in the build guide's Full Stack Team Tasks — search
reads across all four entity types, so each must exist and be queryable
first.
```

---

# 5. Final Verification

Checked against `FINAL_TEAM_BUILD_GUIDE.md`:

- [x] Every endpoint in the Frontend API Reference table is included (52/52)
- [x] No endpoint was invented
- [x] No endpoint was removed
- [x] HTTP methods match the source table exactly
- [x] Routes match the source table exactly
- [x] Request fields match the source table's Request Data columns
- [x] Response structures match the source table's Response Data columns, with additive fields for list-vs-detail shapes documented explicitly rather than invented
- [x] Permissions match the module Permissions text (including cases where a role restriction implies 403 not explicitly re-listed in a given row's error column)
- [x] Error codes match the source table plus the module-level Validation/Business Rules text
- [x] All JSON examples follow the global success/failure envelope
- [x] No unnecessary fields were added — every field not directly stated is marked **Needs confirmation** with a stated reason
- [x] Object nesting (departments[] on club detail, members[] on department detail, etc.) matches what the source explicitly shows in its Response Data notation
- [x] Empty states are consistent (`[]` for collections, `null` for absent optional objects)
- [x] Field names are unchanged and consistently camelCase throughout
- [x] Authentication states are documented — globally for the default logged-out/wrong-role/authorized pattern, and per-endpoint where behavior deviates from that default (e.g. Announcements visibility rules, Events visibility rules, the 404-not-403 rule on announcement detail)
- [x] Endpoint inventory (Part 3) matches the detailed documentation (Part 4) exactly

**Open items requiring team confirmation** (all flagged inline above, collected here for convenience):
1. Whether `POST /auth/register` / `POST /auth/login` include `clubMemberships[]` in the `user` object, or only `GET /auth/me` does.
2. Exact nested shape of `ClubMembership.department` (used for client-side Department Head derivation).
3. Exact key set inside `Club.socialLinks`.
4. Exact field name for an event's registered-count value (`registeredCount` used here as a placeholder).
5. Whether `GET /events/:id` includes `rejectionReason`.
6. Exact field set returned by `GET /events/:id/registrations`.
7. Whether `POST /clubs` maps a `facultyCoordinatorId` conflict to `400` or `409` (this contract assumes `409`, consistent with the same conflict elsewhere).



# 6. Finalized API Decisions

The following decisions are **final** and override every corresponding **Needs confirmation** note in this document, including the matching entries in Section 5's "Open items requiring team confirmation" list. Where a shape below differs from an earlier example in this file, the shape below is authoritative.

## 6.1 `clubMemberships[]` — Auth Responses

**Overrides:** the **Needs confirmation** note under `AuthUser`; resolves Section 5 open item 1.

`clubMemberships[]` is returned **only** by `GET /auth/me`. `POST /auth/register` and `POST /auth/login` return the base `AuthUser` object with no `clubMemberships` field at all — not even an empty array.

```json
{ "id": "uuid", "name": "Asha Rao", "email": "asha@example.edu", "platformRole": "STUDENT" }
```

`GET /auth/me` is unchanged: it returns this same object plus `clubMemberships[]`, as already documented under `AuthUser`.

## 6.2 `ClubMembership.department` — Final Shape

**Overrides:** the **Needs confirmation** note under `ClubMembership`; resolves Section 5 open item 2.

`department` is finalized as `id` + `name` only. `head` is dropped.

```json
{
  "clubId": "uuid",
  "clubName": "Robotics Club",
  "role": "CLUB_HEAD",
  "department": {
    "id": "uuid",
    "name": "Web Dev"
  }
}
```

`department` remains `null` when the membership isn't tied to a specific department.

**Note:** the earlier draft included `head.id` specifically to support client-side Department Head derivation (*"a club membership whose department has `head.id === user.id`"*). With `head` removed, that derivation can no longer happen from this object — the frontend will need another source (e.g. comparing against `Department.headUserId` from a `GET /departments/:id` call) if that behavior is still required.

## 6.3 `Club.socialLinks` — Supported Keys

**Overrides:** the **Needs confirmation** note under `Club`; resolves Section 5 open item 3.

```json
{
  "instagram": "https://instagram.com/...",
  "linkedin": "https://...",
  "github": "https://...",
  "website": "https://..."
}
```

These four keys are the complete, final set. `youtube` and any other platform key are not supported and should be rejected or ignored server-side. Each value must still match `https?://`, per the existing validation rule.

## 6.4 Event Registered-Count Field Name

**Confirms:** `registeredCount` as final (no rename); resolves Section 5 open item 4.

```json
{ "registeredCount": 12 }
```

This name is now locked in everywhere it already appears in this contract — `EventSummary`, `GET /events` list results, `GET /events/:id` detail, and Search results. `registrationCount`, `currentRegistrations`, and `totalRegistrations` are rejected alternatives.

## 6.5 `rejectionReason` on `GET /events/:id`

**Overrides:** the **Needs confirmation** note under `Event`; resolves Section 5 open item 5.

`GET /events/:id` (detail) returns EventSummary plus `requestedBy`, `reviewedBy`, and `rejectionReason`:

```json
{
  "requestedBy": "uuid",
  "reviewedBy": "uuid | null",
  "rejectionReason": "string | null"
}
```

`rejectionReason` is `null` unless `status` is `REJECTED`.

## 6.6 `GET /events/:id/registrations` — Final Shape

**Overrides:** the **Needs confirmation** note under `EventRegistrant`; resolves Section 5 open item 6.

```json
{
  "userId": "uuid",
  "name": "Asha Rao",
  "email": "asha@example.edu",
  "registeredAt": "2026-01-10T09:00:00Z"
}
```

`department` and `phone` are explicitly excluded — not returned by this endpoint.

## 6.7 Faculty Coordinator Conflict — Status Code

**Confirms:** `409` as final for `POST /clubs`; resolves Section 5 open item 7.

When the submitted `facultyCoordinatorId` already coordinates another club, `POST /clubs` returns `409 Conflict`, consistent with the identical check on `POST /club-requests/:id/approve`.

```
409   facultyCoordinatorId already coordinates another club
```

## Summary

| # | Item | Final Decision |
|---|---|---|
| 1 | `clubMemberships[]` in auth responses | `GET /auth/me` only |
| 2 | `ClubMembership.department` shape | `{ id, name }` — `head` removed |
| 3 | `Club.socialLinks` keys | `instagram`, `linkedin`, `github`, `website` |
| 4 | Event registered-count field name | `registeredCount` |
| 5 | `rejectionReason` on `GET /events/:id` | Included |
| 6 | `GET /events/:id/registrations` shape | `{ userId, name, email, registeredAt }` |
| 7 | Faculty coordinator conflict status code | `409 Conflict` |

All seven items in Section 5's "Open items requiring team confirmation" list are now closed by this section.