# BCS Services Mobile v1.0 Foundation

A clean, mobile-first SaaS foundation for small mobile service companies.

This release intentionally focuses on the foundation only:

- Login-first public homepage
- Supabase email/password authentication
- Protected application routes
- Company ownership model
- Role-based membership model
- Apple-inspired responsive shell
- Versioned Supabase migration
- Vercel-ready deployment setup

Operational modules are placeholders until the foundation is verified.

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth + Postgres + RLS
- Vercel
- Future-ready for Resend and Stripe

## Setup

1. Upload this package to the new GitHub repo: `bcs-services-mobile`.
2. In Supabase SQL Editor, run the migrations in order:

```sql
supabase/migrations/0001_foundation.sql
supabase/migrations/0002_fix_company_member_rls.sql
```

3. In Vercel, set environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://bcs-services-mobile.vercel.app
```

4. Deploy.
5. Open the app and create the first owner account.

## Important

Do not manually create database tables in Supabase. Use migrations only.
