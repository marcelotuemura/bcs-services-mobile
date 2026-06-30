# Deployment Guide

## 1. Supabase

Run the migrations in order in Supabase SQL Editor:

1. `supabase/migrations/0001_foundation.sql`
2. `supabase/migrations/0002_fix_company_member_rls.sql`

Then verify the following tables exist:

- companies
- company_members
- activity_log

Verify these functions exist:

- bootstrap_company_for_current_user
- current_company_id
- has_company_role
- is_company_member

## 2. Vercel Environment Variables

Add:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://bcs-services-mobile.vercel.app
```

Do not add the service role key to the client app.

## 3. Supabase Auth URLs

Site URL:

```text
https://bcs-services-mobile.vercel.app
```

Redirect URLs:

```text
https://bcs-services-mobile.vercel.app/auth/callback
https://bcs-services-mobile.vercel.app/auth/callback/**
https://bestcoatingssolution.com/auth/callback
https://bestcoatingssolution.com/auth/callback/**
```

## 4. First Test

1. Visit `/`.
2. Confirm only login/signup is visible.
3. Create account with company name.
4. Confirm redirect to `/dashboard`.
5. Confirm sidebar appears only after login.
6. Open Supabase and verify company + owner membership were created.
