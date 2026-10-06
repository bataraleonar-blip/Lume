# Lume V3.5 Security Notes

## Added in V3.5
- Helmet security headers.
- `x-powered-by` disabled.
- Strict no-store caching for application responses.
- Rate limiting for admin login, access activation and checkout.
- Same-origin protection for state-changing requests.
- CSRF tokens for cookie-authenticated Admin and Member mutation endpoints.
- Stronger input limits for JSON, contact, titles, bios and filenames.
- Strict media MIME allowlist.
- File size enforcement before presigned upload.
- PostgreSQL pool timeouts/size.
- Constant-time token comparisons.
- HttpOnly + Secure (production) + SameSite cookies.
- In-memory session cleanup on expiry.

## Still required before public launch
1. Replace in-memory sessions with Redis or a DB-backed session store.
2. Configure current Midtrans notification verification correctly for the merchant account.
3. Consider WAF/CDN protection and bot controls.
4. Add malware/content scanning if uploads can ever come from non-admin users.
5. Add structured security/audit monitoring and alerting.
6. Rotate R2 and Midtrans secrets periodically.
7. Keep database and backups encrypted and access-controlled.
8. Test restore procedures.
