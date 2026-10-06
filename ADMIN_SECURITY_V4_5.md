# Lume V4.5 — Admin Security

## Security event ledger

Migration `006_admin_security.sql` adds `admin_security_events`.

The ledger stores:
- event type
- success/failure
- HMAC-hashed IP
- HMAC-hashed user-agent
- minimal non-sensitive metadata
- timestamp

Raw IP, user-agent, passwords, tokens and secrets are not stored by the helper.

## Admin summary

`GET /api/admin/security/summary`

Admin-only aggregate summary for the previous 24 hours.

## Session policy

Production recommendations:
- Redis-backed sessions only
- HttpOnly + Secure + SameSite cookies
- short admin session TTL
- CSRF protection on state-changing routes
- TOTP required for Admin
- rate-limit login failures
- rotate secrets if compromise is suspected

## Recovery

Do not implement a password-reset link that bypasses the second factor.

If the Admin loses access:
1. stop public/admin access if compromise is suspected
2. use the hosting secret manager/console to rotate the admin password hash
3. rotate the TOTP secret
4. invalidate Redis sessions
5. inspect `admin_security_events`
6. rotate any compromised application secrets

Recovery should be an operator-controlled process, not an unauthenticated public endpoint.

## Secret rotation

Rotate:
- admin password hash
- TOTP secret
- Redis credentials
- R2 access credentials
- Midtrans server key

After rotation, verify `/readyz` and perform a controlled admin login.

## Audit retention

Keep security events according to the business/legal retention policy. Back them up with PostgreSQL.
