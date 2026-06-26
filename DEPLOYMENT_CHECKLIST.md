# FC MatchHub Deployment Checklist

## Required Before Public Launch

- Configure `DATABASE_URL` so users, sessions, and app workflow data use PostgreSQL instead of local JSON fallback.
- Keep server-side HttpOnly sessions enabled. Do not rely on localStorage for production access control.
- Set `ADMIN_ACCESS_KEY` to protect the current `/creator-admin` surface, then replace it with app creator/admin roles before public launch.
- Configure `APP_BASE_URL`, `EMAIL_FROM`, and `RESEND_API_KEY` for real email verification and password reset.
- Configure `STRIPE_SECRET_KEY` before enabling card deposits.
- Keep `ALLOW_DEV_VERIFY_LINK=false` and `ALLOW_MOCK_PAYMENTS=false` in production.
- Connect PayPal checkout/payouts before enabling PayPal.
- Connect Coinbase Commerce or another compliant crypto provider before enabling crypto.
- Confirm legal/compliance requirements for paid competitions, wagers, age restrictions, regions, taxes, refunds, and disputes.
- Add object storage for club logos and screenshot proof.
- Add rate limiting, request validation, audit logs, and admin action history.

## Backend Progress

- PostgreSQL schema exists in `server/schema.sql`; the server initializes it automatically when `DATABASE_URL` is set.
- Local app-state fallback still exists in `server/storage/appState.json` when no database is configured.
- Real routes now exist for match creation, match status updates, tournament creation, tournament joins, payout review requests, payments, auth, and EA club search/verification.
- Unknown `/api/*` routes now return JSON `404` instead of serving the frontend HTML.

## Local-Only Notes

The current JSON storage is useful for local testing, but it is not a production database. Files under `server/storage/*.json` are ignored by git and should not be deployed as real app data.
