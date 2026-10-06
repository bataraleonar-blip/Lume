# V4.5 Security Checklist

- [ ] Production uses Redis sessions
- [ ] Admin TOTP enabled
- [ ] Admin login rate limit enabled
- [ ] CSRF enabled for mutations
- [ ] HTTPS enabled
- [ ] Secure cookies enabled
- [ ] `ADMIN_AUDIT_HASH_SALT` set to a random production secret
- [ ] No secrets committed to Git
- [ ] Backup before secret rotation
- [ ] Recovery procedure tested privately
- [ ] Security event summary accessible only to Admin
- [ ] Security logs contain no passwords/tokens/payment secrets
