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

  const { data: membership } = await supabase
    .from('company_members')
    .select('role, company_id, companies(name, slug)')
    .eq('user_id', user.id)
    .maybeSingle();

  return { supabase, user, membership };
}
