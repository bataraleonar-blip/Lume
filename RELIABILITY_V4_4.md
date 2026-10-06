# Lume V4.4 — Reliability & Data Integrity

## Integrity checks

Admin endpoints:
- `GET /api/admin/integrity`
- `GET /api/admin/jobs`
- `POST /api/admin/jobs/integrity/run`

The integrity inspection looks for:
- duplicate provider transaction IDs
- duplicate order IDs
- access rows whose purchase no longer exists
- active memberships already past expiry

## Scheduled integrity job

The application periodically:
- expires memberships whose expiry time has passed
- removes orphan content-access rows
- reports paid premium purchases whose creator/accounting relationships look invalid
- reports invalid accounting fields

The job uses PostgreSQL advisory locks so multiple application instances do not run the same job simultaneously.

## Important

The integrity job intentionally does not silently rewrite financial history. Suspicious paid transactions are reported for Admin reconciliation rather than automatically altered.

## Production recommendation

Run the integrity job at least every 15 minutes. Tune `LUME_INTEGRITY_INTERVAL_MS` according to traffic and database capacity.

Before enabling it on a production database:
1. Apply migration `005_reliability.sql`.
2. Run `/api/admin/integrity`.
3. Resolve existing anomalies.
4. Then enable scheduled jobs.
