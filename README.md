# Personal Finance
Mission-control dashboard for personal finances with authentication, dashboards, and PostgreSQL persistence.

## Features
- Auth (register/login/logout) with sessions
- Dashboard metrics (spend, income, savings, investments)
- Recent transactions view
- PostgreSQL-backed data layer

## Requirements
- Node.js 18+
- Railway PostgreSQL service (shared dev/prod)

## Environment Variables
Create a `.env` file (or use Railway variables):
```
DATABASE_URL=
DATABASE_PUBLIC_URL=
OPENROUTER_API_KEY=
SESSION_SECRET=
PORT=3000
```

For local development, use the Railway CLI to pull DB variables:
```bash
railway link
railway variables -k > .env
```

## Install & Run
```bash
npm install
npm run dev
```

## Tests
```bash
npm test
```

## Scripts
- `npm run dev`: Start dev server
- `npm test`: Run unit tests
- `npm run test:coverage`: Coverage report
- `npm run db:migrate`: Run database migrations

## Project Notes
- Use `DATABASE_PUBLIC_URL` for local development.
- Dev and prod share the same Railway DB.
