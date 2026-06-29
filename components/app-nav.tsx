import Link from 'next/link';
import { signOut } from '@/actions/auth';

const links = [
  ['Dashboard', '/dashboard'],
  ['Customers', '/customers'],
  ['Assets', '/assets'],
  ['Work Orders', '/work-orders'],
  ['Estimates', '/estimates'],
  ['Invoices', '/invoices'],
  ['Team', '/team'],
  ['Settings', '/settings']
] as const;

export function AppNav({ companyName, role }: { companyName?: string; role?: string }) {
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
        {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <form action={signOut} style={{ marginTop: '1rem' }}>
        <button className="button secondary" style={{ width: '100%' }}>Sign out</button>
      </form>
      <div className="notice" style={{ marginTop: '1rem' }}>Role: {role || 'not assigned'}</div>
    </aside>
  );
}
