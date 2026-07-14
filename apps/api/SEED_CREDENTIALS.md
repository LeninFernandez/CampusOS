# Seed Credentials

> **Development use only.** This data is seeded by `prisma/seed.ts` and is intended for local development and testing. Do not use these credentials in production.

## Users

| Email | Password | Platform Role | Club Assignments |
|---|---|---|---|
| alice@campusos.edu | Admin@123! | SUPER_ADMIN | — |
| bob@campusos.edu | Faculty@123! | FACULTY_COORDINATOR | Faculty Coordinator — Robotics Club |
| carol@campusos.edu | Faculty@123! | FACULTY_COORDINATOR | Faculty Coordinator — Web Dev Club |
| david@campusos.edu | Student@123! | STUDENT | Robotics Club (Club Head) |
| eva@campusos.edu | Student@123! | STUDENT | Web Dev Club (Club Head) |
| frank@campusos.edu | Student@123! | STUDENT | Data Science Club (Club Head) |
| grace@campusos.edu | Student@123! | STUDENT | Robotics Club (Member), Web Dev Club (Member) |
| henry@campusos.edu | Student@123! | STUDENT | Robotics Club (Member), Data Science Club (Member) |

## Seeded Data Summary

- **8 users** (1 Super Admin, 2 Faculty Coordinators, 5 Students)
- **3 clubs** (Robotics Club, Web Dev Club, Data Science Club)
- **6 departments** (2 per club)
- **5 events** (all APPROVED, mix of PUBLIC and CLUB_EXCLUSIVE)
- **9 projects** (3 per club)
- **9 blog posts** (3 per club)
- **5 announcements** (2 GLOBAL, 2 CLUB, 1 DEPARTMENT)

## Running the Seed

```bash
cd apps/api
npx prisma db seed
```

Or via the npm script:

```bash
npm run prisma:seed
```
