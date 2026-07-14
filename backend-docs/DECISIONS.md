# Architectural Decision Records

## Introduction

This document records the key architectural and technology decisions made for the CampusOS backend implementation. Each decision follows the ADR (Architectural Decision Record) format: Context, Decision, and Consequences.

---

## ADR-001: Express.js as Backend Framework

**Context:**

CampusOS requires a Node.js-based REST API backend that can:
- Handle authentication and authorization for multiple user roles
- Support CRUD operations across 10 feature modules
- Integrate seamlessly with PostgreSQL via Prisma ORM
- Deploy easily to Render platform
- Enable rapid MVP development with minimal boilerplate

**Decision:**

Use **Express.js** as the backend framework.

**Alternatives Considered:**
- **Fastify**: Higher performance, but less mature ecosystem
- **NestJS**: Enterprise-grade with built-in architecture, but adds unnecessary complexity for MVP scope
- **Hapi**: Strong plugin system, but smaller community and steeper learning curve

**Consequences:**

✅ **Positive:**
- Mature ecosystem with extensive middleware available
- Team familiarity reduces onboarding time
- Excellent Prisma integration
- Lightweight and flexible for MVP iteration
- Large community support for troubleshooting

⚠️ **Tradeoffs:**
- Less opinionated than NestJS (requires explicit architectural discipline)
- Slightly lower raw performance than Fastify (acceptable for MVP scale)

---

## ADR-002: Prisma as ORM

**Context:**

CampusOS database design includes:
- 12 tables with complex relationships (one-to-many, many-to-many)
- Foreign key constraints with specific cascade behavior
- Enum types (PlatformRole, ClubRole, EventStatus, etc.)
- TypeScript-based backend requiring type-safe database access


**Decision:**

Use **Prisma ORM** for database access.

**Alternatives Considered:**
- **TypeORM**: More feature-rich, but heavier and more complex API
- **Sequelize**: Mature ORM, but lacks TypeScript-first design
- **Knex.js**: Query builder with full control, but requires manual type definitions

**Consequences:**

✅ **Positive:**
- Type-safe database queries auto-generated from schema
- Declarative migration management (`prisma migrate`)
- Intuitive relation handling (`.include()`, `.select()`)
- Excellent TypeScript integration
- Built-in connection pooling

⚠️ **Tradeoffs:**
- Less control over raw SQL compared to query builders
- Learning curve for Prisma-specific patterns (e.g., transactions, upserts)

---

## ADR-003: PostgreSQL on Render

**Context:**

CampusOS data model requires:
- Relational integrity (foreign keys, cascades)
- ACID transactions (e.g., club creation approval flow)
- Enum types for constrained values
- JSON fields for flexible data (`social_links`)
- Managed hosting with minimal operational overhead

**Decision:**

Use **PostgreSQL hosted on Render**.

**Alternatives Considered:**
- **MySQL**: Mature but weaker JSON support
- **MongoDB**: NoSQL flexibility, but loses relational guarantees needed for business rules
- **SQLite**: Lightweight, but not suitable for production multi-user system


**Consequences:**

✅ **Positive:**
- Robust relational model enforcement
- Native JSON support for `social_links` field
- Enum types align perfectly with application enums
- Render provides managed backups, SSL, and scaling
- Strong ACID guarantees for multi-step workflows

⚠️ **Tradeoffs:**
- Vendor lock-in to Render (mitigated by PostgreSQL portability)
- Requires explicit migration management vs schema-less NoSQL

---

## ADR-004: JWT-Based Authentication

**Context:**

CampusOS authentication requirements:
- Support three platform roles (SUPER_ADMIN, FACULTY_COORDINATOR, STUDENT)
- Support dynamic club/department roles evaluated per request
- Frontend stored in separate deployment (Vercel) from backend (Render)
- No session storage infrastructure in MVP scope

**Decision:**

Use **JWT (JSON Web Tokens)** for stateless authentication.

**Alternatives Considered:**
- **Session-based auth**: Requires server-side session store (Redis), adds operational complexity
- **OAuth 2.0**: External provider dependency, marked out-of-scope for MVP

**Consequences:**

✅ **Positive:**
- Stateless: no server-side session storage needed
- Scales horizontally without sticky sessions
- Works seamlessly across frontend (Vercel) and backend (Render) deployments
- Client storage in `localStorage` simple to implement


⚠️ **Tradeoffs:**
- Cannot invalidate tokens server-side without additional infrastructure
- Token expiration must be managed (refresh strategy out of MVP scope)
- Club/department roles must be re-evaluated from database on every request (never trust JWT claims for these)

---

## ADR-005: Modular Monolith Architecture

**Context:**

CampusOS backend includes 10 feature modules:
- Authentication, Users, Club Requests, Clubs, Departments, Events, Projects, Blogs, Announcements, Search
- MVP timeline requires rapid development
- Team size and operational maturity favor simplicity
- Future modules may be added post-MVP

**Decision:**

Use **modular monolith architecture** with clear module boundaries.

**Alternatives Considered:**
- **Microservices**: Higher operational complexity (service discovery, API gateways, distributed tracing)
- **Monolithic ball of mud**: Faster initially, but harder to maintain and extend

**Consequences:**

✅ **Positive:**
- Single deployment artifact (simpler CI/CD)
- Shared database reduces distributed transaction complexity
- Module boundaries prevent tight coupling
- Easy to extract microservices later if needed
- Single codebase aids debugging and testing

⚠️ **Tradeoffs:**
- Cannot scale modules independently (acceptable for MVP)
- Requires discipline to maintain module boundaries

---

## ADR-006: bcrypt for Password Hashing

**Context:**

CampusOS stores user passwords and must:
- Protect against brute-force attacks
- Use industry-standard hashing algorithm
- Balance security and performance for login operations


**Decision:**

Use **bcrypt** with cost factor 10-12 for password hashing.

**Alternatives Considered:**
- **Argon2**: More modern, but less mature Node.js ecosystem
- **PBKDF2**: Older standard, bcrypt preferred for stronger resistance to GPU attacks
- **scrypt**: Strong algorithm, but bcrypt more widely adopted

**Consequences:**

✅ **Positive:**
- Industry-standard algorithm with proven security track record
- Tunable cost factor allows security/performance balance
- Built-in salt generation
- Excellent Node.js library support (`bcryptjs`, `bcrypt`)

⚠️ **Tradeoffs:**
- CPU-intensive (intentional for security, but requires reasonable cost factor)
- Cost factor 10-12 balances security and UX for login speed

---

## ADR-007: Hard Deletes Only

**Context:**

MVP scope explicitly excludes:
- Audit logging
- Data recovery workflows
- Historical data analysis

Deletion operations include:
- Club memberships, department memberships
- Projects, blogs, announcements
- Event registrations
- User's own pending club requests

**Decision:**

Implement **hard deletes** (permanent removal from database).

**Alternatives Considered:**
- **Soft deletes**: Add `deleted_at` timestamp, filter queries to exclude deleted rows

**Consequences:**

✅ **Positive:**
- Simpler database schema (no `deleted_at` column management)
- Simpler queries (no need to filter `WHERE deleted_at IS NULL` everywhere)
- Reduced storage requirements
- Clear MVP scope alignment


⚠️ **Tradeoffs:**
- No data recovery after accidental deletion
- No historical audit trail
- Future migration to soft deletes will require schema changes

---

## ADR-008: Out-of-Scope Features

**Context:**

To meet MVP timeline, the following features are explicitly excluded from implementation.

**Decision:**

Do **NOT** implement the following features:

### Authentication & User Management
- Google OAuth login
- Password reset flow
- Email verification flow

### Integrations
- Google Calendar integration for events
- File upload service (images/links are plain URL strings)

### Advanced Features
- Advanced full-text search (using PostgreSQL ILIKE only)
- In-app notification center
- Platform analytics dashboard
- Audit logging
- Rate limiting / abuse protection

### Data Management
- Soft deletes (hard deletes only)
- More than one Club Head per club
- More than one club per Faculty Coordinator at the same time

### Architecture Patterns
- CQRS (Command Query Responsibility Segregation)
- Event Sourcing
- Saga Pattern
- Domain-Driven Design aggregate patterns
- Hexagonal architecture

### Infrastructure
- Microservices
- Kubernetes or container orchestration
- Multi-region deployment

**Consequences:**

✅ **Positive:**
- Reduced MVP scope enables faster delivery
- Simpler codebase reduces maintenance burden
- Clear boundaries prevent scope creep


⚠️ **Tradeoffs:**
- Limited authentication options (email/password only)
- Manual deployment processes (no orchestration)
- Basic search functionality
- No data recovery after deletion
- Single Club Head and Faculty Coordinator constraints

---

## Summary

These decisions prioritize MVP delivery speed while maintaining:
- Strong data integrity (PostgreSQL + Prisma)
- Secure authentication (JWT + bcrypt)
- Clean architecture (modular monolith)
- Operational simplicity (managed services)
- Extensibility for post-MVP features

All decisions align with the team build guide's explicit scope and constraints.


# Appendix: Implementation Corrections

## Correction 1: ADR-002 context overstates table count

Affected Section:
`## ADR-002: Prisma as ORM` → **Context**

Problem:
States *"CampusOS database design includes: 12 tables with complex relationships..."* The actual schema — per `FINAL_TEAM_BUILD_GUIDE.md`'s Database Setup section and `API_AND_DATABASE_SPEC.md`'s own table list — has 11 tables: `users`, `club_creation_requests`, `clubs`, `club_memberships`, `departments`, `department_memberships`, `events`, `event_registrations`, `projects`, `blogs`, `announcements`.

Source of Truth:
`FINAL_TEAM_BUILD_GUIDE.md`, Database Setup → Tables section lists exactly these 11 tables, no more.

Correct Implementation:
Change "12 tables" to "11 tables" in ADR-002's Context. No other change is needed — the rest of ADR-002 (rationale for choosing Prisma) is unaffected by the exact count and remains accurate.

Implementation Impact:
- None functionally. This is a documentation-accuracy fix only, included because the same miscount appears independently in `API_AND_DATABASE_SPEC.md`'s closing Schema Statistics (see that document's Correction 9), suggesting a shared error worth correcting in both places at once.

---

**Note:** No other corrections apply to this document. Per the audit, ADR-001, ADR-003 through ADR-008 are all consistent with `FINAL_API_CONTRACT.md` and `FINAL_TEAM_BUILD_GUIDE.md` as written — this remains the most reliable of the reviewed documents.