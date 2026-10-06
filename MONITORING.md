# Lume V4.1 Monitoring
- `/healthz`: liveness.
- `/readyz`: DB, Redis, R2 configuration and Midtrans readiness.
Monitor 5xx rate, readiness failures, DB/Redis/R2 errors, webhook failures, pending payments, CPU/memory and backup freshness.
Production logs are structured JSON. Never log passwords, TOTP, cookies, R2 keys or Midtrans server key.
PostgreSQL backup example:
`pg_dump "$DATABASE_URL" --format=custom --file=lume-$(date +%Y%m%d-%H%M).dump`
Restore only after a controlled maintenance decision:
`pg_restore --clean --if-exists --dbname="$DATABASE_URL" lume-YYYYMMDD-HHMM.dump`

## V4.2 release safety
Use `scripts/backup-db.sh` before releases and periodically verify backups with `scripts/verify-backup.sh`. Track migration failures separately from application health.
