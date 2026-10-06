# Lume 5.0 — Final Production Release

This is the consolidated final package built from the Lume V4.x line.

## Included

### Public
- creator profiles
- free media
- member-only media
- individually purchasable premium media
- media grid/profile experience

### Member / purchaser
- no account/password required
- WhatsApp number or email as contact identity
- one-time 30-day membership
- individual premium purchase
- protected private media access

### Admin
- secure Admin authentication
- TOTP 2FA
- creator management
- post/media management
- private R2 upload flow
- payment/transaction management
- revenue/accounting
- creator commission
- payouts ledger
- refunds/reconciliation
- diagnostics/integrity tools
- security event summary
- audit trail

### Production
- PostgreSQL
- Redis sessions
- Cloudflare R2 private media
- Midtrans server-side payment confirmation
- health/readiness checks
- structured logging
- graceful shutdown
- migrations
- backup/restore tools
- integrity jobs
- Docker
- CI validation

## Admin setup

Generate a password hash:
```bash
node scripts/create-admin-hash.js
```

Put the result into:
```env
ADMIN_PASSWORD_HASH=...
```

Set:
```env
ADMIN_TOTP_SECRET=...
ADMIN_AUDIT_HASH_SALT=<random-secret>
```

Do not commit `.env`.

## Admin URL

After deployment:
```text
https://YOUR-DOMAIN/admin
```

## Important

The package is production-ready code, but it is not itself a hosted website. A real public URL requires deployment to a hosting account and a domain/DNS configuration.

No fake URL or fake payment credentials are included.
