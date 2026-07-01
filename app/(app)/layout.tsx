import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';
import { requireUser, type Membership } from '@/lib/auth/require-user';
import { getPermissions } from '@/lib/auth/permissions';

/** Safely resolve the company name from the Membership join result. */
function resolveCompanyName(membership: Membership): string | undefined {
  if (!membership) return undefined;
  const companies = membership.companies;
  if (Array.isArray(companies)) return companies[0]?.name;
  return companies?.name ?? undefined;
}

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await requireUser();
  const { membership } = context;
  const companyName = resolveCompanyName(membership);
  const role = membership?.role;
  const permissions = await getPermissions([
    'dashboard.view',
    'customers.view',
    'assets.view',
    'workorders.view_all',
    'workorders.view_assigned',
    'search.use',
    'estimates.create',
    'invoices.view_all',
    'invoices.view_own',
    'team.manage',
    'settings.view'
  ], context);

  return (
    <div className="shell-bg app-layout">
      <AppNav companyName={companyName} role={role} permissions={permissions} />
      <main className="main">{children}</main>
    </div>
  );
}
