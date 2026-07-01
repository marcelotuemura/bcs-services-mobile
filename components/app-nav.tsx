import Link from 'next/link';
import { signOut } from '@/actions/auth';

const links = [
  { label: 'Dashboard', href: '/dashboard', permissions: ['dashboard.view'] },
  { label: 'Customers', href: '/customers', permissions: ['customers.view'] },
  { label: 'Assets', href: '/assets', permissions: ['assets.view'] },
  { label: 'Work Orders', href: '/work-orders', permissions: ['workorders.view_all', 'workorders.view_assigned'] },
  { label: 'Search', href: '/search', permissions: ['search.use'] },
  { label: 'Estimates', href: '/estimates', permissions: ['estimates.create'] },
  { label: 'Invoices', href: '/invoices', permissions: ['invoices.view_all', 'invoices.view_own'] },
  { label: 'Team', href: '/team', permissions: ['team.manage'] },
  { label: 'Settings', href: '/settings', permissions: ['settings.view'] }
] as const;

export function AppNav({
  companyName,
  role,
  permissions
}: {
  companyName?: string;
  role?: string;
  permissions: Record<string, boolean>;
}) {
  const visibleLinks = links.filter((link) => link.permissions.some((permission) => permissions[permission]));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">B</div>
        <div>
          <strong>BCS Services</strong>
          <div style={{ color: 'var(--muted)', fontSize: '.86rem' }}>{companyName || 'Setup required'}</div>
        </div>
      </div>
      <nav className="nav">
        {visibleLinks.map(({ label, href }) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <form action={signOut} style={{ marginTop: '1rem' }}>
        <button className="button secondary" style={{ width: '100%' }}>Sign out</button>
      </form>
      <div className="notice" style={{ marginTop: '1rem' }}>Role: {role || 'not assigned'}</div>
    </aside>
  );
}
