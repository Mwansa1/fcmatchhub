# FC MatchHub Full-Stack App

This folder breaks the prototype into a clearer app structure for VS Code editing.

## Run

```bash
cd fc-matchhub-fullstack
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Structure

- `client/index.html` - app shell
- `client/src/styles.css` - visual system, layout, responsive styles
- `client/src/app.js` - page rendering and client interactions
- `server/index.js` - static file server plus backend API
- `server/data.js` - mock data for the app
- `server/appStore.js` - local persistent app state for matches, tournaments, wallet requests, notifications, and admin queues
- `server/db.js` and `server/schema.sql` - PostgreSQL connection and schema
- `server/sessionStore.js` - HttpOnly cookie session storage
- `server/eaProvider.js` - EA Pro Clubs provider adapter for club search, club verification, and match lookup

The backend is intentionally dependency-free for now, so it can run with Node.js only. Deployment mode is set to fail closed for email verification and payments unless live provider credentials are configured.

## Deployment Mode

Use `.env.example` as the production checklist. Set these values in your deployment provider, not only on your local machine:

- `NODE_ENV=production`
- `APP_BASE_URL` - your deployed app URL, for example `https://fcmatchhub.com`
- `DATABASE_URL` - required for PostgreSQL-backed production storage
- `EMAIL_FROM` and `RESEND_API_KEY` - required before accepting real manager signups
- `EA_API_MODE=live` and `EA_PRO_CLUBS_API_URL` if you receive an official EA/partner API base URL
- `ALLOW_DEV_VERIFY_LINK=false`
- `ALLOW_MOCK_PAYMENTS=false`
- `ADMIN_ACCESS_KEY` - required to unlock `/creator-admin`
- `STRIPE_SECRET_KEY` - required before card deposits can create live Stripe Checkout sessions
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `COINBASE_COMMERCE_API_KEY` - required before enabling those methods live

Render-compatible service settings are included in `render.yaml`. Review `DEPLOYMENT_CHECKLIST.md` before public launch.

## App API Progress

The app now has persistent local backend routes for core workflows:

- `POST /api/matches` - create a match request
- `PATCH /api/matches/:id` - update match status
- `POST /api/tournaments` - create a tournament
- `POST /api/tournaments/:id/join` - join or request to join a tournament
- `POST /api/payout-reviews` - send payout review to the admin queue

Unknown `/api/*` routes return JSON `404` responses.

## Real Email Testing

When `RESEND_API_KEY` and `EMAIL_FROM` are set, account creation sends a real verification email. Without them, real signups are rejected so you do not accidentally onboard managers without email verification.

For local development only, copy `.env.local.example` to `.env` if you want browser verification links and mock payment records. Do not deploy with those local settings.

When `DATABASE_URL` is set, users, sessions, and app workflow data use PostgreSQL. Without `DATABASE_URL`, local development falls back to JSON files under `server/storage`.

Passwords are hashed before saving. Login and creator admin access now create HttpOnly session cookies. The frontend still keeps lightweight display state in `localStorage`, but deployment auth decisions should use the server session.

## Payments

Wallet deposit and withdrawal requests now go through backend routes:

- `POST /api/payments/deposit`
- `POST /api/payments/withdraw`

Deposits support card, PayPal, and Coinbase/crypto style methods in the UI. Withdrawals support PayPal, bank transfer, and crypto wallet destinations. In deployment mode, requests are rejected unless the live provider is configured.

For real card deposits, set `STRIPE_SECRET_KEY` so the app can create Stripe Checkout sessions. PayPal and crypto flows are guarded behind provider configuration so they cannot pretend to process money in production.

Card fields in the local UI are for flow testing only. For live card payments, use Stripe Checkout or Stripe Elements so raw card details are handled by Stripe, not by your app server.

Creator operations live outside the manager navigation at:

```text
/creator-admin
```

Set `ADMIN_ACCESS_KEY` before deployment. This is a basic creator gate for the current dependency-free build; production should replace it with server-side admin roles and secure sessions.

## EA Pro Clubs Integration

The app now calls backend routes instead of contacting EA directly from the browser:

- `GET /api/ea/clubs/search?clubName=&clubId=&platform=`
- `POST /api/ea/clubs/verify`
- `GET /api/ea/clubs/matches?clubId=&platform=`

Set `EA_PRO_CLUBS_API_URL` if you receive an official EA/partner API base URL. Set `EA_API_MODE=mock` to force local demo data while developing.
