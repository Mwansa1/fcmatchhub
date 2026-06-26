# Deploy FC MatchHub

## Current Status

The app is ready to be pushed to a GitHub repository and deployed through a Render Blueprint using `render.yaml`.

This machine currently has:

- No Git repository initialized in `fc-matchhub-fullstack`
- No GitHub remote connected
- No Render/Railway/Vercel/Fly CLI installed
- No hosted PostgreSQL credentials configured locally

Because of that, deployment requires connecting this folder to a GitHub repo or logging into a hosting provider from your account.

## Recommended Render Deployment

1. Create a new GitHub repository.
2. Push the contents of `fc-matchhub-fullstack` to that repository.
3. In Render, choose **New +** then **Blueprint**.
4. Connect the GitHub repository.
5. Render will read `render.yaml` and create:
   - Web service: `fc-matchhub`
   - PostgreSQL database: `fc-matchhub-db`
   - `DATABASE_URL` wired from the database to the app
6. Add these secret environment variables in Render:
   - `APP_BASE_URL`
   - `EMAIL_FROM`
   - `RESEND_API_KEY`
   - `ADMIN_ACCESS_KEY`
   - `STRIPE_SECRET_KEY`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `COINBASE_COMMERCE_API_KEY`
   - `EA_PRO_CLUBS_API_URL` when available
7. Keep these production values:
   - `NODE_ENV=production`
   - `EA_API_MODE=live`
   - `ALLOW_DEV_VERIFY_LINK=false`
   - `ALLOW_MOCK_PAYMENTS=false`

## After Deployment

Test these URLs on the deployed domain:

- `/api/health` should return `{"ok":true,"database":"postgres"}`
- `/join` should show manager signup
- `/login` should show manager login
- `/creator-admin` should ask for the admin access key

## Admin Access

Local admin URL:

```text
http://localhost:3000/creator-admin
```

Local admin key:

```text
local-admin-key
```

For production, replace this with a private `ADMIN_ACCESS_KEY` in the hosting provider.
