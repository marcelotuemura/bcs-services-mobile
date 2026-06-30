'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env';

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address.').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters.')
});

export type ActionState = { ok: boolean; message: string };

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  });

  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message || 'Invalid login.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: error.message };
  redirect('/dashboard');
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password')
  });

  const companyName = String(formData.get('companyName') || '').trim();
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message || 'Invalid signup.' };
  if (companyName.length < 2) return { ok: false, message: 'Company name is required.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      data: { company_name: companyName }
    }
  });

  if (error) return { ok: false, message: error.message };

  // Only run bootstrap when the user is immediately confirmed (email confirmation disabled).
  // When email confirmation is required, data.user is returned but session is null;
  // in that case the bootstrap trigger on first sign-in handles company creation.
  if (data.user && data.session) {
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `company-${Date.now()}`;
    const { error: rpcError } = await supabase.rpc('bootstrap_company_for_current_user', {
      company_name: companyName,
      company_slug: `${slug}-${data.user.id.slice(0, 6)}`
    });
    if (rpcError) {
      // Log for server-side visibility; do not expose internal details to the client
      console.error('[signUp] bootstrap_company_for_current_user failed:', rpcError.message);
    }
  }

  return { ok: true, message: 'Account created. Check your email to confirm, then sign in.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function resetPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') || '').trim(). toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: false, message: 'Enter a valid email.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/settings`
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Password reset email sent.' };
}
