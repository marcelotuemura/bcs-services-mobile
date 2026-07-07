'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/actions/auth';
import {
  LayoutDashboard,
  Users,
  Anchor,
  Briefcase,
  Search,
  FileText,
  Receipt,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const links = [
  { label: 'Dashboard', href: '/dashboard', permissions: ['dashboard.view'], icon: LayoutDashboard },
  { label: 'Customers', href: '/customers', permissions: ['customers.view'], icon: Users },
  { label: 'Assets', href: '/assets', permissions: ['assets.view'], icon: Anchor },
  { label: 'Work Orders', href: '/work-orders', permissions: ['workorders.view_all', 'workorders.view_assigned'], icon: Briefcase },
  { label: 'Search', href: '/search', permissions: ['search.use'], icon: Search },
  { label: 'Estimates', href: '/estimates', permissions: ['estimates.create'], icon: FileText },
  { label: 'Invoices', href: '/invoices', permissions: ['invoices.view_all', 'invoices.view_own'], icon: Receipt },
  { label: 'Team', href: '/team', permissions: ['team.manage'], icon: Shield },
  { label: 'Settings', href: '/settings', permissions: ['settings.view'], icon: Settings }
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
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTabletCollapsed, setIsTabletCollapsed] = useState(true);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const hasLoadedPermissions = Object.keys(permissions).length > 0 && Object.values(permissions).some(val => val === true);

  let visibleLinks;
  if (role === 'owner') {
    visibleLinks = links;
  } else if (!hasLoadedPermissions) {
    const fallbackHrefs = ['/dashboard', '/customers', '/assets', '/work-orders', '/estimates', '/invoices'];
    visibleLinks = links.filter((link) => fallbackHrefs.includes(link.href));
  } else {
    visibleLinks = links.filter((link) => link.permissions.some((permission) => permissions[permission]));
  }

  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);
  const toggleTablet = () => setIsTabletCollapsed(!isTabletCollapsed);

  return (
    <>
      {/* Mobile Top Header (only visible on mobile viewports) */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={toggleMobile} aria-label="Open navigation menu">
          <Menu size={24} />
        </button>
        <div className="mobile-title">
          <img src="/logo.jpg" alt="BCS Logo" className="mobile-header-logo" />
          <span>BCS Services</span>
        </div>
        <div style={{ width: 44 }}></div> {/* Balance spacer */}
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div className="mobile-backdrop" onClick={toggleMobile} />
      )}

      {/* Sidebar navigation */}
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''} ${isTabletCollapsed ? 'tablet-collapsed' : 'tablet-expanded'}`}>
        <div className="brand">
          <img src="/logo.jpg" alt="BCS Logo" className="brand-logo" />
          <div className="brand-text">
            <strong>BCS Services</strong>
            <div className="company-name">{companyName || 'Setup required'}</div>
          </div>
          <button className="mobile-close-btn" onClick={toggleMobile} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* Collapsible toggle button for tablet layout */}
        <button className="tablet-toggle-btn" onClick={toggleTablet} aria-label="Toggle navigation expansion">
          {isTabletCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <nav className="nav">
          {visibleLinks.map(({ label, href, icon: IconComponent }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsMobileOpen(false)}
              className={`nav-link ${isActive(href) ? 'active' : ''}`}
            >
              <IconComponent className="nav-icon" size={20} />
              <span className="nav-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <form action={signOut} style={{ width: '100%' }}>
            <button className="button secondary logout-btn" style={{ width: '100%' }}>
              <LogOut className="logout-icon" size={18} />
              <span className="logout-label">Sign out</span>
            </button>
          </form>
          <div className="role-notice">Role: {role || 'not assigned'}</div>
        </div>
      </aside>
    </>
  );
}
