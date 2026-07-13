# CampusOS — Final Team Build Guide

This document replaces `CAMPUSOS_BLUEPRINT.md`. Build only against what's written here.

## Out of Scope — Do Not Build
- Google OAuth login
- Password reset flow
- Email verification flow
- Google Calendar integration
- Advanced full-text search
- In-app notification center
- Platform analytics dashboard
- Audit logging
- Soft deletes (every delete below is a hard delete)
- Rate limiting / abuse protection
- File upload service (all images/links are plain URL strings)
- More than one Club Head per club
- More than one club per Faculty Coordinator at the same time

## Global API Conventions
- Base URL: `/api/v1`
- Auth header (all protected routes): `Authorization: Bearer <jwt>`
- Pagination (all list routes): query `?page=1&limit=20` → response includes `data.items[]` + `data.pagination: { page, limit, total, totalPages }`
- Success envelope: `{ "success": true, "message": "string", "data": {} }`
- Failure envelope: `{ "success": false, "message": "string", "errors": { "field": "message" } }` — `errors` is optional, included only for field-level validation failures.

Status Codes:

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

**Deletion scope:** only these can be deleted — club memberships, department memberships, projects, blogs, announcements, event registrations, and a student's own pending club-creation request. Clubs, departments, events, and user accounts have no delete endpoint in MVP.

## Roles Reference
- Platform roles: `SUPER_ADMIN` (platform-wide), `FACULTY_COORDINATOR` (assigned to at most one club at a time), `STUDENT` (default for every new user)
- Club roles (stored per membership): `CLUB_HEAD` (exactly one per club, always), `MEMBER`
- Department Head is **not** a stored role — a `MEMBER` becomes a department's head only when `departments.head_user_id` matches them, scoped to that one department
- Roles are evaluated per club — a user can be `CLUB_HEAD` in Club A and `MEMBER` (or Department Head) in Club B at the same time

---

# 1. FRONTEND TEAM TASKS

## Frontend Stack
- React (function components + hooks)
- Tailwind CSS for styling
- API calls: fetch/axios wrapper + TanStack Query for all server data (caching, loading/error state)
- State management: TanStack Query for server state, React Context for auth, local component state for forms — no Redux
- Auth: JWT stored in `localStorage`, attached to every request via an interceptor

## Authentication Implementation

**Register flow**
- Fields: name, email, password
- Calls `POST /auth/register`
- On success: store `token` in `localStorage`, store `user` in `AuthContext`, redirect to `/`
- On `400`/`409`: show field-level errors from `errors` (fall back to `message` if `errors` is missing)

**Login flow**
- Fields: email, password
- Calls `POST /auth/login`
- On success: same as register
- On `401`: show a generic "invalid email or password" message

**Token storage**
- JWT stored in `localStorage` under one key (e.g. `campusos_token`)
- On app load, `AuthContext` reads the token and, if present, calls `GET /auth/me` to hydrate `user` + `clubMemberships[]`
- If `GET /auth/me` returns `401`, clear the token and treat the user as logged out

**AuthContext responsibilities**
- Exposes: `user`, `token`, `login()`, `logout()`, `isLoading`
- `login()` stores token + user; `logout()` clears both and redirects to `/login`
- Refetches `GET /auth/me` after any action that changes the current user's role or club membership (transfer-head, role update, being added/removed from a club or department)
- On any `403` response, treats the cached role/membership as possibly stale and refetches `GET /auth/me` before showing the error — the UI may be permission-gating on outdated data

**How users stay logged in**
- Token persists in `localStorage` across refreshes and tabs
- On every app load, `AuthContext` validates the token via `GET /auth/me` before rendering protected content

**Protected routes**
- `ProtectedRoute` checks `AuthContext.user`
- Not logged in → redirect to `/login`
- Logged in but wrong role for the route → redirect to `/` with an "unauthorized" message

**Permission-based UI rendering**
- Buttons/links for Club Head, Faculty Coordinator, Super Admin, and Department Head actions are shown/hidden based on `user.platformRole` and `user.clubMemberships[]`
- Department Head is derived client-side: a club membership whose department has `head.id === user.id`
- Hidden UI is not real protection — the backend re-checks every permission independently regardless of what the frontend shows

## Pages To Build

### Login
Route: `/login`
Access: Public (redirect to `/` if already logged in)
Purpose: Authenticate an existing user.
User Actions: Enter email + password, submit; link to `/register`
Backend APIs Used: `POST /auth/login`
UI Components Needed: `FormField`, submit button, error banner
Important States:
- Loading: button disabled + spinner
- Empty: n/a
- Error: invalid-credentials message from `401`
- Success: redirect to `/`
- Unauthorized: n/a

### Register
Route: `/register`
Access: Public
Purpose: Create a new Student account.
User Actions: Enter name, email, password, submit
Backend APIs Used: `POST /auth/register`
UI Components Needed: `FormField`, submit button, error banner
Important States:
- Loading: button disabled while submitting
- Empty: n/a
- Error: field-level errors (name length, invalid email, weak password, duplicate email)
- Success: redirect to `/`
- Unauthorized: n/a

### Home / Club Directory (Dashboard)
Route: `/`
Access: Public
Purpose: Landing page — browse and search all clubs.
User Actions: Search clubs by name; paginate; click a club to view details
Backend APIs Used: `GET /clubs`
UI Components Needed: `SearchBar`, `ClubCard`, `Pagination`
Important States:
- Loading: skeleton cards
- Empty: `EmptyState` — "No clubs found"
- Error: retry banner
- Success: grid of `ClubCard`
- Unauthorized: n/a

### Search Results
Route: `/search?q=`
Access: Public
Purpose: Cross-entity search results — clubs, events, projects, blogs.
User Actions: Type a query in `SearchBar` from any page and land here; filter by entity type; click a result to open its detail page
Backend APIs Used: `GET /search`
UI Components Needed: `SearchBar`, `ClubCard`, `EventCard`, `ProjectCard`, `BlogCard`, `Pagination`, `EmptyState`
Important States:
- Loading: skeleton per section
- Empty: "No results" if all four result arrays are empty
- Error: `400` if `q` is missing or under 2 characters — validate client-side before calling the API
- Success: grouped results, one section per entity type
- Unauthorized: n/a

### Club Detail
Route: `/clubs/:id`
Access: Public
Purpose: Public profile of one club — info, departments, its events/projects/blogs.
User Actions: View info, social links, departments; view the club's events/projects/blogs; if permitted, navigate to `/clubs/:id/manage`
Backend APIs Used: `GET /clubs/:id`, `GET /clubs/:id/departments`, `GET /events?clubId=`, `GET /projects?clubId=`, `GET /blogs?clubId=`
UI Components Needed: `RoleBadge`, `EventCard`, `ProjectCard`, `BlogCard`, `Pagination`
Important States:
- Loading: skeleton
- Empty: each section shows its own `EmptyState` (e.g. "No projects yet")
- Error: `404` → "Club not found"
- Success: full club profile
- Unauthorized: n/a

### Submit Club Request
Route: `/club-requests/new`
Access: Any authenticated user (Student)
Purpose: Request creation of a new club.
User Actions: Fill clubName, description, facultyDetails, reason; submit; view status of own submitted request; withdraw it while still pending
Backend APIs Used: `POST /club-requests`, `GET /club-requests/:id`, `DELETE /club-requests/:id`
UI Components Needed: `FormField`, submit button, `RequestStatusBadge`
Important States:
- Loading: button disabled
- Empty: n/a
- Error: field-level validation errors
- Success: shows status `PENDING`
- Unauthorized: redirect to `/login` if not authenticated

### Club Management (Info + Members)
Route: `/clubs/:id/manage`
Access: Club Head (own club) or Super Admin
Purpose: Edit club info and manage the member roster.
User Actions:
- Edit description, facultyDetails, socialLinks, logoUrl
- Search existing users and add as members
- Demote a member (Club Head cannot promote — that only happens via transfer-head)
- Remove a member (blocked with a clear message if they're the sole Club Head)
- Leave the club (self-remove) — same sole-Club-Head guard applies
- Create a new department (links to Department Management)
- Super Admin only: reassign the Faculty Coordinator
Backend APIs Used: `GET/PATCH /clubs/:id`, `GET /clubs/:id/members`, `POST /clubs/:id/members`, `DELETE /clubs/:id/members/:userId`, `PATCH /clubs/:id/members/:userId/role`, `POST /clubs/:id/departments`, `GET /users?search=`, `PATCH /clubs/:id/faculty-coordinator`
UI Components Needed: `FormField`, `MemberTable`, `RoleBadge`, `ConfirmDialog`, `SearchBar`
Important States:
- Loading: skeleton form + table
- Empty: n/a (a club always has at least its Club Head)
- Error: `400` "cannot remove sole Club Head", shown via `ConfirmDialog`
- Success: toast on save/add/remove
- Unauthorized: redirect if not this club's Club Head or Super Admin

### Department Management
Route: `/clubs/:id/manage/departments/:deptId`
Access: Club Head (own club), that department's Head, or Super Admin
Purpose: Manage one department's members and head.
User Actions:
- Assign/clear the department head (Club Head only) — dropdown limited to current department members
- Add a member to the department (Club Head or that department's Head) — must already be a club member
- Remove a member from the department (Club Head or that department's Head)
Backend APIs Used: `GET /departments/:id`, `PATCH /departments/:id/head`, `POST /departments/:id/members`, `DELETE /departments/:id/members/:userId`
UI Components Needed: `MemberTable`, `FormField` (dropdown), `ConfirmDialog`
Important States:
- Loading: skeleton
- Empty: "No members in this department yet"
- Error: `400` "user must be a club member first"
- Success: toast on save
- Unauthorized: redirect if not Club Head/Dept Head/Super Admin

### Event Directory
Route: `/events`
Access: Public — logged-out users see `PUBLIC` approved events only; logged-in users additionally see `CLUB_EXCLUSIVE` approved events for clubs they belong to
Purpose: Browse all approved events.
User Actions: Search/filter by type and club; paginate; click through to details
Backend APIs Used: `GET /events`
UI Components Needed: `EventCard`, `SearchBar`, `Pagination`
Important States:
- Loading: skeleton cards
- Empty: `EmptyState`
- Error: retry banner
- Success: grid of `EventCard`
- Unauthorized: n/a

### Event Detail
Route: `/events/:id`
Access: Public/Auth (registration requires login)
Purpose: View one event and register/unregister.
User Actions: View details (title, description, location, time, capacity, registered count); register; unregister if already registered
Backend APIs Used: `GET /events/:id`, `POST /events/:id/register`, `DELETE /events/:id/register`
UI Components Needed: `RequestStatusBadge`, `ConfirmDialog` (for unregister)
Important States:
- Loading: skeleton
- Empty: n/a
- Error: `400` full/not approved, `403` exclusive event non-member, `409` already registered
- Success: button reflects state — Register / Registered ✓ (cancel) / Full / Login to Register
- Unauthorized: register redirects to `/login` if not authenticated

### Create / Edit Event Request
Route: `/clubs/:id/manage/events/new` (create), `/clubs/:id/manage/events/:eventId/edit` (edit)
Access: Club Head (own club)
Purpose: Submit a new event for Faculty Coordinator approval, or edit a `PENDING`/`REJECTED` event (editing resets status to `PENDING`).
User Actions: Fill title, description, type, capacity (optional), location, startTime, endTime; submit; edit an existing PENDING/REJECTED event — `APPROVED` events cannot be edited
Backend APIs Used: `POST /clubs/:id/events`, `PATCH /clubs/:id/events/:eventId`
UI Components Needed: `FormField`, date/time pickers
Important States:
- Loading: button disabled
- Empty: n/a
- Error: `endTime` must be after `startTime`; capacity must be > 0 if set
- Success: status shown as `PENDING`, redirect to event detail
- Unauthorized: redirect if not this club's Club Head, or if the event is `APPROVED`

### Faculty Approval Queue
Route: `/faculty/events`
Access: Faculty Coordinator (own assigned club only)
Purpose: Approve or reject pending event requests for the coordinator's club.
User Actions: View pending events; approve; reject with an optional reason
Backend APIs Used: `GET /events?status=PENDING&clubId=`, `PATCH /events/:id/approve`, `PATCH /events/:id/reject`
UI Components Needed: `RequestStatusBadge`, `FormField` (rejection reason), `ConfirmDialog`
Important States:
- Loading: skeleton list
- Empty: "No pending events"
- Error: retry banner
- Success: list updates without a full reload after action
- Unauthorized: redirect if not Faculty Coordinator of this club

### Project Directory
Route: `/projects`
Access: Public
Purpose: Browse all published projects.
User Actions: Search; filter by club; paginate
Backend APIs Used: `GET /projects`
UI Components Needed: `ProjectCard`, `SearchBar`, `Pagination`
Important States:
- Loading: skeleton
- Empty: `EmptyState`
- Error: retry banner
- Success: grid of `ProjectCard`
- Unauthorized: n/a

### Project Detail
Route: `/projects/:id`
Access: Public
Purpose: View one project's full details.
User Actions: View tech stack, links, contributors
Backend APIs Used: `GET /projects/:id`
UI Components Needed: tag chips, external links
Important States:
- Loading: skeleton
- Empty: n/a
- Error: `404` "Project not found"
- Success: full detail view
- Unauthorized: n/a

### Create / Edit Project
Route: `/clubs/:id/manage/projects/new`
Access: Club Head or Department Head (of that club)
Purpose: Publish a project.
User Actions: Fill title, description, techStack, githubLink, demoLink, thumbnailUrl, contributors, status, optional departmentId
Backend APIs Used: `POST /clubs/:id/projects`, `PATCH /projects/:id`
UI Components Needed: `FormField`, chip-input for tags/contributors
Important States:
- Loading: button disabled
- Empty: n/a
- Error: title/description required
- Success: redirect to project detail
- Unauthorized: redirect if not Club Head/Dept Head of that club

### Blog Directory
Route: `/blogs`
Access: Public
Purpose: Browse all published blogs.
User Actions: Search; filter by club/tag; paginate
Backend APIs Used: `GET /blogs`
UI Components Needed: `BlogCard`, `SearchBar`, `Pagination`
Important States:
- Loading: skeleton
- Empty: `EmptyState`
- Error: retry banner
- Success: list of `BlogCard`
- Unauthorized: n/a

### Blog Detail
Route: `/blogs/:id`
Access: Public
Purpose: Read one blog post in full.
Backend APIs Used: `GET /blogs/:id`
UI Components Needed: rendered content, tag chips
Important States:
- Loading: skeleton
- Empty: n/a
- Error: `404` "Blog not found"
- Success: full post
- Unauthorized: n/a

### Create Blog
Route: `/clubs/:id/manage/blogs/new`
Access: Club Head or Department Head (of that club)
Purpose: Publish a blog post.
User Actions: Fill title, content, tags, thumbnailUrl, optional departmentId
Backend APIs Used: `POST /clubs/:id/blogs`
UI Components Needed: `FormField`, textarea, chip-input for tags
Important States:
- Loading: button disabled
- Empty: n/a
- Error: title/content required
- Success: redirect to blog detail
- Unauthorized: redirect if not Club Head/Dept Head of that club

### Announcement Feed
Route: `/announcements`
Access: Any authenticated user
Purpose: View announcements visible to the current user (GLOBAL + their clubs + their departments).
User Actions: Paginate; delete own or moderated announcements
Backend APIs Used: `GET /announcements`, `DELETE /announcements/:id`
UI Components Needed: `RequestStatusBadge` (visibility tag), `ConfirmDialog`
Important States:
- Loading: skeleton list
- Empty: `EmptyState`
- Error: retry banner
- Success: feed list, auto-filtered server-side
- Unauthorized: redirect to `/login` if not authenticated

### Create Announcement
Route: `/announcements/new`
Access: Super Admin (GLOBAL), Club Head (CLUB), Department Head (DEPARTMENT)
Purpose: Post a new announcement.
User Actions: Choose visibility (options shown depend on caller's roles); fill title + content; pick club/department if applicable
Backend APIs Used: `POST /announcements`
UI Components Needed: `FormField`, visibility selector
Important States:
- Loading: button disabled
- Empty: n/a
- Error: `403` if caller lacks scope for the chosen visibility
- Success: redirect to `/announcements`
- Unauthorized: redirect if not authenticated

### Club Request Queue
Route: `/admin/club-requests`
Access: Super Admin
Purpose: Approve or reject pending club creation requests.
User Actions: Filter by status; approve (prompts for a Faculty Coordinator, blocked with `409` if already assigned elsewhere); reject with an optional reason
Backend APIs Used: `GET /club-requests`, `PATCH /club-requests/:id/approve`, `PATCH /club-requests/:id/reject`
UI Components Needed: `RequestStatusBadge`, `FormField` (coordinator picker, rejection reason), `Pagination`
Important States:
- Loading: skeleton list
- Empty: "No requests"
- Error: `400`/`409` duplicate club name or coordinator already assigned elsewhere
- Success: list updates without a full reload
- Unauthorized: redirect if not Super Admin

### User Management
Route: `/admin/users`
Access: Super Admin
Purpose: Search users and change platform roles.
User Actions: Search users; change a user's `platformRole`
Backend APIs Used: `GET /users`, `PATCH /users/:id/role`
UI Components Needed: `SearchBar`, `Pagination`, `RoleBadge`, `ConfirmDialog`
Important States:
- Loading: skeleton table
- Empty: `EmptyState`
- Error: `400` "cannot remove the last Super Admin"
- Success: toast on role change
- Unauthorized: redirect if not Super Admin

### My Profile
Route: `/profile`
Access: Any authenticated user
Purpose: View own info and club memberships/roles.
Backend APIs Used: `GET /auth/me`
UI Components Needed: `RoleBadge` list
Important States:
- Loading: skeleton
- Empty: "You haven't joined any clubs yet"
- Error: retry banner
- Success: profile + memberships list
- Unauthorized: redirect to `/login`

## Frontend Shared Components
- `Navbar` — top nav, reads `AuthContext` to show login/logout and role-based links
- `ProtectedRoute` — wraps routes needing auth and/or a specific role
- `SearchBar` — text input wired to a search callback or route
- `Pagination` — page controls using the `data.pagination` shape
- `FormField` — labeled input/textarea/select with inline error display
- `ClubCard` / `EventCard` / `ProjectCard` / `BlogCard` — directory list-item cards
- `MemberTable` — table with promote/demote/remove actions
- `RoleBadge` — small tag showing a platform or club role
- `RequestStatusBadge` — Pending/Approved/Rejected tag
- `EmptyState` — shown when a list has zero items
- `ConfirmDialog` — confirmation modal for destructive actions
- Error banner / toast — shown on any API failure

## Frontend API Reference

**Auth**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /auth/register | Create account | name, email, password | user, token | 400, 409 |
| POST | /auth/login | Log in | email, password | user, token | 400, 401 |
| GET | /auth/me | Get current user + memberships | — | id, name, email, platformRole, clubMemberships[] | 401 |

**Users**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| GET | /users?search=&page=&limit= | Search users (Club Head/Faculty Coordinator/Super Admin only) | query params | items[] (id, name, email; +platformRole, createdAt for Super Admin) | 403 |
| GET | /users/:id | Get one user | — | id, name, email, platformRole, createdAt | 403, 404 |
| PATCH | /users/:id/role | Change platform role | platformRole | updated user | 400, 403 |

**Club Requests**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /club-requests | Submit request | clubName, description, facultyDetails, reason | id, status | 400 |
| GET | /club-requests?status=&page=&limit= | List requests | query params | items[], pagination | 403 |
| GET | /club-requests/:id | Get one request | — | request object | 403, 404 |
| PATCH | /club-requests/:id/approve | Approve | facultyCoordinatorId | clubId, requestId, status | 400, 404, 409 |
| PATCH | /club-requests/:id/reject | Reject | reason (optional) | id, status | 400, 404 |
| DELETE | /club-requests/:id | Withdraw own pending request | — | — | 400, 403 |

**Clubs & Membership**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /clubs | Create club directly | name, description, facultyDetails, facultyCoordinatorId, clubHeadUserId, socialLinks?, logoUrl? | club object | 400, 409 |
| GET | /clubs?search=&page=&limit= | List clubs | query params | items[], pagination | — |
| GET | /clubs/:id | Get one club | — | club + departments[] | 404 |
| PATCH | /clubs/:id | Edit club info | description?, facultyDetails?, socialLinks?, logoUrl? | updated club | 403 |
| PATCH | /clubs/:id/faculty-coordinator | Reassign coordinator | facultyCoordinatorId | updated club | 403, 409 |
| GET | /clubs/:id/members?page=&limit= | List members | query params | items[] (name-only for Members; +email for Club Head/Super Admin) | 401, 403 |
| POST | /clubs/:id/members | Add member | userId | userId, clubId, role | 403, 404, 409 |
| DELETE | /clubs/:id/members/:userId | Remove member / leave | — | — | 400, 403, 404 |
| PATCH | /clubs/:id/members/:userId/role | Demote to Member | role: "MEMBER" | updated membership | 400, 403 |
| POST | /clubs/:id/transfer-head | Transfer Club Head | newClubHeadUserId | clubId, newClubHeadUserId | 403, 404 |

**Departments**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /clubs/:id/departments | Create department | name | id, clubId, name | 409 |
| GET | /clubs/:id/departments | List departments | — | items[] | — |
| GET | /departments/:id | Get one department | — | department + members[] | 404 |
| PATCH | /departments/:id/head | Set/clear head | userId (or null) | updated department | 400, 403 |
| POST | /departments/:id/members | Add dept member | userId | userId, departmentId | 400, 403, 409 |
| DELETE | /departments/:id/members/:userId | Remove dept member | — | — | 403 |

**Events**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /clubs/:id/events | Request new event | title, description, type, capacity, location, startTime, endTime | id, status | 400, 403 |
| PATCH | /clubs/:id/events/:eventId | Edit PENDING/REJECTED event | any create field | updated event, status → PENDING | 400, 403 |
| GET | /events?search=&status=&type=&clubId=&page=&limit= | List events | query params | items[], pagination | — |
| GET | /events/:id | Get one event | — | event + requestedBy, reviewedBy | 404 |
| PATCH | /events/:id/approve | Approve event | — | id, status | 400, 403 |
| PATCH | /events/:id/reject | Reject event | reason (optional) | id, status | 400, 403 |
| POST | /events/:id/register | Register | — | eventId, userId | 400, 403, 409 |
| DELETE | /events/:id/register | Unregister | — | — | 404 |
| GET | /events/:id/registrations?page=&limit= | List registrants | query params | items[], pagination | 403 |

**Projects**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /clubs/:id/projects | Publish project | title, description, techStack, githubLink, demoLink, thumbnailUrl, contributors, status, departmentId | id | 400, 403 |
| GET | /projects?search=&clubId=&page=&limit= | List projects | query params | items[], pagination | — |
| GET | /projects/:id | Get one project | — | project + githubLink, demoLink, contributors, createdBy | 404 |
| PATCH | /projects/:id | Edit project | any create field | updated project | 403 |
| DELETE | /projects/:id | Delete project | — | — | 403 |

**Blogs**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /clubs/:id/blogs | Publish blog | title, content, tags, thumbnailUrl, departmentId | id | 400, 403 |
| GET | /blogs?search=&clubId=&tag=&page=&limit= | List blogs | query params | items[], pagination | — |
| GET | /blogs/:id | Get one blog | — | blog + full content | 404 |
| PATCH | /blogs/:id | Edit blog | any create field | updated blog | 403 |
| DELETE | /blogs/:id | Delete blog | — | — | 403 |

**Announcements**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| POST | /announcements | Post announcement | title, content, visibility, clubId?, departmentId? | id | 403 |
| GET | /announcements?page=&limit= | Get visible feed | query params | items[], pagination | 401 |
| GET | /announcements/:id | Get one announcement | — | announcement + content | 404 |
| DELETE | /announcements/:id | Delete announcement | — | — | 403 |

**Search**

| Method | Endpoint | Purpose | Request Data | Response Data | Errors |
|---|---|---|---|---|---|
| GET | /search?q=&type=&page=&limit= | Cross-entity search | query params | clubs[], events[], projects[], blogs[] (all four keys always present), pagination | 400 |

## Frontend Completion Checklist
- [ ] Authentication works (register, login, `/auth/me` hydration)
- [ ] JWT persists across refresh via `localStorage`
- [ ] Protected routes redirect correctly for logged-out and wrong-role users
- [ ] Permission-based UI shows/hides correctly and refetches after role changes
- [ ] All pages listed above are implemented
- [ ] All API integrations match the Frontend API Reference exactly (route, method, field names)
- [ ] Loading, empty, error, success, and unauthorized states handled on every page
- [ ] Pagination works on every list page
- [ ] Field-level validation errors are shown on every form
- [ ] Destructive actions confirm via `ConfirmDialog`

---

# 2. BACKEND TEAM TASKS

## Backend Stack
- Express.js (Node.js)
- Prisma ORM + PostgreSQL
- JWT auth (`jsonwebtoken` + bcrypt for password hashing)
- Request validation via schema (e.g. zod)
- Centralized error handling → consistent success/failure envelope

## Database Setup

### Enums

| Enum | Values | Note |
|---|---|---|
| PlatformRole | SUPER_ADMIN, FACULTY_COORDINATOR, STUDENT | |
| ClubRole | CLUB_HEAD, MEMBER | A club always has exactly one CLUB_HEAD |
| ClubStatus | ACTIVE | Only value produced in MVP |
| RequestStatus | PENDING, APPROVED, REJECTED | |
| EventType | PUBLIC, CLUB_EXCLUSIVE | |
| EventStatus | PENDING, APPROVED, REJECTED | `COMPLETED` is not used in MVP — do not build a job that sets it |
| ProjectStatus | IN_PROGRESS, COMPLETED, ARCHIVED | |
| AnnouncementVisibility | GLOBAL, CLUB, DEPARTMENT | |

### Tables

**users**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | String | required |
| email | String | required, unique |
| password_hash | String | required (bcrypt hash — never store or return the plain password) |
| platform_role | PlatformRole | default STUDENT |
| created_at / updated_at | DateTime | |

**club_creation_requests**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| club_name, description, faculty_details, reason | String | required |
| requested_by | UUID | FK → users.id |
| status | RequestStatus | default PENDING |
| reviewed_by | UUID | FK → users.id, nullable |
| rejection_reason | String | nullable |
| created_at / updated_at | DateTime | |

Cascade: `requested_by` user deleted → RESTRICT.

**clubs**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | String | required, unique |
| description, faculty_details | String | required |
| social_links | JSON | nullable |
| logo_url | String | nullable, must match `https?://` if present |
| status | ClubStatus | default ACTIVE |
| faculty_coordinator_id | UUID | FK → users.id, nullable, **unique** (enforces one coordinator per club at a time) |
| created_at / updated_at | DateTime | |

**club_memberships**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| club_id | UUID | FK → clubs.id |
| role | ClubRole | default MEMBER |
| joined_at | DateTime | |

Constraint: unique (`user_id`, `club_id`). Cascade: club or user deleted → cascade delete membership.

**departments**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| club_id | UUID | FK → clubs.id |
| name | String | required, unique per club (case-insensitive) |
| head_user_id | UUID | FK → users.id, nullable |
| created_at / updated_at | DateTime | |

Cascade: club deleted → cascade delete departments. Head removed from the department — via club-wide removal **or** direct department-membership removal — → set `head_user_id` to null.

**department_memberships**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| department_id | UUID | FK → departments.id |
| joined_at | DateTime | |

Constraint: unique (`user_id`, `department_id`). Cascade: department deleted → cascade delete. Club membership removed → cascade delete their department memberships in that club.

**events**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| club_id | UUID | FK → clubs.id |
| title, description, location | String | required |
| type | EventType | required |
| capacity | Int | nullable (null = unlimited), must be > 0 if set |
| start_time / end_time | DateTime | required, end_time > start_time |
| status | EventStatus | default PENDING |
| requested_by | UUID | FK → users.id (must be a Club Head) |
| reviewed_by | UUID | FK → users.id, nullable |
| rejection_reason | String | nullable |
| created_at / updated_at | DateTime | |

Cascade: club deleted → cascade delete events.

**event_registrations**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| event_id | UUID | FK → events.id |
| user_id | UUID | FK → users.id |
| registered_at | DateTime | |

Constraint: unique (`event_id`, `user_id`). Cascade: event deleted → cascade delete registrations.

**projects**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| club_id | UUID | FK → clubs.id |
| department_id | UUID | FK → departments.id, nullable |
| title, description | String | required |
| tech_stack | String[] | default [] |
| github_link, demo_link, thumbnail_url | String | nullable |
| contributors | String[] | default [] (names only, MVP) |
| status | ProjectStatus | default IN_PROGRESS |
| created_by | UUID | FK → users.id |
| created_at / updated_at | DateTime | |

Cascade: club deleted → cascade delete; department deleted → set `department_id` null.

**blogs**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| club_id | UUID | FK → clubs.id, nullable |
| department_id | UUID | FK → departments.id, nullable |
| title, content | String | required |
| author_id | UUID | FK → users.id |
| tags | String[] | default [] |
| thumbnail_url | String | nullable |
| published_at | DateTime | set at creation |
| created_at / updated_at | DateTime | |

Cascade: club deleted → cascade delete; department deleted → set `department_id` null.

**announcements**

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| title, content | String | required |
| visibility | AnnouncementVisibility | required |
| club_id | UUID | FK → clubs.id, nullable |
| department_id | UUID | FK → departments.id, nullable |
| created_by | UUID | FK → users.id |
| created_at | DateTime | |

For `DEPARTMENT` visibility, `club_id` must always be derived server-side from `department_id`'s own club — never trust a client-supplied `clubId`.
Cascade: club deleted → cascade delete; department deleted → cascade delete department-scoped announcements.

## Backend Modules

### Authentication Module
Purpose: Registration, login, current-user retrieval, JWT issuing/verification.
Database Tables: users
APIs Required: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
Permissions: Public (register, login); any authenticated user (me)
Validation Rules: name 2–80 chars; email valid + unique; password ≥ 8 chars
Business Rules: passwords hashed with bcrypt, never returned in any response; JWT expires per `JWT_EXPIRES_IN`; `/auth/me` resolves `clubMemberships[]` fresh from the database — never trust a role embedded in the JWT
Frontend Pages Using This: Login, Register, My Profile, and indirectly every protected page

### Users Module
Purpose: User search (for adding members) and platform role management.
Database Tables: users
APIs Required: `GET /users`, `GET /users/:id`, `PATCH /users/:id/role`
Permissions: `GET /users` restricted to Club Head, Faculty Coordinator, or Super Admin; `GET /users/:id` self or Super Admin; `PATCH /users/:id/role` Super Admin only
Validation Rules: `platformRole` ∈ enum
Business Rules: non-admin callers of `GET /users` receive only id/name/email; Super Admin also receives platformRole/createdAt. `PATCH /users/:id/role` must reject a change that would leave zero `SUPER_ADMIN` users platform-wide.
Frontend Pages Using This: Club Management (member search), User Management, My Profile

### Club Requests Module
Purpose: Student-submitted club creation requests and Super Admin review.
Database Tables: club_creation_requests, clubs, club_memberships
APIs Required: `POST /club-requests`, `GET /club-requests`, `GET /club-requests/:id`, `PATCH /club-requests/:id/approve`, `PATCH /club-requests/:id/reject`, `DELETE /club-requests/:id`
Permissions: submit = any authenticated user; list/approve/reject = Super Admin; get one = Super Admin or requester; delete = requester, PENDING only
Validation Rules: all four submit fields required; clubName ≤ 100 chars
Business Rules:
- Only PENDING requests can be approved or rejected.
- Approval checks for a duplicate club name (case-insensitive) first and returns 409 before creating anything.
- Approval also checks the chosen `facultyCoordinatorId` isn't already coordinating another club — 409 if so.
- Approval creates the club (status ACTIVE), creates a club_memberships row for the requester as CLUB_HEAD, and sets the request to APPROVED — all inside one transaction.
- Rejection stores the optional reason in `rejection_reason`.
Frontend Pages Using This: Submit Club Request, Club Request Queue

### Clubs Module
Purpose: Club CRUD, membership management, Club Head transfer, Faculty Coordinator reassignment.
Database Tables: clubs, club_memberships
APIs Required: `POST /clubs`, `GET /clubs`, `GET /clubs/:id`, `PATCH /clubs/:id`, `PATCH /clubs/:id/faculty-coordinator`, `GET /clubs/:id/members`, `POST /clubs/:id/members`, `DELETE /clubs/:id/members/:userId`, `PATCH /clubs/:id/members/:userId/role`, `POST /clubs/:id/transfer-head`
Permissions: `POST /clubs` = Super Admin only; `PATCH /clubs/:id` = Club Head (own club) or Super Admin; member add/role-change = Club Head; member remove = Club Head or the member removing themself; transfer-head and faculty-coordinator reassignment = Super Admin only
Validation Rules: name required and unique; `facultyCoordinatorId` (if set) must not already coordinate another club; `clubHeadUserId` (on direct create) must be an existing user
Business Rules:
- A club always has exactly one Club Head. The only way to change it is `transfer-head`, which demotes the outgoing head and promotes the incoming one atomically.
- Removing a member — by Club Head or by self — is rejected with 400 if the target is the sole remaining Club Head.
- `PATCH /clubs/:id/members/:userId/role` can only set MEMBER — never CLUB_HEAD.
- `GET /clubs/:id/members`: Club Head/Super Admin get full fields incl. email; any other authenticated club member gets name-only; a non-member gets 403.
- A Faculty Coordinator can be assigned to at most one club at a time — enforced by the unique constraint on `faculty_coordinator_id`.
Frontend Pages Using This: Home/Club Directory, Club Detail, Club Management

### Departments Module
Purpose: Department CRUD, department membership, head assignment.
Database Tables: departments, department_memberships, club_memberships (read)
APIs Required: `POST /clubs/:id/departments`, `GET /clubs/:id/departments`, `GET /departments/:id`, `PATCH /departments/:id/head`, `POST /departments/:id/members`, `DELETE /departments/:id/members/:userId`
Permissions: create + head assignment = Club Head; add/remove department member = Club Head or that department's Head
Validation Rules: name unique per club, case-insensitive, 2–50 chars; department membership requires existing club membership first; head must already be a department member
Business Rules: Department Head is derived, not stored — a MEMBER becomes a department's head only when `head_user_id` matches them, scoped to that department. Removing the current head from the department — whether by club-wide removal or direct department-membership removal — clears `head_user_id`.
Frontend Pages Using This: Club Management, Department Management, Club Detail

### Events Module
Purpose: Event request/approval lifecycle, editing, registration, capacity handling.
Database Tables: events, event_registrations
APIs Required: `POST /clubs/:id/events`, `PATCH /clubs/:id/events/:eventId`, `GET /events`, `GET /events/:id`, `PATCH /events/:id/approve`, `PATCH /events/:id/reject`, `POST /events/:id/register`, `DELETE /events/:id/register`, `GET /events/:id/registrations`
Permissions: create/edit = Club Head (of that club); approve/reject = Faculty Coordinator of that club; register/unregister = any authenticated user; registrations list = Club Head or Faculty Coordinator of that club
Validation Rules: endTime > startTime; capacity null or > 0; type ∈ enum
Business Rules:
- Editing is only allowed while status is PENDING or REJECTED and resets status to PENDING. APPROVED events cannot be edited.
- Unauthenticated `GET /events` returns only PUBLIC, APPROVED events. Authenticated callers additionally see APPROVED CLUB_EXCLUSIVE events for clubs they belong to.
- Registration must check capacity and insert the registration inside a single database transaction. A plain "read count, then insert" is not acceptable — it allows overbooking under concurrent requests.
- Duplicate registration → 409.
- CLUB_EXCLUSIVE registration by a non-member → 403.
- Rejection stores the optional reason in `rejection_reason`.
Frontend Pages Using This: Event Directory, Event Detail, Create/Edit Event Request, Faculty Approval Queue, Club Detail

### Projects Module
Purpose: Project CRUD.
Database Tables: projects
APIs Required: `POST /clubs/:id/projects`, `GET /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id`
Permissions: create = Club Head or Department Head; edit/delete = creator or Club Head
Validation Rules: title, description required; `departmentId` (if set) must belong to the same club
Business Rules: none beyond validation
Frontend Pages Using This: Project Directory, Project Detail, Create/Edit Project, Club Detail

### Blogs Module
Purpose: Blog CRUD.
Database Tables: blogs
APIs Required: `POST /clubs/:id/blogs`, `GET /blogs`, `GET /blogs/:id`, `PATCH /blogs/:id`, `DELETE /blogs/:id`
Permissions: create = Club Head or Department Head; edit/delete = creator or Club Head
Validation Rules: title, content required
Business Rules: `published_at` is set at creation (no draft state in MVP)
Frontend Pages Using This: Blog Directory, Blog Detail, Create Blog, Club Detail

### Announcements Module
Purpose: Announcement CRUD with visibility-scoped feed filtering.
Database Tables: announcements
APIs Required: `POST /announcements`, `GET /announcements`, `GET /announcements/:id`, `DELETE /announcements/:id`
Permissions: create GLOBAL = Super Admin only; create CLUB = that club's Club Head; create DEPARTMENT = that department's Head; delete = creator, Super Admin, or the Club Head of the announcement's club
Validation Rules: GLOBAL → clubId/departmentId must be null; CLUB → clubId required; DEPARTMENT → departmentId required
Business Rules:
- For DEPARTMENT visibility, `club_id` is derived server-side from the department's own `club_id` — never trust a client-supplied `clubId`.
- `GET /announcements` auto-filters to: all GLOBAL + CLUB announcements for clubs the caller belongs to + DEPARTMENT announcements for departments the caller belongs to.
- `GET /announcements/:id` returns 404 (not 403) when not visible to the caller, to avoid confirming its existence.
Frontend Pages Using This: Announcement Feed, Create Announcement

### Search Module
Purpose: Basic cross-entity search across clubs, events, projects, blogs.
Database Tables: read-only across clubs, events, projects, blogs
APIs Required: `GET /search`
Permissions: Public
Validation Rules: `q` required, minimum 2 characters; `type` ∈ clubs|events|projects|blogs (optional)
Business Rules: response always includes all four keys (`clubs`, `events`, `projects`, `blogs`), populated as `[]` when not applicable or not matching `type`; `pagination.total` reflects only the entity types included in the current query.
Frontend Pages Using This: Search Results, Home (search bar)

## Backend Critical Rules
- **Club Head:** a club has exactly one Club Head at all times; the only way to change it is `transfer-head`. Removing the sole Club Head — by anyone, including self-removal — is rejected with 400.
- **Super Admin protection:** `PATCH /users/:id/role` must reject any change that would leave zero `SUPER_ADMIN` users on the platform.
- **Faculty Coordinator assignment:** at most one club per coordinator at a time, enforced via a unique constraint on `clubs.faculty_coordinator_id`; both the request-approval flow and `PATCH /clubs/:id/faculty-coordinator` must check this and return 409 on conflict.
- **Event registration capacity:** the capacity check and the registration insert happen inside a single transaction. Do not implement this as a separate read-then-write.
- **Permission checks:** every club-scoped or department-scoped role (Club Head, Department Head, Faculty Coordinator) is resolved fresh from the database on each request — never trust a role claim embedded in the JWT.
- **Rejection reason storage:** `PATCH /club-requests/:id/reject` and `PATCH /events/:id/reject` persist their optional `reason` into the `rejection_reason` column.
- **Data validation:** all URL-typed fields (`logoUrl`, `thumbnailUrl`, `githubLink`, `demoLink`, and values inside `socialLinks`) must match a basic `https?://` pattern server-side before saving.
- **Cascade behavior:** implement exactly the cascade rules listed per table above, including the department-head-clearing rule for both club-wide and department-only removal.
- **Transactions:** wrap any operation writing to more than one table in a single Prisma `$transaction` — this includes club-request approval (request + club + membership) and event registration (count-check + insert).
- **Seed script:** hash every seeded password with bcrypt before inserting into `password_hash` — never insert the plaintext seed value directly.
- **Event reminders:** don't rely on an in-process `setInterval` for the 24-hour reminder job if the hosting plan can spin down on inactivity — use an external trigger (a scheduled platform job or a scheduled CI workflow hitting a reminder-check endpoint).

## Backend Completion Checklist
- [ ] Prisma schema matches Database Setup exactly (tables, enums, constraints, cascades)
- [ ] All middleware in place: authenticate, authorize (platform-role), authorize (club/department-scoped role), validate, paginate, error handler
- [ ] Every endpoint in every module above is implemented and matches its route/method/body exactly
- [ ] Every response follows the success/failure envelope, including the optional `errors` field
- [ ] Club Head, Super Admin, and Faculty Coordinator invariants enforced
- [ ] Event registration is transaction-safe under concurrent requests
- [ ] Rejection reasons persist for club requests and events
- [ ] Seed script runs cleanly and hashes passwords
- [ ] Integration tests: one happy-path + one failure-path per module

---

# 3. FULL STACK TEAM TASKS

### Authentication
Frontend Work: Register/Login pages, `AuthContext`, `ProtectedRoute`, token persistence in `localStorage`, permission-based UI rendering
Backend Work: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, JWT middleware, bcrypt password hashing
Shared Requirements: agreement on the failure envelope's `errors` shape; agreement that the JWT lives in `localStorage`
Dependencies: none — build this first
Finished When: a new user can register, log out, log back in, refresh the page and stay logged in, and see UI that correctly reflects their role.

### Club Creation Workflow
Frontend Work: Submit Club Request page, Club Request Queue, Club Directory, Club Detail, Club Management page
Backend Work: Club Requests module, Clubs module (including direct `POST /clubs`), Faculty Coordinator uniqueness + reassignment endpoint
Shared Requirements: agreement on the duplicate-name and duplicate-coordinator 409 messages so the frontend can show them inline
Dependencies: Authentication
Finished When: a Student can submit a request, Super Admin can approve it (assigning a Faculty Coordinator not already assigned elsewhere) or reject it with a reason, and an approved request produces a browsable club with the requester as Club Head.

### Event Workflow
Frontend Work: Event Directory, Event Detail (register/unregister), Create/Edit Event Request, Faculty Approval Queue
Backend Work: Events module including capacity-safe registration, edit/resubmit flow, unregister endpoint
Shared Requirements: agreement on how full/already-registered/exclusive-non-member states render, matching the exact error codes above
Dependencies: Club Creation Workflow
Finished When: a Club Head can request an event, a Faculty Coordinator can approve/reject it, an approved event is publicly listed and can be registered/unregistered for without overbooking, and a rejected event can be edited and resubmitted.

### Search
Frontend Work: Search Results page, `SearchBar` wired into Home and directory pages
Backend Work: Search module (`GET /search`)
Shared Requirements: agreement that all four result keys are always present, even when empty
Dependencies: Clubs, Events, Projects, and Blogs modules must be functionally complete first — search reads across all four
Finished When: searching returns grouped, paginated results across clubs/events/projects/blogs and handles the too-short-query error inline.

### Announcements
Frontend Work: Announcement Feed, Create Announcement (visibility selector adapts fields shown)
Backend Work: Announcements module including server-derived `clubId` for DEPARTMENT visibility, feed auto-filtering, moderation delete rule
Shared Requirements: agreement on which roles can create which visibility level
Dependencies: Clubs and Departments modules
Finished When: GLOBAL/CLUB/DEPARTMENT announcements post correctly by role, the feed shows only what each caller should see, and a Club Head can delete stale announcements inside their own club.

### Deployment
Frontend Work: build and deploy `apps/web` to Vercel; point it at the deployed API's base URL
Backend Work: deploy `apps/api` to Render; provision Render PostgreSQL; run migrations; set environment variables
Shared Requirements:

| Variable | Purpose |
|---|---|
| DATABASE_URL | Render PostgreSQL connection string |
| JWT_SECRET | JWT signing key |
| JWT_EXPIRES_IN | e.g. `7d` |
| RESEND_API_KEY / RESEND_FROM_EMAIL | Event reminder emails |
| CORS_ORIGIN | Deployed frontend URL — restricts API access |
| NODE_ENV | `development` \| `production` |

Dependencies: all modules above merged and seed data loaded
Finished When: production login → browse clubs/events → register for an event works end-to-end, and `CORS_ORIGIN` restricts the API to the deployed frontend only.

---

# Final Integration Checklist
- [ ] Frontend successfully calls every backend endpoint listed in the Frontend API Reference
- [ ] Database migrations run cleanly against the production database
- [ ] Authentication works end-to-end (register → login → refresh → logout)
- [ ] Club workflow works end-to-end (request → approve with coordinator assignment → club appears publicly)
- [ ] Event workflow works end-to-end (request → approve → register/unregister without overbooking → edit a rejected event)
- [ ] Search returns correct grouped results across all four entity types
- [ ] Deployment complete: frontend on Vercel, backend + database on Render, environment variables set
- [ ] Production environment manually tested: login → browse → register for event → post announcement
