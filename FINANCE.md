# Lume V3.9 — Financial Accounting

## Model
Each creator has a `commission_percent`, default 70%.

For a paid premium transaction:
- Gross = customer payment.
- Creator earning = gross × creator commission.
- Platform revenue = gross − creator earning.

Member-plan transactions are treated as platform revenue because the membership is not attached to a single creator.

## Payouts
Admin can record a payout against a creator only up to the creator's current unpaid balance.

A payout is recorded as `paid` with:
- amount
- reference
- note
- paid_at

## Important
This is accounting logic, not a bank transfer integration. The payout button records that Admin paid the creator externally.

Payment-provider fees, taxes, refunds, chargebacks, and other adjustments are not yet modeled.
