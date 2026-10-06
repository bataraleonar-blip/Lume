# Lume V3.6 — Redis Sessions

Lume now uses Redis for Admin and Member sessions when `REDIS_URL` is configured.

## Why
The previous in-memory store loses sessions when:
- the Node process restarts;
- a deployment replaces the instance;
- traffic is distributed across multiple instances.

Redis keeps the session state shared.

## Configure
Set:

```env
REDIS_URL=rediss://default:PASSWORD@HOST:6379
```

Use TLS (`rediss://`) for hosted Redis where supported.

## Development
If `REDIS_URL` is absent, the server falls back to memory so local development remains easy.

Do not use the fallback for production or multi-instance deployment.

## Session TTL
- Admin: 8 hours
- Member access: 30 days
- CSRF token follows the session TTL.

## Health
`GET /health` reports:

```json
{
  "ok": true,
  "version": "3.6.0",
  "sessionBackend": "redis"
}
```

## Recommended hosted setup
Use a managed Redis provider with:
- TLS
- authentication
- private network access where available
- automated backups if offered
- monitoring/alerts
