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

## Production Setup

1. Copy `.env.production.example` to your deployment platform's environment variable settings.
2. Set secure production values for:
   - `DATABASE_URL`
   - `JWT_SECRET`
3. Keep rate limit values unless you need stricter throughput controls:
   - `RATE_LIMIT_WINDOW_MS`
   - `RATE_LIMIT_MAX_REQUESTS`
4. Build and run:

```bash
npm run build
npm run start
```

## Run

```bash
npm run dev
```

Health check:

- `GET /health`

## Environment

- `CORS_ORIGIN`: allowed origins for browser clients (comma-separated supported).
- `OTP_TTL_MINUTES`: OTP validity window in minutes.
- `RATE_LIMIT_WINDOW_MS`: request limit window duration in milliseconds.
- `RATE_LIMIT_MAX_REQUESTS`: max requests allowed per IP in each window.

## Scripts

- `npm run dev` - run in development with hot reload
- `npm run build` - compile TypeScript to `dist/`
- `npm run start` - run compiled server
- `npm run test` - run minimal API integration tests
- `npm run test:dashboard:build` - frontend smoke test (dashboard build)

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
2. Ensure backend `.env` has `CORS_ORIGIN="http://localhost:5173"`.
3. Restart backend after changing env values.

## Core API routes

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/respondents`
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
- `gender`
- `location`

## Auth for Write Endpoints

- Use OTP endpoints first to retrieve a bearer token.
- Send `Authorization: Bearer <token>` on write routes:
  - `POST /api/respondents`
  - `POST /api/studies`
  - `POST /api/responses`

## Notes

- OTP is currently a placeholder flow with console delivery for local MVP usage.
- Validation logs are persisted through the `ValidationLog` Prisma model for future consistency and quality checks.
- The schema uses PostgreSQL-compatible types and naming to stay ready for Supabase.
