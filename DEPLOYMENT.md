# Lume V3.4 Deployment Map

## Required services
1. Node.js hosting
2. PostgreSQL
3. Cloudflare R2
4. Midtrans
5. Domain + HTTPS

## Environment variables
See `.env.example`.

## Runtime
The application serves:
- `/` public Lume
- `/c/:handle` creator profile
- `/access` member portal
- `/admin` admin dashboard
- `/health` health check

## Critical production rule
Payment success is granted only from a verified server notification. A browser redirect to a payment-success page must never be treated as proof of payment.

## Media rule
Premium/member files remain private in R2. The backend authorizes access and returns a short-lived signed URL.
