# Final Deployment Checklist

## Infrastructure
- [ ] Production PostgreSQL created
- [ ] Production Redis created
- [ ] Private R2 bucket created
- [ ] Midtrans production merchant configuration ready
- [ ] HTTPS domain configured
- [ ] DNS points to the application

## Secrets
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] R2 credentials
- [ ] Midtrans server key
- [ ] Admin password hash
- [ ] Admin TOTP secret
- [ ] Admin audit hash salt

## Database
- [ ] Backup created
- [ ] Migrations 001–006 applied
- [ ] Integrity check passes

## Application
- [ ] `/healthz` returns 200
- [ ] `/readyz` returns 200
- [ ] `/admin` opens
- [ ] Admin login works
- [ ] TOTP works
- [ ] Creator profile works
- [ ] Free media works
- [ ] Member access works
- [ ] Premium checkout works
- [ ] Midtrans notification verification works
- [ ] Private R2 media is not public

## Financial
- [ ] Commission configured
- [ ] Reconciliation tested
- [ ] Refund process tested
- [ ] Backup schedule enabled
- [ ] Monitoring/alerts enabled

## Go-live
- [ ] Run one controlled real payment
- [ ] Confirm server notification
- [ ] Confirm access grant
- [ ] Confirm accounting
- [ ] Confirm admin audit event
- [ ] Keep rollback image/package
