# Migrations

No migration tool (Alembic, etc.) — kept simple for this project's scope.
Instead, every schema change is a new numbered `.sql` file here, applied
in order.

## Convention
- `0001_initial_schema.sql` — the full schema as finalized (users, drivers,
  trips, payments, feedback, emergency contacts, safety alerts, driver
  rental, tour guide attractions, etc.)
- Future changes go in new files: `0002_add_xyz.sql`, `0003_alter_abc.sql`, etc.
  Each new file should contain only the incremental change (`ALTER TABLE`,
  `CREATE TABLE`, etc.), not the whole schema again.

## Applying migrations locally
`docker-compose.yml` auto-runs every `.sql` file in this folder, in
filename order, the first time the Postgres container starts.

If you're adding a new migration to an **already-running** container
(so the auto-init won't re-trigger), apply it manually:
```bash
docker exec -i smart_cab_postgres psql -U postgres -d smart_cab_db < migrations/000X_your_migration.sql
```

Or wipe and reinitialize from scratch (only do this if you don't mind
losing local seed data):
```bash
docker compose down -v
docker compose up -d
```

## When we move to Supabase
Run each migration file, in order, in the Supabase SQL Editor.
