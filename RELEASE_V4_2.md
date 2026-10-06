# Lume V4.2 — Release Safety

V4.2 keeps the V4.1 application features and adds safer release operations.

## Migration runner
Use:
```bash
node scripts/migrate.js
```

Migrations are discovered from `db/`, sorted numerically, and recorded in `schema_migrations`.
Already-applied versions are skipped.

## Production startup
The production Docker image runs:
```bash
scripts/start-production.sh
```
which applies pending migrations before starting Node.

For highly controlled environments, run migrations as a separate release job instead of automatically at application startup.

## Backup
```bash
./scripts/backup-db.sh
```

Recommended policy:
- daily full PostgreSQL backup
- off-site copy
- periodic restore verification
- defined RPO/RTO

## Restore verification
Use a disposable PostgreSQL database:
```bash
BACKUP_FILE=./backups/lume-YYYYMMDD-HHMMSS.dump \
DATABASE_URL=postgresql://... \
./scripts/verify-backup.sh
```

Never test a restore against the live production database.

## CI
`.github/workflows/ci.yml` validates:
- dependency installation
- server syntax
- migration syntax/execution
- PostgreSQL connectivity

## Release order
1. Backup production DB.
2. Deploy release image/package.
3. Run migrations in controlled mode.
4. Start application.
5. Check `/healthz`.
6. Check `/readyz`.
7. Verify admin login.
8. Verify public creator page.
9. Verify member access.
10. Verify payment notification processing in the appropriate test/production mode.
11. Monitor errors and latency.

## Rollback
Application rollback and database rollback are different operations.
Do not blindly reverse SQL migrations. Prefer forward-fix migrations unless a tested database restore is required.
