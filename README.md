# DatLe MVP Backend

Backend-first scaffold for DatLe, a B2B consumer intelligence platform focused on verified respondents, structured survey data, and repeatable studies.

## Stack

- Node.js + TypeScript
- Express API
- PostgreSQL (Supabase-compatible schema design)
- Prisma ORM
- Zod validation
- dotenv config

## Project structure

```text
src/
  config/
  modules/
    auth/
    respondents/
    studies/
    responses/
  services/
  middleware/
  utils/
prisma/
```

## Prerequisites

- Node.js 20+
- PostgreSQL running locally

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from example:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Run migrations:

```bash
npm run prisma:migrate -- --name init
```

## Test Database Isolation

Keep tests on a separate PostgreSQL database so they do not pollute the local demo or pilot dataset.

1. Create `.env.test` from `.env.test.example`
2. Point it to a dedicated test database, for example:

```bash
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/datle_mvp_test?schema=public"
SHADOW_DATABASE_URL="postgresql://postgres:your_password@localhost:5432/datle_mvp_test_shadow?schema=public"
```

3. Run Prisma migrations against the test database before `npm test`

Vitest now loads `.env.test` automatically, while normal development continues to use `.env`.

Useful commands:

```bash
npm run test:db:reset
npm run test:fresh
```

- `test:db:reset` clears only the isolated test database records
- `test:fresh` resets the test database and then runs the backend test suite

### Windows PowerShell: Fix `npm` Command Resolution

If `npm`/`node` are installed but PowerShell cannot find them (or blocks `npm.ps1`), run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\fix-powershell-node.ps1
```

Then close and reopen your terminal.

## Production Setup

1. Copy `.env.production.example` to your deployment platform's environment variable settings.
2. Set secure production values for:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL` when `OTP_EMAIL_PROVIDER="resend"`
3. Keep rate limit values unless you need stricter throughput controls:
   - `RATE_LIMIT_WINDOW_MS`
   - `RATE_LIMIT_MAX_REQUESTS`
4. Create frontend production env files:

```bash
dashboard/.env.production
respondent-app/.env.production
```

with:

```bash
VITE_API_BASE_URL=https://your-api-domain.com
```

5. Build and run:

```bash
npm run prisma:migrate:deploy
npm run build
npm run start
```

6. Build frontends:

```bash
cd dashboard && npm run build
cd ../respondent-app && npm run build
```

## Deployment Order

1. Provision production PostgreSQL.
2. Set backend environment variables.
3. Run `npm install`.
4. Run `npm run prisma:migrate:deploy`.
5. Run `npm run build`.
6. Start backend with `npm run start`.
7. Build and deploy `dashboard/` with `VITE_API_BASE_URL` pointing to backend.
8. Build and deploy `respondent-app/` with `VITE_API_BASE_URL` pointing to backend.
9. Confirm `GET /health` works from the deployed backend.

## Vercel Frontend Hosting

Use Vercel for the two frontend apps in this monorepo:

- `dashboard/`
- `respondent-app/`

This repository now includes Vercel SPA rewrites for both apps so direct visits to client-side routes like `/account` resolve correctly:

- [dashboard/vercel.json](dashboard/vercel.json)
- [respondent-app/vercel.json](respondent-app/vercel.json)

Recommended production topology:

1. Host the backend API on a Node-friendly service such as Railway, Render, Fly.io, or a VPS.
2. Host `dashboard/` on Vercel.
3. Host `respondent-app/` on Vercel.
4. Point both frontend projects to the deployed backend with `VITE_API_BASE_URL`.

Why split it this way:

- the two frontend apps are static Vite builds and fit Vercel well
- the backend is a long-running Express + Prisma service and is cleaner to run on a traditional Node host

### Importing the Monorepo into Vercel

For each frontend, create a separate Vercel project from the same GitHub repository and set its Root Directory:

1. Import `JerrySimba/datle-mvp-backend`
2. Create one project with Root Directory `dashboard`
3. Create another project with Root Directory `respondent-app`

Set this environment variable on both Vercel projects:

```bash
VITE_API_BASE_URL=https://your-backend-domain.com
```

Then deploy.

### Backend Note

If you want the backend on Vercel too, that is a different deployment shape and would require adapting the Express server into Vercel Functions or another serverless-compatible layout. This repo is not currently set up that way.

## Railway Backend Hosting

This repository now includes a Railway deployment config:

- [railway.toml](railway.toml)

It configures:

- `npm start` as the start command
- `npx prisma migrate deploy` as the pre-deploy migration step
- `/health` as the healthcheck path

### Recommended Railway setup

1. Create a new Railway project
2. Add a PostgreSQL service
3. Add a GitHub-backed service from this repository
4. Set the root directory to the repository root
5. Confirm Railway picks up [railway.toml](railway.toml)

Set these service variables on the backend service:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
JWT_SECRET=your-strong-secret
CORS_ORIGIN=https://your-dashboard-domain.vercel.app,https://your-respondent-domain.vercel.app
OTP_EMAIL_PROVIDER=console
OTP_SMS_PROVIDER=console
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-5.2
AUTH_TOKEN_TTL_MINUTES=1440
AUTH_MAX_ATTEMPTS=5
AUTH_LOCK_MINUTES=15
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

Then replace the OTP providers as needed:

- Email: set `OTP_EMAIL_PROVIDER=resend` and provide `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- SMS: set `OTP_SMS_PROVIDER=twilio` and provide `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`

### After Railway gives you a live backend URL

Set this on both Vercel frontend projects:

```bash
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app
```

## Pilot Readiness Checks

Run these after deployment:

1. `GET /health`
2. Business registration and login
3. Study creation from dashboard
4. Respondent registration with OTP
5. Profile save
6. Eligible study appears in respondent account
7. Response submission updates analytics
8. Quota fill blocks the next matching respondent
9. CSV/JSON export succeeds

## Run

```bash
npm run dev
```

Health check:

- `GET /health`

## Environment

- `CORS_ORIGIN`: allowed origins for browser clients (comma-separated supported).
- `OTP_EMAIL_PROVIDER`: `auto`, `console`, or `resend`.
- `RESEND_API_KEY`: required when using Resend.
- `RESEND_FROM_EMAIL`: sender identity for OTP emails.
- `RESEND_REPLY_TO`: optional support reply address.
- `OTP_EMAIL_SUBJECT`: OTP email subject line.
- `OTP_TTL_MINUTES`: OTP validity window in minutes.
- `AUTH_TOKEN_TTL_MINUTES`: bearer token lifetime in minutes.
- `AUTH_MAX_ATTEMPTS`: max failed auth attempts before temporary lock.
- `AUTH_LOCK_MINUTES`: lock duration after exceeding auth attempts.
- `RATE_LIMIT_WINDOW_MS`: request limit window duration in milliseconds.
- `RATE_LIMIT_MAX_REQUESTS`: max requests allowed per IP in each window.

## Scripts

- `npm run dev` - run in development with hot reload
- `npm run build` - compile TypeScript to `dist/`
- `npm run start` - run compiled server
- `npm run test` - run minimal API integration tests
- `npm run test:dashboard:build` - frontend smoke test (dashboard build)
- `npm run test:respondent:build` - frontend smoke test (respondent app build)
- `npm run demo:seed` - reset and seed a consistent demo study dataset

## Dashboard Demo (Step 2-5)

1. Open a second terminal and go to `dashboard/`.
2. Install dashboard dependencies:

```bash
npm install
```

3. Create dashboard env file from example:

```bash
cp .env.example .env
```

4. Start dashboard:

```bash
npm run dev
```

Dashboard runs on `http://localhost:5173` and calls backend analytics endpoints.

If dashboard cannot load data:
1. Ensure backend is running on `http://localhost:4000`.
2. Ensure backend `.env` has `CORS_ORIGIN="http://localhost:5173,http://localhost:5174"`.
3. Restart backend after changing env values.

Generate predictable demo data:

```bash
npm run demo:seed
```

## Pilot Demo Dataset

Running `npm run demo:seed` resets and recreates a consistent pilot dataset with:

- 1 demo company
- 1 admin account
- 1 business account
- 6 respondent accounts with saved profiles
- 1 active study with quotas and partial completions
- 1 completed study with historical responses

Seeded credentials:

- Admin: `demo-seed-admin@datle.com` / `DemoPass123!`
- Business: `demo-seed-business@datle.com` / `DemoPass123!`
- Respondents:
  - `demo-seed-respondent-1@datle.com` / `DemoPass123!`
  - `demo-seed-respondent-2@datle.com` / `DemoPass123!`
  - `demo-seed-respondent-3@datle.com` / `DemoPass123!`
  - `demo-seed-respondent-4@datle.com` / `DemoPass123!`
  - `demo-seed-respondent-5@datle.com` / `DemoPass123!`
  - `demo-seed-respondent-6@datle.com` / `DemoPass123!`

Seeded studies:

- Active: `Demo Urban Soft Drink Pulse`
- Completed: `Demo Pack Format Recall`

Suggested pilot walkthrough:

1. Sign into the dashboard with the demo business account.
2. Review the active and completed studies plus analytics and quota progress.
3. Sign into the respondent app with one of the demo respondent accounts.
4. Confirm the respondent sees only matched studies and clear availability states.
5. Submit a response with an uncompleted respondent account and refresh business analytics.

## Respondent App (4-Step Flow)

1. Open another terminal and go to `respondent-app/`.
2. Install dependencies:

```bash
npm install
```

3. Create local env:

```bash
cp .env.example .env
```

4. Start app:

```bash
npm run dev
```

Respondent app runs on `http://localhost:5174` with:
1. Account register/login (email + ID number + password)
2. OTP verification on registration
3. Profile capture (auto-skipped when already saved)
4. Study response submission

## Core API routes

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/respondents`
- `GET /api/respondents/me`
- `GET /api/respondents/:id`
- `POST /api/studies`
- `GET /api/studies`
- `GET /api/studies/:id`
- `GET /api/studies/:id/responses`
- `GET /api/studies/:id/responses.csv`
- `POST /api/responses`
- `GET /api/responses/study/:studyId`
- `GET /api/analytics/studies/:id/summary`

Analytics summary query params (optional):
- `from` and `to` (ISO date-time) for submission date filtering
- respondent fields (when present): `gender`, `location`, `income_band`, `education`, `employment_status`, `age`
- question payload filters: `q_<question_key>=<value>`

## Auth for Write Endpoints

- Use account auth for respondent/session actions.
- Account auth is also available:
  - `POST /api/auth/request-otp` with `email`
  - `POST /api/auth/register` with `email`, `id_number`, `password`, `otp`
  - `POST /api/auth/login` with `identifier` (email or ID number) and `password`
  - `POST /api/auth/logout` (server revokes account session tokens)
- `POST /api/respondents` now requires an account-auth token (`/register` or `/login`) and
  the profile `email` must match the authenticated account email.
- `POST /api/responses` enforces respondent ownership: response `respondent_id` must belong to the authenticated account.
- `POST /api/studies` is restricted to account roles `BUSINESS` or `ADMIN`.
- Send `Authorization: Bearer <token>` on write routes:
  - `POST /api/respondents`
  - `POST /api/studies`
  - `POST /api/responses`

## Notes

- OTP can send through Resend when configured; otherwise it uses console fallback in `auto` mode.
- Validation logs are persisted through the `ValidationLog` Prisma model for future consistency and quality checks.
- The schema uses PostgreSQL-compatible types and naming to stay ready for Supabase.
