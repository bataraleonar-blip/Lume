# Audit Operations

Existing `admin_audit` remains the source of administrative action history.

For production:
- retain audit rows according to the business/legal retention policy
- never store passwords, TOTP secrets, session tokens, or raw payment credentials
- include a meaningful action name and minimal metadata
- restrict audit access to Admin
- back up audit data with PostgreSQL
