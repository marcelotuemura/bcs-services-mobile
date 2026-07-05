import { requireUser } from '@/lib/auth/require-user';
import { formatCurrency, formatDateTime, enumLabel } from '@/lib/format';

type ActivityRow = {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
};

type WorkOrderRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_for: string | null;
};

export default async function DashboardPage() {
  const { membership, user, supabase } = await requireUser();
  const hasCompany = Boolean(membership?.company_id);
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const [
    customersResult,
    assetsResult,
    openWorkOrdersResult,
    statusResult,
    activityResult,
    scheduleResult,
    settingsResult,
    pendingEstimatesResult,
    pendingInvoicesResult,
    invoicesResult
  ] = (membership && hasCompany) ? await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).neq('status', 'archived'),
    supabase.from('assets').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).is('archived_at', null),
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).not('status', 'in', '("completed","delivered","cancelled")'),
    supabase.from('work_orders').select('status').eq('company_id', membership.company_id).limit(500),
    supabase.from('activity_log').select('id, action, entity_type, created_at').eq('company_id', membership.company_id).order('created_at', { ascending: false }).limit(6),
    supabase.from('work_orders').select('id, title, status, priority, scheduled_for').eq('company_id', membership.company_id).gte('scheduled_for', start.toISOString()).lte('scheduled_for', end.toISOString()).order('scheduled_for', { ascending: true }).limit(6),
    supabase.from('company_settings').select('currency').eq('company_id', membership.company_id).maybeSingle(),
    supabase.from('estimates').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).eq('status', 'pending'),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', membership.company_id).not('status', 'in', '("paid","cancelled","void")'),
    supabase.from('invoices').select('amount_paid').eq('company_id', membership.company_id)
  ]) : [null, null, null, null, null, null, null, null, null, null];

  const statusRows = ((statusResult?.data || []) as { status: string }[]);
  const statusCounts = statusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const recentActivity = (activityResult?.data || []) as ActivityRow[];
  const todaysSchedule = (scheduleResult?.data || []) as WorkOrderRow[];
  const currency = settingsResult?.data?.currency || 'USD';
  const pendingEstimates = pendingEstimatesResult?.count ?? 0;
  const pendingInvoices = pendingInvoicesResult?.count ?? 0;
  const totalRevenue = (invoicesResult?.data || []).reduce((acc, row) => acc + (row.amount_paid || 0), 0);

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <p className="kicker">Command Center</p>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--muted)' }}>Signed in as {user.email}</p>
        </div>
        <div className="quick-actions">
          <a className="button secondary" href="/customers">Customer</a>
          <a className="button secondary" href="/assets">Asset</a>
          <a className="button secondary" href="/work-orders">Work order</a>
        </div>
      </div>

      {!hasCompany && (
        <div className="notice error" style={{ marginBottom: '1rem' }}>
          Your user does not belong to a company yet. Create an account from the signup flow or run the bootstrap migration function.
        </div>
      )}

      <div className="card-grid">
        <div className="card glass"><h3>Customers</h3><strong>{customersResult?.count ?? 0}</strong></div>
        <div className="card glass"><h3>Assets</h3><strong>{assetsResult?.count ?? 0}</strong></div>
        <div className="card glass"><h3>Open work orders</h3><strong>{openWorkOrdersResult?.count ?? 0}</strong></div>
        <div className="card glass"><h3>Pending estimates</h3><strong>{pendingEstimates}</strong></div>
        <div className="card glass"><h3>Pending invoices</h3><strong>{pendingInvoices}</strong></div>
        <div className="card glass"><h3>Revenue</h3><strong>{formatCurrency(totalRevenue, currency)}</strong></div>
      </div>

      <div className="two-column">
        <section className="card glass">
          <h2>Today&apos;s schedule</h2>
          <div className="mini-list">
            {todaysSchedule.map((workOrder) => (
              <a href="/work-orders" key={workOrder.id}>
                <strong>{workOrder.title}</strong>
                <span>{formatDateTime(workOrder.scheduled_for)} · {enumLabel(workOrder.status)} · {enumLabel(workOrder.priority)}</span>
              </a>
            ))}
            {!todaysSchedule.length && <p>No work orders scheduled today.</p>}
          </div>
        </section>

        <section className="card glass">
          <h2>Recent activity</h2>
          <div className="mini-list">
            {recentActivity.map((activity) => (
              <span key={activity.id}>
                <strong>{enumLabel(activity.action)}</strong>
                <small>{activity.entity_type || 'record'} · {formatDateTime(activity.created_at)}</small>
              </span>
            ))}
            {!recentActivity.length && <p>No activity recorded yet.</p>}
          </div>
        </section>
      </div>

      <section className="card glass">
        <h2>Work order mix</h2>
        <div className="status-grid">
          {Object.entries(statusCounts).map(([status, total]) => (
            <div key={status}>
              <span>{enumLabel(status)}</span>
              <strong>{total}</strong>
            </div>
          ))}
          {!Object.keys(statusCounts).length && <p>No work orders to chart yet.</p>}
        </div>
      </section>
    </section>
  );
}
