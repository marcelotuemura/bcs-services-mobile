import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Validate that the redirect target is a safe relative path. */
function safeNext(next: string | null): string {
  // Must start with a single '/' and not be a protocol-relative URL like //evil.com
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/dashboard';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Code exchange failed — redirect to login with an error hint
      const loginUrl = new URL('/', url.origin);
      loginUrl.searchParams.set('error', 'auth_callback_failed');
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
