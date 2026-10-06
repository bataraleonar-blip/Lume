# Lume v3.3 — Unified

Semua modul sekarang berada dalam satu project:
- Public creator discovery/profile
- Free / Member / Premium content
- Member Portal / Akses Saya
- Midtrans checkout + server webhook
- Private Cloudflare R2 + signed URLs
- PostgreSQL
- Admin dashboard
- Creator management
- Content upload/edit/archive
- Transaction/revenue dashboard
- Admin password + TOTP 2FA

## Struktur
- `server.js` — satu backend
- `public/index.html` — public/member UI
- `public/admin/index.html` — Admin
- `src/r2.js` — private R2
- `src/midtrans.js` — Midtrans
- `src/security.js` — session/password/2FA

## Environment minimum
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=lume-media
MIDTRANS_SERVER_KEY=...
MIDTRANS_PRODUCTION=false
MEMBER_PRICE_IDR=99000
PUBLIC_BASE_URL=https://domain-kamu.com
ADMIN_PASSWORD_HASH=...
ADMIN_TOTP_SECRET=...
MAX_MEDIA_BYTES=262144000
```

## Database
Gunakan schema Lume sebelumnya untuk:
`creators`, `posts`, `plans`, `purchases`, `memberships`, `content_access`, `admin_audit`.

## Production hardening sebelum launch
1. Pindahkan in-memory sessions ke Redis/DB.
2. Tambahkan CSRF protection.
3. Rate-limit login, 2FA, activation, checkout.
4. Tambahkan unique constraints untuk purchase-derived access.
5. Gunakan HTTPS.
6. Sesuaikan verifikasi webhook dengan mode notification Midtrans yang benar (contoh memakai legacy `signature_key`).
7. Tambahkan monitoring, backup PostgreSQL, dan cleanup job untuk upload R2 yang orphan.
8. Jangan jadikan bucket R2 public.
9. Uji pembayaran sandbox end-to-end sebelum production.


# V3.4 Deployment Ready

## 1. PostgreSQL
Buat database PostgreSQL kemudian jalankan:

```bash
psql "$DATABASE_URL" -f db/001_init.sql
```

Atau gunakan migration runner pilihan Anda yang mengeksekusi file SQL tersebut.

## 2. Buat password admin
Generate hash password menggunakan Node:

```bash
node -e "const crypto=require('crypto');const p=process.argv[1],s=crypto.randomBytes(16),h=crypto.scryptSync(p,s,64);console.log(s.toString('hex')+':'+h.toString('hex'))" "PASSWORD-ADMIN-KAMU"
```

Masukkan hasilnya ke `ADMIN_PASSWORD_HASH`.

## 3. Buat secret TOTP
Gunakan secret base32 acak. Contoh:

```bash
node -e "const {randomBytes}=require('crypto');console.log(randomBytes(20).toString('hex').toUpperCase())"
```

Untuk produksi, secret sebaiknya dibuat/dikelola melalui authenticator/TOTP provisioning yang benar dan disimpan sebagai secret environment.

## 4. Install & start

```bash
npm install
npm start
```

## 5. R2
Bucket **harus private**. Browser hanya menerima presigned URL dari server.

Buat API token R2 dengan izin minimum:
- Object Read
- Object Write

Jangan masukkan R2 secret ke frontend.

## 6. Midtrans
Isi `MIDTRANS_SERVER_KEY`.
Untuk awal gunakan:

```env
MIDTRANS_PRODUCTION=false
```

Uji sandbox terlebih dahulu.

Webhook Midtrans diarahkan ke:

```text
https://domain-anda.com/api/webhooks/midtrans
```

**Catatan penting:** contoh webhook di project masih menggunakan verifikasi `signature_key` model legacy. Sebelum production, sesuaikan implementasi dengan notification/signature mode yang benar pada akun Midtrans Anda, termasuk mode BI-SNAP/X-SIGNATURE jika akun Anda menggunakannya.

## 7. Production checklist

- HTTPS aktif.
- PostgreSQL backup aktif.
- R2 bucket private.
- Admin password kuat.
- TOTP aktif.
- Jangan commit `.env`.
- Tambahkan rate limiting untuk login, 2FA, activation dan checkout.
- Tambahkan CSRF protection bila autentikasi berbasis cookie digunakan untuk endpoint mutasi.
- Pindahkan session in-memory ke Redis/DB sebelum menjalankan beberapa instance server.
- Tambahkan monitoring dan alert.
- Uji webhook dengan transaksi sandbox.
- Uji idempotensi webhook.
- Uji expired membership.
- Uji premium tanpa pembayaran.
- Uji akses setelah logout.
- Uji signed URL setelah kadaluarsa.


## V3.5 Security Hardening
See `SECURITY.md`. The application now includes Helmet, rate limits, same-origin checks, CSRF tokens for cookie-authenticated mutations, stronger validation, and safer cookie/session handling.


## V3.6 Redis Sessions
Set `REDIS_URL` in production. Without it, Lume falls back to in-memory sessions for development only. See `REDIS.md`.


## V3.7 Payment Hardening
See `PAYMENTS.md` and run `db/002_payment_hardening.sql`. Payment access is now idempotent and amount-checked. Configure the actual Midtrans notification verification mode before production.


## V3.8 Super Admin Dashboard
See `ADMIN_DASHBOARD.md`. Financial analytics remain admin-only, with CSV transaction export.


## V3.9 Financial Accounting
See `FINANCE.md` and run `db/003_financial_accounting.sql`. Admin can set creator commission and record creator payouts; all financial information remains admin-only.


## V4.0 Reconciliation
See `RECONCILIATION.md` and run `db/004_reconciliation.sql`. Lume now tracks refunds, expired memberships, accounting adjustments, and reconciliation checks.

## V4.2 Release Safety
See `RELEASE_V4_2.md` for migrations, backup/restore verification, CI, startup and rollback guidance.

## V4.3 Observability
See `OBSERVABILITY_V4_3.md` for operational metrics, diagnostics and monitoring guidance.

## V4.4 Reliability
See `RELIABILITY_V4_4.md` for integrity checks and scheduled reliability jobs.

## V4.5 Admin Security
See `ADMIN_SECURITY_V4_5.md` and `SECURITY_V4_5_CHECKLIST.md` for Admin account security and recovery procedures.
