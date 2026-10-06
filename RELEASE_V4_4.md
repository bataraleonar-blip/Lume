# Lume V4.4 Release

Based on V4.3.

Added:
- `system_jobs` operational state
- PostgreSQL advisory-lock job protection
- scheduled membership expiration
- orphan content-access cleanup
- financial/accounting anomaly detection
- aggregate integrity inspection
- Admin job status and manual job trigger
- migration `005_reliability.sql`

No financial anomaly is silently rewritten by the automatic job.
