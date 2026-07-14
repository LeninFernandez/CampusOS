# Migrations

Run migrations from the `apps/api` directory:

## Initial setup

```bash
npx prisma migrate dev --name init
```

This will:
1. Create the database schema
2. Generate the Prisma Client
3. Apply functional indexes for case-insensitive uniqueness (see notes below)

## Case-insensitive uniqueness indexes

The following constraints cannot be expressed in `schema.prisma` and are applied via raw SQL during migration:

- `clubs.name` — unique on `LOWER(name)`
- `departments.(club_id, name)` — unique on `(club_id, LOWER(name))`

After running `prisma migrate dev --name init`, open the generated migration SQL file and add these indexes:

```sql
-- Case-insensitive unique index for club names
CREATE UNIQUE INDEX "clubs_name_lower_key" ON "clubs"(LOWER(name));

-- Case-insensitive unique index for department names per club
CREATE UNIQUE INDEX "departments_club_id_name_lower_key" ON "departments"(club_id, LOWER(name));

-- Check constraints (Prisma does not generate these)
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_check" CHECK (capacity IS NULL OR capacity > 0);
ALTER TABLE "events" ADD CONSTRAINT "events_end_time_check" CHECK (end_time > start_time);
```

Then re-run `npx prisma migrate dev --name init` or apply via `npx prisma migrate deploy`.
