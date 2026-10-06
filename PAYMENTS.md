# Lume V3.7 Payment Hardening

## Protection added
- Notification signature is mandatory.
- Order must exist in PostgreSQL.
- Notification gross amount must exactly match the stored order amount.
- Payment access is granted only after a paid transaction status.
- Paid orders are idempotent.
- Membership/content access creation uses `ON CONFLICT DO NOTHING`.
- A later failure notification cannot downgrade an already-paid order.
- Unknown/intermediate payment statuses do not grant access.
- Duplicate pending checkout for the same contact/item is blocked for 30 minutes.
- Provider transaction ID is unique when present.

## Midtrans notification mode

This package explicitly requires:

```env
MIDTRANS_NOTIFICATION_MODE=legacy
```

The current sample verifies the legacy `signature_key` mechanism.

**Important:** Midtrans supports different notification mechanisms. If your merchant account uses BI-SNAP/X-SIGNATURE, do not use the legacy verifier unchanged. Implement the exact current verification required by that account before production.

## Production test cases

1. Successful payment -> membership/access created once.
2. Same webhook twice -> no duplicate access.
3. Wrong gross amount -> rejected.
4. Wrong signature -> rejected.
5. Unknown order -> rejected.
6. `pending` -> no access.
7. `expire`/`deny` -> no access.
8. Paid then duplicate failure -> remains paid.
9. Browser returns from payment without webhook -> still no access.
