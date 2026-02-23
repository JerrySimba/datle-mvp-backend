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

## Run

```bash
npm run dev
```

Health check:

- `GET /health`

## Scripts

- `npm run dev` - run in development with hot reload
- `npm run build` - compile TypeScript to `dist/`
- `npm run start` - run compiled server
- `npm run test` - run minimal API integration tests

## Core API routes

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/respondents`
- `GET /api/respondents/:id`
- `POST /api/studies`
- `GET /api/studies`
- `GET /api/studies/:id`
- `GET /api/studies/:id/responses`
- `POST /api/responses`
- `GET /api/responses/study/:studyId`

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
