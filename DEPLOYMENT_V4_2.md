# Lume V4.2 Deployment
1. Node.js 22+, PostgreSQL, Redis 7+, private Cloudflare R2, Midtrans, HTTPS.
2. Configure all `.env.example` secrets in the platform secret store.
3. Run migrations 001 through 004, after a DB backup.
4. Set `REDIS_URL` in production; do not rely on memory sessions.
5. Configure TLS/reverse proxy and set `TRUST_PROXY=1` only when appropriate.
6. Configure `/healthz` as liveness and `/readyz` as readiness.
7. Verify the current Midtrans notification verification mode before production.
8. Test admin, upload, member activation and payment/webhook flow.
9. Keep rollback image/package and backups.
This package does not deploy cloud resources automatically.

## V4.2 update
Use `scripts/migrate.js` for deterministic migrations and `scripts/backup-db.sh` before releases. The Docker production command runs the migration runner before Node starts; for strict release pipelines, run migrations as a dedicated job instead.
