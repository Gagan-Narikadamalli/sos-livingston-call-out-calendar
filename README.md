# SOS Livingston Call-Out & Time-Off Portal

Next.js portal for Success On The Spectrum. Employees can submit PTO or non-PTO leave requests. Managers can use a calendar to review, edit, and delete submissions, add calendar-only notes for late arrivals/early departures/special occasions, review database usage, and bulk-delete old records.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Run `npm install`.
3. Run `npm run dev`.

The database tables and indexes are created automatically on the first request.

## Deploy to Vercel

Import this folder into Vercel, connect a Postgres database, and add `DATABASE_URL`, `MANAGER_PASSWORD`, and `AUTH_SECRET` to Production, Preview, and Development environments. Then deploy.

Public form: `/`  
Livingston Manager Calendar: `/manager`
- Employee-submitted requests and manager-created Employee Notes share one green calendar category.
