# Lume V4.3 — Observability

## Public operational endpoints

### `/healthz`
Liveness only.

### `/readyz`
Checks application readiness including database, Redis, R2 configuration and Midtrans configuration.

### `/metrics`
Returns low-cardinality JSON counters:
- HTTP request count
- HTTP 2xx/3xx/4xx/5xx counts
- process uptime

Do not put contacts, order IDs, creator names, tokens or payment secrets into metrics.

## Admin diagnostics

`GET /api/admin/diagnostics`

Admin-only operational summary:
- database status
- paid/pending/failed payment counts
- refunded order count
- active/inactive membership counts
- refund adjustment totals
- financial adjustment count

This is intentionally aggregate-only.

## Recommended alerts

- readiness unavailable for 2–3 consecutive checks
- 5xx rate above baseline
- pending payments growing continuously
- failed payment count spikes
- refund activity materially deviates from normal
- active membership count drops unexpectedly
- database latency/errors increase

## Privacy

Operational telemetry must remain aggregate. Never expose purchaser contact information or financial records through public health/metrics endpoints.
