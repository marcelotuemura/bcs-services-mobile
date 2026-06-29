import type { ReactNode } from 'react';
import { AppNav } from '@/components/app-nav';
import { requireUser, type Membership } from '@/lib/auth/require-user';

/** Safely resolve the company name from the Membership join result. */
function resolveCompanyName(membership: Membership): string | undefined {
  if (!membership) return undefined;
  const companies = membership.companies;
  if (Array.isArray(companies)) return companies[0]?.name;
  return companies?.name ?? undefined;
}

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const { membership } = await requireUser();
  const companyName = resolveCompanyName(membership);
  const role = membership?.role;

  return (
    <div className="shell-bg app-layout">
      <AppNav companyName={companyName} role={role} />
      <main className="main">{children}</main>
    </div>
  );
}
