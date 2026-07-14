# Implementation Plan: CampusOS MVP

## Overview

This implementation plan breaks down the CampusOS MVP into discrete, parallel-executable tasks optimized for a one-week delivery timeline. The plan follows the module dependency order established in FINAL_TEAM_BUILD_GUIDE.md and leverages the three-layer architecture (Routes → Controllers → Services) defined in ARCHITECTURE.md.

**Authority Documents:**
1. FINAL_API_CONTRACT.md - 52 frozen API endpoints
2. FINAL_TEAM_BUILD_GUIDE.md - Module dependencies and workflows  
3. design.md - System architecture and interfaces
4. ARCHITECTURE.md - Three-layer pattern implementation

**Module Build Order:**
- Phase 1: Infrastructure + Authentication (no dependencies)
- Phase 2: Users, Club Requests, Clubs (parallel after Auth)
- Phase 3: Departments, Events, Projects, Blogs (parallel after Clubs)
- Phase 4: Announcements (after Clubs + Departments)
- Phase 5: Search (after all content modules)

**Critical Business Rules:**
- Exactly one Club Head per club at all times
- At least one SUPER_ADMIN on platform
- Faculty Coordinator uniqueness (one club max)
- Transaction-safe event registration (capacity checking)
- Case-insensitive club/department name uniqueness
- Hard deletes only (no soft delete)

**Implementation Language:** TypeScript (Node.js with Express.js)

---

## Tasks

- [ ] 1. Project Infrastructure Setup
  - Initialize backend project structure with TypeScript, Express.js, Prisma
  - Set up package.json with all dependencies (express, prisma, jsonwebtoken, bcryptjs, zod, cors, helmet)
  - Configure TypeScript with tsconfig.json (strict mode, path aliases)
  - Set up development scripts (ts-node-dev for hot reload)
  - Create .env.example with all required environment variables
  - Set up CORS configuration for development and production
  - _Requirements: Backend Stack (Express.js, Prisma, JWT, TypeScript)_

- [ ] 2. Database Schema and Migration
  - [ ] 2.1 Define Prisma schema with all 11 tables
    - Create schema.prisma with all enums (PlatformRole, ClubRole, ClubStatus, RequestStatus, EventType, EventStatus, ProjectStatus, AnnouncementVisibility)
    - Define all 11 tables: users, club_creation_requests, clubs, club_memberships, departments, department_memberships, events, event_registrations, projects, blogs, announcements
    - Set up all foreign key relationships with correct cascade rules
    - Add unique constraints (email, club name case-insensitive, faculty_coordinator_id, membership pairs)
    - Add check constraints (event capacity > 0, end_time > start_time)
    - _Requirements: Database Tables, Enums, Cascade Rules from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 2.2 Create and test initial migration
    - Run `prisma migrate dev` to generate initial migration
    - Verify all indexes are created (including functional indexes for case-insensitive searches)
    - Test migration rollback and re-apply
    - Generate Prisma Client types
    - _Requirements: Database Setup Completion_


- [ ] 3. Shared Libraries and Middleware
  - [ ] 3.1 Create core shared utilities
    - Implement Prisma client singleton (lib/prisma.ts)
    - Implement JWT utilities (lib/jwt.ts) - sign and verify functions
    - Implement password utilities (lib/password.ts) - bcrypt hash and compare
    - Implement response envelope helpers (lib/envelope.ts) - successResponse and errorResponse
    - Implement custom error classes (lib/errors.ts) - UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, BadRequestError
    - _Requirements: Shared Libraries from ARCHITECTURE.md_
  
  - [ ] 3.2 Implement authentication middleware
    - Create authenticate middleware (middleware/authenticate.ts)
    - Extract JWT from Authorization header
    - Verify token signature and expiration
    - Fetch user from database with platform_role (never trust JWT claims)
    - Attach user object to req.user
    - Handle TokenExpiredError and JsonWebTokenError
    - _Requirements: Authentication Middleware, JWT Security_
  
  - [ ] 3.3 Implement authorization middleware
    - Create authorize middleware (middleware/authorize.ts) for platform roles
    - Check req.user.platform_role against allowed roles array
    - Return 403 if insufficient permissions
    - Create authorizeClubRole middleware (middleware/authorizeClubRole.ts) for club-scoped roles
    - Query club_memberships for Club Head check
    - Query departments for Department Head check (head_user_id match)
    - Support Super Admin bypass
    - _Requirements: Authorization Levels, Role Evaluation Rules_
  
  - [ ] 3.4 Implement validation and error handling middleware
    - Create validate middleware (middleware/validate.ts) using zod
    - Parse and validate req.body against schema
    - Replace req.body with validated data
    - Format zod errors into field-level error object
    - Create errorHandler middleware (middleware/errorHandler.ts)
    - Map custom error types to HTTP status codes
    - Map Prisma errors (P2002 unique violation, P2025 not found)
    - Return standard error envelope
    - Log errors appropriately (full details in dev, message only in prod)
    - _Requirements: Error Handling Strategy, Input Validation Security_


- [ ] 4. Authentication Module
  - [ ] 4.1 Implement authentication service layer
    - Create auth service (modules/auth/service.ts)
    - Implement register: validate email uniqueness, hash password, create user with STUDENT role, generate JWT
    - Implement login: find user by email, compare password hash, generate JWT
    - Implement getCurrentUser: fetch user with club memberships (include club name, role, department id/name)
    - Query club_memberships joined with clubs and departments for memberships array
    - _Requirements: Authentication Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 4.2 Implement authentication controllers
    - Create auth controller (modules/auth/controller.ts)
    - Implement registerController: parse body, call service, return success envelope with user + token
    - Implement loginController: parse body, call service, return success envelope with user + token
    - Implement getCurrentUserController: call service with req.user.id, return success envelope with user + memberships
    - Handle errors via try-catch and next(error)
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 4.3 Create validation schemas
    - Create auth schemas (modules/auth/schemas.ts)
    - Define registerSchema: name (2-80 chars), email (valid format), password (≥8 chars)
    - Define loginSchema: email and password required
    - Use zod for type-safe validation
    - _Requirements: Input Validation Security_
  
  - [ ] 4.4 Wire authentication routes
    - Create auth routes (modules/auth/routes.ts)
    - POST /auth/register - public, validate(registerSchema), registerController
    - POST /auth/login - public, validate(loginSchema), loginController
    - GET /auth/me - authenticate, getCurrentUserController
    - Export router
    - _Requirements: Authentication APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 4.5 Write unit tests for authentication service
    - Test register with valid data creates user and returns token
    - Test register with duplicate email throws ConflictError
    - Test login with valid credentials returns token
    - Test login with invalid credentials throws UnauthorizedError
    - Test password is hashed (never stored plain)
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 5. Users Module
  - [ ] 5.1 Implement users service layer
    - Create users service (modules/users/service.ts)
    - Implement searchUsers: query users by search string (case-insensitive), paginate results
    - Return id/name/email for non-admin callers, add platformRole/createdAt for Super Admin callers
    - Implement getUser: fetch single user by id
    - Implement updateUserRole: change platform_role (validate not leaving zero SUPER_ADMIN)
    - _Requirements: Users Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 5.2 Implement users controllers
    - Create users controller (modules/users/controller.ts)
    - Implement searchUsersController: parse query params, call service, return paginated results
    - Implement getUserController: parse id param, call service, return user
    - Implement updateUserRoleController: parse body, call service, return updated user
    - Check authorization: self OR Super Admin for GET /users/:id
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 5.3 Create validation schemas
    - Create users schemas (modules/users/schemas.ts)
    - Define updateRoleSchema: platformRole enum validation
    - _Requirements: Input Validation Security_
  
  - [ ] 5.4 Wire users routes
    - Create users routes (modules/users/routes.ts)
    - GET /users - authenticate, custom middleware for Club Head/Faculty Coordinator/Super Admin check, searchUsersController
    - GET /users/:id - authenticate, getUserController (self or Super Admin checked in controller)
    - PATCH /users/:id/role - authenticate, authorize(['SUPER_ADMIN']), validate(updateRoleSchema), updateUserRoleController
    - Export router
    - _Requirements: Users APIs from FINAL_API_CONTRACT.md, ARCHITECTURE Correction 1_
  
  - [ ]* 5.5 Write unit tests for users service
    - Test searchUsers returns correct subset based on caller role
    - Test updateUserRole enforces at least one SUPER_ADMIN
    - Test updateUserRole throws BadRequestError when removing last Super Admin
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 6. Club Requests Module
  - [ ] 6.1 Implement club requests service layer
    - Create club requests service (modules/club-requests/service.ts)
    - Implement submitRequest: validate fields, create request with PENDING status
    - Implement listRequests: filter by status, paginate, Super Admin only
    - Implement getRequest: fetch single request, check authorization (Super Admin or requester)
    - Implement approveRequest: use Prisma transaction to create club + Club Head membership + update request to APPROVED
    - Check duplicate club name (case-insensitive) before creating club → throw ConflictError
    - Check facultyCoordinatorId not already assigned → throw ConflictError
    - Implement rejectRequest: update status to REJECTED, store optional reason
    - Implement withdrawRequest: delete request if PENDING and caller is requester
    - _Requirements: Club Requests Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 6.2 Implement club requests controllers
    - Create club requests controller (modules/club-requests/controller.ts)
    - Implement submitRequestController: parse body, call service, return request with status PENDING
    - Implement listRequestsController: parse query params (status, page, limit), call service, return paginated results
    - Implement getRequestController: parse id param, call service, return request
    - Implement approveRequestController: parse body (facultyCoordinatorId), call service, return clubId and requestId
    - Implement rejectRequestController: parse body (optional reason), call service, return updated request
    - Implement withdrawRequestController: call service, return success
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 6.3 Create validation schemas
    - Create club requests schemas (modules/club-requests/schemas.ts)
    - Define submitRequestSchema: clubName (≤100 chars), description, facultyDetails, reason all required
    - Define approveRequestSchema: facultyCoordinatorId uuid required
    - Define rejectRequestSchema: reason optional string
    - _Requirements: Input Validation Security_
  
  - [ ] 6.4 Wire club requests routes
    - Create club requests routes (modules/club-requests/routes.ts)
    - POST /club-requests - authenticate, validate(submitRequestSchema), submitRequestController
    - GET /club-requests - authenticate, authorize(['SUPER_ADMIN']), listRequestsController
    - GET /club-requests/:id - authenticate, getRequestController (auth checked in controller)
    - PATCH /club-requests/:id/approve - authenticate, authorize(['SUPER_ADMIN']), validate(approveRequestSchema), approveRequestController
    - PATCH /club-requests/:id/reject - authenticate, authorize(['SUPER_ADMIN']), validate(rejectRequestSchema), rejectRequestController
    - DELETE /club-requests/:id - authenticate, withdrawRequestController (auth checked in controller)
    - Export router
    - _Requirements: Club Requests APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 6.5 Write unit tests for club requests service
    - Test approveRequest creates club, membership, and updates request atomically
    - Test approveRequest throws ConflictError for duplicate club name
    - Test approveRequest throws ConflictError for coordinator already assigned
    - Test rejectRequest stores reason
    - Test withdrawRequest only allows requester and PENDING status
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services, Transaction Testing_



- [ ] 7. Clubs Module
  - [ ] 7.1 Implement clubs service layer
    - Create clubs service (modules/clubs/service.ts)
    - Implement createClub: validate name unique (case-insensitive), validate facultyCoordinatorId not assigned, create club + Club Head membership in transaction
    - Implement listClubs: search by name (case-insensitive), paginate, public access
    - Implement getClub: fetch club with departments array (id + name only)
    - Implement updateClub: update description, facultyDetails, socialLinks, logoUrl
    - Implement reassignFacultyCoordinator: validate new coordinator not already assigned, update club
    - Implement listClubMembers: fetch members with role, include email for Club Head/Super Admin callers
    - Implement addMember: check user exists, check not already member, create membership with MEMBER role
    - Implement removeMember: check not sole Club Head, delete membership (cascades to department memberships)
    - Implement demoteToMember: update role to MEMBER
    - Implement transferHead: use transaction to demote old Club Head + promote new Club Head atomically
    - Implement canUpdateClub helper: check if caller is Club Head or Super Admin
    - _Requirements: Clubs Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 7.2 Implement clubs controllers
    - Create clubs controller (modules/clubs/controller.ts)
    - Implement createClubController: parse body, call service, return club
    - Implement listClubsController: parse query params (search, page, limit), call service, return paginated results
    - Implement getClubController: parse id param, call service, return club with departments
    - Implement updateClubController: check authorization via canUpdateClub, parse body, call service, return updated club
    - Implement reassignFacultyCoordinatorController: parse body (facultyCoordinatorId), call service, return updated club
    - Implement listClubMembersController: check caller is member or Super Admin, parse query, call service, return paginated members
    - Implement addMemberController: parse body (userId), call service, return membership
    - Implement removeMemberController: check caller is Club Head or self, parse params, call service, return success
    - Implement demoteToMemberController: parse params, call service, return updated membership
    - Implement transferHeadController: parse body (newClubHeadUserId), call service, return success
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 7.3 Create validation schemas
    - Create clubs schemas (modules/clubs/schemas.ts)
    - Define createClubSchema: name, description, facultyDetails required, facultyCoordinatorId uuid, clubHeadUserId uuid, socialLinks object with URL values, logoUrl URL
    - Define updateClubSchema: all fields optional, same types as create
    - Define reassignCoordinatorSchema: facultyCoordinatorId uuid required
    - Define addMemberSchema: userId uuid required
    - Define demoteSchema: role must be "MEMBER"
    - Define transferHeadSchema: newClubHeadUserId uuid required
    - _Requirements: Input Validation Security_
  
  - [ ] 7.4 Wire clubs routes
    - Create clubs routes (modules/clubs/routes.ts)
    - POST /clubs - authenticate, authorize(['SUPER_ADMIN']), validate(createClubSchema), createClubController
    - GET /clubs - public, listClubsController
    - GET /clubs/:id - public, getClubController
    - PATCH /clubs/:id - authenticate, validate(updateClubSchema), updateClubController (auth in controller)
    - PATCH /clubs/:id/faculty-coordinator - authenticate, authorize(['SUPER_ADMIN']), validate(reassignCoordinatorSchema), reassignFacultyCoordinatorController
    - GET /clubs/:id/members - authenticate, listClubMembersController (auth in controller)
    - POST /clubs/:id/members - authenticate, authorizeClubRole({ clubIdParam: 'id', allowedRoles: ['CLUB_HEAD'] }), validate(addMemberSchema), addMemberController
    - DELETE /clubs/:id/members/:userId - authenticate, removeMemberController (auth in controller)
    - PATCH /clubs/:id/members/:userId/role - authenticate, authorizeClubRole({ clubIdParam: 'id', allowedRoles: ['CLUB_HEAD'] }), validate(demoteSchema), demoteToMemberController
    - POST /clubs/:id/transfer-head - authenticate, authorize(['SUPER_ADMIN']), validate(transferHeadSchema), transferHeadController
    - Export router
    - _Requirements: Clubs APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 7.5 Write unit tests for clubs service
    - Test createClub enforces name uniqueness (case-insensitive)
    - Test createClub enforces faculty coordinator uniqueness
    - Test removeMember throws BadRequestError when removing sole Club Head
    - Test transferHead demotes old head and promotes new head atomically
    - Test reassignFacultyCoordinator throws ConflictError if coordinator already assigned
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services, Transaction Testing_



- [ ] 8. Departments Module
  - [ ] 8.1 Implement departments service layer
    - Create departments service (modules/departments/service.ts)
    - Implement createDepartment: validate name unique per club (case-insensitive), create department
    - Implement listDepartments: fetch all departments for a club
    - Implement getDepartment: fetch department with members array (id + name)
    - Implement setDepartmentHead: validate new head is department member, update head_user_id (null to clear)
    - Implement addDepartmentMember: validate user is club member first, create department membership
    - Implement removeDepartmentMember: delete membership, if removed member was head then clear head_user_id
    - Implement canManageDepartment helper: check if caller is Club Head or this specific department's Head or Super Admin
    - _Requirements: Departments Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 8.2 Implement departments controllers
    - Create departments controller (modules/departments/controller.ts)
    - Implement createDepartmentController: parse body (name), call service, return department
    - Implement listDepartmentsController: parse clubId param, call service, return departments array
    - Implement getDepartmentController: check authorization via canManageDepartment, parse id param, call service, return department with members
    - Implement setDepartmentHeadController: check caller is Club Head, parse body (userId or null), call service, return updated department
    - Implement addDepartmentMemberController: check authorization via canManageDepartment, parse body (userId), call service, return membership
    - Implement removeDepartmentMemberController: check authorization via canManageDepartment, parse params, call service, return success
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 8.3 Create validation schemas
    - Create departments schemas (modules/departments/schemas.ts)
    - Define createDepartmentSchema: name string 2-50 chars required
    - Define setHeadSchema: userId uuid or null
    - Define addMemberSchema: userId uuid required
    - _Requirements: Input Validation Security_
  
  - [ ] 8.4 Wire departments routes
    - Create departments routes (modules/departments/routes.ts)
    - POST /clubs/:id/departments - authenticate, authorizeClubRole({ clubIdParam: 'id', allowedRoles: ['CLUB_HEAD'] }), validate(createDepartmentSchema), createDepartmentController
    - GET /clubs/:id/departments - public, listDepartmentsController
    - GET /departments/:id - authenticate, getDepartmentController (auth in controller)
    - PATCH /departments/:id/head - authenticate, validate(setHeadSchema), setDepartmentHeadController (Club Head auth in controller)
    - POST /departments/:id/members - authenticate, validate(addMemberSchema), addDepartmentMemberController (auth in controller)
    - DELETE /departments/:id/members/:userId - authenticate, removeDepartmentMemberController (auth in controller)
    - Export router
    - _Requirements: Departments APIs from FINAL_API_CONTRACT.md, ARCHITECTURE Correction 2_
  
  - [ ]* 8.5 Write unit tests for departments service
    - Test createDepartment enforces name uniqueness per club (case-insensitive)
    - Test setDepartmentHead validates head is department member
    - Test addDepartmentMember validates user is club member first
    - Test removeDepartmentMember clears head_user_id if removing current head
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 9. Events Module
  - [ ] 9.1 Implement events service layer
    - Create events service (modules/events/service.ts)
    - Implement requestEvent: validate endTime > startTime, capacity null or > 0, create event with PENDING status
    - Implement editEvent: validate status is PENDING or REJECTED, update fields, reset status to PENDING
    - Implement listEvents: filter by search, status, type, clubId, apply visibility rules (public: PUBLIC approved only, authenticated: also CLUB_EXCLUSIVE approved for caller's clubs), paginate
    - Implement getEvent: fetch event with requestedBy, reviewedBy, rejectionReason
    - Implement approveEvent: validate status PENDING, update to APPROVED
    - Implement rejectEvent: validate status PENDING, update to REJECTED, store optional reason
    - Implement registerForEvent: use Prisma transaction to check capacity + create registration atomically, validate APPROVED status, validate CLUB_EXCLUSIVE visibility requires club membership
    - Implement unregisterFromEvent: delete registration
    - Implement listRegistrations: fetch paginated registrations with userId, name, email, registeredAt
    - _Requirements: Events Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 9.2 Implement events controllers
    - Create events controller (modules/events/controller.ts)
    - Implement requestEventController: parse body, call service, return event with status PENDING
    - Implement editEventController: parse body, call service, return updated event with status PENDING
    - Implement listEventsController: parse query params (search, status, type, clubId, page, limit), call service with user context for visibility, return paginated results
    - Implement getEventController: parse id param, call service, return event
    - Implement approveEventController: check caller is Faculty Coordinator of this club, call service, return event
    - Implement rejectEventController: check caller is Faculty Coordinator of this club, parse body (optional reason), call service, return event
    - Implement registerForEventController: parse id param, call service with req.user.id, return registration
    - Implement unregisterFromEventController: parse id param, call service with req.user.id, return success
    - Implement listRegistrationsController: check caller is Club Head or Faculty Coordinator, parse query, call service, return paginated registrations
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 9.3 Create validation schemas
    - Create events schemas (modules/events/schemas.ts)
    - Define requestEventSchema: title, description, location, type enum, capacity (nullable or > 0), startTime ISO8601, endTime ISO8601 required
    - Define editEventSchema: same fields all optional
    - Define rejectEventSchema: reason optional string
    - _Requirements: Input Validation Security_
  
  - [ ] 9.4 Wire events routes
    - Create events routes (modules/events/routes.ts)
    - POST /clubs/:id/events - authenticate, authorizeClubRole({ clubIdParam: 'id', allowedRoles: ['CLUB_HEAD'] }), validate(requestEventSchema), requestEventController
    - PATCH /clubs/:id/events/:eventId - authenticate, authorizeClubRole({ clubIdParam: 'id', allowedRoles: ['CLUB_HEAD'] }), validate(editEventSchema), editEventController
    - GET /events - public (with user context for visibility), listEventsController
    - GET /events/:id - public, getEventController
    - PATCH /events/:id/approve - authenticate, approveEventController (Faculty Coordinator auth in controller)
    - PATCH /events/:id/reject - authenticate, validate(rejectEventSchema), rejectEventController (Faculty Coordinator auth in controller)
    - POST /events/:id/register - authenticate, registerForEventController
    - DELETE /events/:id/register - authenticate, unregisterFromEventController
    - GET /events/:id/registrations - authenticate, listRegistrationsController (auth in controller)
    - Export router
    - _Requirements: Events APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 9.5 Write unit tests for events service
    - Test editEvent only allows PENDING or REJECTED, resets to PENDING
    - Test editEvent throws error for APPROVED events
    - Test registerForEvent throws error for full events
    - Test registerForEvent throws error for duplicate registration
    - Test registerForEvent validates CLUB_EXCLUSIVE requires club membership
    - Test capacity check + registration insert happens in transaction (no overbooking)
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services, Transaction Testing_



- [~] 10. Projects Module
  - [ ] 10.1 Implement projects service layer
    - Create projects service (modules/projects/service.ts)
    - Implement publishProject: validate title, description required, validate departmentId belongs to same club if provided, create project
    - Implement listProjects: search by title (case-insensitive), filter by clubId, paginate, return summary (excludes githubLink, demoLink, contributors, createdBy)
    - Implement getProject: fetch project with full details including githubLink, demoLink, contributors, createdBy
    - Implement updateProject: update any fields, validate departmentId if provided
    - Implement deleteProject: delete project
    - Implement canManageProject helper: check if caller is creator or Club Head or Super Admin
    - _Requirements: Projects Module from FINAL_TEAM_BUILD_GUIDE.md, ARCHITECTURE Correction 4_
  
  - [ ] 10.2 Implement projects controllers
    - Create projects controller (modules/projects/controller.ts)
    - Implement publishProjectController: check caller is Club Head or Department Head, parse body, call service, return project id
    - Implement listProjectsController: parse query params (search, clubId, page, limit), call service, return paginated summary results
    - Implement getProjectController: parse id param, call service, return full project details
    - Implement updateProjectController: check authorization via canManageProject, parse body, call service, return updated project
    - Implement deleteProjectController: check authorization via canManageProject, call service, return success
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 10.3 Create validation schemas
    - Create projects schemas (modules/projects/schemas.ts)
    - Define publishProjectSchema: title, description required, techStack array, githubLink/demoLink/thumbnailUrl URLs, contributors array, status enum, departmentId uuid optional
    - Define updateProjectSchema: all fields optional, same types as publish
    - _Requirements: Input Validation Security_
  
  - [ ] 10.4 Wire projects routes
    - Create projects routes (modules/projects/routes.ts)
    - POST /clubs/:id/projects - authenticate, validate(publishProjectSchema), publishProjectController (Club Head/Dept Head auth in controller)
    - GET /projects - public, listProjectsController
    - GET /projects/:id - public, getProjectController
    - PATCH /projects/:id - authenticate, validate(updateProjectSchema), updateProjectController (auth in controller)
    - DELETE /projects/:id - authenticate, deleteProjectController (auth in controller)
    - Export router
    - _Requirements: Projects APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 10.5 Write unit tests for projects service
    - Test publishProject validates departmentId belongs to same club
    - Test updateProject validates departmentId if provided
    - Test canManageProject allows creator, Club Head, or Super Admin
    - Test listProjects returns summary without detail-only fields
    - Test getProject returns full details
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 11. Blogs Module
  - [ ] 11.1 Implement blogs service layer
    - Create blogs service (modules/blogs/service.ts)
    - Implement publishBlog: validate title, content required, set published_at to current time, create blog
    - Implement listBlogs: search by title (case-insensitive), filter by clubId/tag, paginate, return summary (excludes content)
    - Implement getBlog: fetch blog with full content
    - Implement updateBlog: update any fields
    - Implement deleteBlog: delete blog
    - Implement canManageBlog helper: check if caller is author or Club Head or Super Admin
    - _Requirements: Blogs Module from FINAL_TEAM_BUILD_GUIDE.md, ARCHITECTURE Correction 4_
  
  - [ ] 11.2 Implement blogs controllers
    - Create blogs controller (modules/blogs/controller.ts)
    - Implement publishBlogController: check caller is Club Head or Department Head, parse body, call service, return blog id
    - Implement listBlogsController: parse query params (search, clubId, tag, page, limit), call service, return paginated summary results
    - Implement getBlogController: parse id param, call service, return full blog with content
    - Implement updateBlogController: check authorization via canManageBlog, parse body, call service, return updated blog
    - Implement deleteBlogController: check authorization via canManageBlog, call service, return success
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 11.3 Create validation schemas
    - Create blogs schemas (modules/blogs/schemas.ts)
    - Define publishBlogSchema: title, content required, tags array, thumbnailUrl URL optional, departmentId uuid optional
    - Define updateBlogSchema: all fields optional, same types as publish
    - _Requirements: Input Validation Security_
  
  - [ ] 11.4 Wire blogs routes
    - Create blogs routes (modules/blogs/routes.ts)
    - POST /clubs/:id/blogs - authenticate, validate(publishBlogSchema), publishBlogController (Club Head/Dept Head auth in controller)
    - GET /blogs - public, listBlogsController
    - GET /blogs/:id - public, getBlogController
    - PATCH /blogs/:id - authenticate, validate(updateBlogSchema), updateBlogController (auth in controller)
    - DELETE /blogs/:id - authenticate, deleteBlogController (auth in controller)
    - Export router
    - _Requirements: Blogs APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 11.5 Write unit tests for blogs service
    - Test publishBlog sets published_at at creation
    - Test canManageBlog allows author, Club Head, or Super Admin
    - Test listBlogs returns summary without content
    - Test getBlog returns full content
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 12. Announcements Module
  - [ ] 12.1 Implement announcements service layer
    - Create announcements service (modules/announcements/service.ts)
    - Implement postAnnouncement: validate visibility + scope (GLOBAL requires null clubId/departmentId, CLUB requires clubId, DEPARTMENT requires departmentId and derives clubId server-side from department)
    - Check authorization: GLOBAL requires SUPER_ADMIN, CLUB requires Club Head, DEPARTMENT requires Department Head
    - Create announcement with validated scope
    - Implement getAnnouncementFeed: auto-filter to GLOBAL + caller's clubs (CLUB) + caller's departments (DEPARTMENT), paginate, return summary (excludes content)
    - Implement getAnnouncement: fetch announcement with content, return 404 if not visible to caller (never 403)
    - Implement deleteAnnouncement: check caller is creator OR Super Admin OR Club Head of announcement's club, delete announcement
    - _Requirements: Announcements Module from FINAL_TEAM_BUILD_GUIDE.md, ARCHITECTURE Correction 5_
  
  - [ ] 12.2 Implement announcements controllers
    - Create announcements controller (modules/announcements/controller.ts)
    - Implement postAnnouncementController: parse body (title, content, visibility, clubId, departmentId), call service with req.user context for auth, return announcement id
    - Implement getAnnouncementFeedController: parse query params (page, limit), call service with req.user context for filtering, return paginated summary results
    - Implement getAnnouncementController: parse id param, call service with req.user context for visibility check, return full announcement with content
    - Implement deleteAnnouncementController: check authorization (creator/Super Admin/Club Head), call service, return success
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 12.3 Create validation schemas
    - Create announcements schemas (modules/announcements/schemas.ts)
    - Define postAnnouncementSchema: title, content, visibility enum required, clubId uuid optional, departmentId uuid optional
    - Server-side validation: GLOBAL requires both null, CLUB requires clubId, DEPARTMENT requires departmentId
    - _Requirements: Input Validation Security, ARCHITECTURE Correction 5_
  
  - [ ] 12.4 Wire announcements routes
    - Create announcements routes (modules/announcements/routes.ts)
    - POST /announcements - authenticate, validate(postAnnouncementSchema), postAnnouncementController (auth in controller based on visibility)
    - GET /announcements - authenticate, getAnnouncementFeedController
    - GET /announcements/:id - authenticate, getAnnouncementController
    - DELETE /announcements/:id - authenticate, deleteAnnouncementController (auth in controller)
    - Export router
    - _Requirements: Announcements APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 12.5 Write unit tests for announcements service
    - Test postAnnouncement derives clubId from departmentId for DEPARTMENT visibility
    - Test postAnnouncement validates visibility/scope combinations
    - Test getAnnouncementFeed filters correctly (GLOBAL + caller's clubs + caller's departments)
    - Test getAnnouncement returns 404 (not 403) when not visible
    - Test deleteAnnouncement allows creator, Super Admin, OR Club Head (ARCHITECTURE Correction 6)
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 13. Search Module
  - [ ] 13.1 Implement search service layer
    - Create search service (modules/search/service.ts)
    - Implement crossEntitySearch: validate query string (minimum 2 chars), filter by optional type param
    - Search clubs (name, description), events (title, description), projects (title, description), blogs (title, content) using case-insensitive LIKE/contains
    - Return all four entity arrays (clubs, events, projects, blogs) - empty arrays when not matching type filter
    - Paginate combined results, calculate totalPages based on included entity types
    - _Requirements: Search Module from FINAL_TEAM_BUILD_GUIDE.md_
  
  - [ ] 13.2 Implement search controller
    - Create search controller (modules/search/controller.ts)
    - Implement crossEntitySearchController: parse query params (q, type, page, limit), validate q present and ≥2 chars client-side before calling API, call service, return grouped results with pagination
    - _Requirements: Controller Layer Responsibilities_
  
  - [ ] 13.3 Create validation schemas
    - Create search schemas (modules/search/schemas.ts)
    - Define searchSchema: q string min 2 chars required, type enum optional (clubs | events | projects | blogs)
    - _Requirements: Input Validation Security_
  
  - [ ] 13.4 Wire search routes
    - Create search routes (modules/search/routes.ts)
    - GET /search - public, validate(searchSchema), crossEntitySearchController
    - Export router
    - _Requirements: Search APIs from FINAL_API_CONTRACT.md_
  
  - [ ]* 13.5 Write unit tests for search service
    - Test search returns all four entity keys (even if empty)
    - Test search filters by type when provided
    - Test search validates minimum query length
    - Test search performs case-insensitive matching
    - Mock Prisma client for isolation
    - _Requirements: Unit Testing Services_



- [ ] 14. Main Router Integration
  - [ ] 14.1 Create main v1 router
    - Create routes/v1/index.ts
    - Import all module routers (auth, users, club-requests, clubs, departments, events, projects, blogs, announcements, search)
    - Register each router with its base path (/auth, /users, /club-requests, /clubs, /departments, /events, /projects, /blogs, /announcements, /search)
    - Export combined router
    - _Requirements: Module Registration from ARCHITECTURE.md_
  
  - [ ] 14.2 Set up Express application
    - Create app.ts
    - Initialize Express app
    - Configure middleware: helmet (security headers), cors (with CORS_ORIGIN env var), express.json()
    - Mount v1 router at /api/v1
    - Mount errorHandler middleware last (after routes)
    - Export app
    - _Requirements: Express App Setup_
  
  - [ ] 14.3 Create server entry point
    - Create server.ts
    - Import app from app.ts
    - Import Prisma client to verify database connection
    - Start server on PORT from env var (default 3000)
    - Log server start message with port
    - Handle graceful shutdown (SIGTERM, SIGINT)
    - _Requirements: Server Entry Point_
  
  - [ ] 14.4 Verify all 52 endpoints are registered
    - Create a script or manual test to list all registered routes
    - Verify count matches 52 endpoints from FINAL_API_CONTRACT.md
    - Verify each route has correct HTTP method and middleware chain
    - _Requirements: Endpoint Inventory Verification_



- [ ] 15. Database Seeding
  - [ ] 15.1 Create seed script
    - Create prisma/seed.ts
    - Hash all passwords with bcrypt before inserting (never insert plaintext)
    - Seed users: 1 SUPER_ADMIN, 2 FACULTY_COORDINATOR, 5 STUDENT accounts
    - Seed 3 clubs with different coordinators and Club Heads
    - Seed club memberships (mix of CLUB_HEAD and MEMBER roles)
    - Seed 2 departments per club with Department Heads
    - Seed department memberships
    - Seed 5 APPROVED events (mix of PUBLIC and CLUB_EXCLUSIVE types)
    - Seed event registrations
    - Seed 3 projects per club
    - Seed 3 blog posts per club
    - Seed 5 announcements (GLOBAL, CLUB, DEPARTMENT visibility mix)
    - Use Prisma transactions for related data
    - _Requirements: Seed Script from FINAL_TEAM_BUILD_GUIDE.md Backend Critical Rules_
  
  - [ ] 15.2 Configure seed script in package.json
    - Add "prisma": { "seed": "ts-node prisma/seed.ts" } to package.json
    - Test seed script runs via `prisma db seed`
    - Verify seed data can be queried via Prisma Studio
    - _Requirements: Prisma Seed Configuration_
  
  - [ ] 15.3 Document seed credentials
    - Create SEED_CREDENTIALS.md
    - List all seeded user emails and passwords for testing
    - Include role breakdown (Super Admin, Faculty Coordinators, Students)
    - Include club assignments for quick reference
    - _Requirements: Testing Documentation_



- [ ] 16. Integration Testing
  - [ ] 16.1 Set up integration test environment
    - Configure Jest for integration tests
    - Set up test database connection (separate from dev database)
    - Create test utilities for authentication tokens (generate valid tokens for different roles)
    - Create database cleanup utilities (truncate tables between tests)
    - _Requirements: Integration Testing Setup_
  
  - [ ] 16.2 Write integration tests for critical workflows
    - Test Authentication workflow: register → login → GET /auth/me (happy path + failure path)
    - Test Club Creation workflow: submit request → approve with coordinator → club exists with Club Head membership (happy path + duplicate name conflict)
    - Test Event workflow: request event → approve → register/unregister → verify capacity (happy path + capacity overflow)
    - Test Club Head Transfer workflow: transfer head → verify old demoted, new promoted (transaction test)
    - Test Department workflow: create department → set head → add member → remove head (cascading head_user_id clear)
    - Test Announcement visibility: create GLOBAL/CLUB/DEPARTMENT → verify feed filtering (authenticated users see correct subset)
    - Test Search workflow: create entities → search cross-entity → verify all four keys present (happy path + too-short query)
    - Use supertest for HTTP testing
    - Verify one happy-path + one failure-path per module minimum
    - _Requirements: Integration Tests from FINAL_TEAM_BUILD_GUIDE.md Backend Completion Checklist_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Test-related sub-tasks are optional to prioritize implementation velocity
- Core implementation tasks (non-test) MUST be completed
- Each module follows the three-layer pattern: routes → controllers → services
- All business logic resides in service layer
- All database access uses Prisma ORM (no raw SQL)
- Transactions required for: club approval (3-step), event registration (capacity check), Club Head transfer (atomic swap)
- Authorization checked fresh from database on every request (never trust JWT role claims)
- Department Head is derived (not stored), checked via departments.head_user_id match
- Faculty Coordinator uniqueness enforced via unique constraint on clubs.faculty_coordinator_id
- Case-insensitive uniqueness for club names and department names (per club) via functional indexes



## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "4.5"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3", "6.1", "6.2", "6.3"] },
    { "id": 7, "tasks": ["5.4", "5.5", "6.4", "6.5", "7.1", "7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "7.5"] },
    { "id": 9, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2", "9.3", "10.1", "10.2", "10.3", "11.1", "11.2", "11.3"] },
    { "id": 10, "tasks": ["8.4", "8.5", "9.4", "9.5", "10.4", "10.5", "11.4", "11.5"] },
    { "id": 11, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 12, "tasks": ["12.4", "12.5", "13.1", "13.2", "13.3"] },
    { "id": 13, "tasks": ["13.4", "13.5"] },
    { "id": 14, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 15, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 16, "tasks": ["16.1"] },
    { "id": 17, "tasks": ["16.2"] }
  ]
}
```
