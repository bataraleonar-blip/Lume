# Lume V4.0 — Reconciliation

## Added
- Automatic expiration of memberships.
- Refund tracking with partial/full refund amount.
- Creator/platform refund allocation.
- Financial adjustment ledger.
- Reconciliation endpoint that checks paid transaction accounting fields.
- Admin reconciliation dashboard.
- Refund recording from Admin.
- Premium access is removed after a full refund.
- Membership is deactivated after a full membership refund.
- Creator balance accounts for creator-side refunds.

## Important payment rule
The Admin refund endpoint records the financial state. It does **not** itself issue money through Midtrans.

The safe operational flow is:
1. Process/confirm the refund in the payment provider.
2. Record the exact refunded amount in Lume.
3. Run reconciliation.
4. Verify creator/platform balances.

## Partial refund
Partial refunds are supported. A full refund removes the corresponding purchased content access and deactivates the membership.

## Accounting
The adjustment ledger keeps negative refund entries instead of silently rewriting historical revenue.
