import { requireUser } from '@/lib/auth/require-user';

export default async function DashboardPage() {
  const { membership, user } = await requireUser();
  const hasCompany = Boolean(membership?.company_id);

  return (
    <section>
      <div className="topbar">
        <div>
          <p className="kicker">Foundation</p>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--muted)' }}>Signed in as {user.email}</p>
        </div>
      </div>

      {!hasCompany && (
        <div className="notice error" style={{ marginBottom: '1rem' }}>
          Your user does not belong to a company yet. Create an account from the signup flow or run the bootstrap migration function.
        </div>
      )}

      <div className="card-grid">
        <div className="card glass"><h3>Open work orders</h3><strong>0</strong></div>
        <div className="card glass"><h3>Pending estimates</h3><strong>0</strong></div>
        <div className="card glass"><h3>Unpaid invoices</h3><strong>0</strong></div>
      </div>

      <div className="card glass" style={{ marginTop: '1rem' }}>
        <h2>v1.0 Foundation</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          This release intentionally focuses on login, company ownership, roles, route protection, and a clean app shell. Operational modules are placeholders until the foundation is verified in production.
        </p>
      </div>
    </section>
  );
}
