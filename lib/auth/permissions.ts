import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';

export type AppContext = Awaited<ReturnType<typeof requireUser>>;
export type CompanyContext = AppContext & {
  membership: NonNullable<AppContext['membership']>;
};

export async function requireCompanyContext(): Promise<CompanyContext> {
  const context = await requireUser();
  if (!context.membership?.company_id) redirect('/dashboard');
  return context as CompanyContext;
}

export async function can(permission: string, context?: AppContext): Promise<boolean> {
  const { supabase } = context ?? await requireUser();
  const { data, error } = await supabase.rpc('has_permission', {
    requested_permission: permission
  });

  if (error) {
    console.error('[permissions] has_permission failed:', {
      permission,
      code: error.code,
      message: error.message
    });
    return false;
  }

  return Boolean(data);
}

export async function getPermissions(permissions: readonly string[], context?: AppContext) {
  const entries = await Promise.all(
    permissions.map(async (permission) => [permission, await can(permission, context)] as const)
  );
  return Object.fromEntries(entries) as Record<string, boolean>;
}

export function requireAllowed(allowed: boolean, message = 'You do not have permission to perform this action.') {
  if (!allowed) {
    throw new Error(message);
  }
}
