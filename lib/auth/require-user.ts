import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Shape of a company_members row joined with its parent company. */
export type Membership = {
  role: string;
  company_id: string;
  companies: { name: string; slug: string } | { name: string; slug: string }[] | null;
} | null;

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/');

  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('role, company_id, companies(name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error('[requireUser] company membership lookup failed:', {
      code: membershipError.code,
      message: membershipError.message,
      userId: user.id
    });
    throw new Error('Unable to load company membership.');
  }

  return { supabase, user, membership };
}
