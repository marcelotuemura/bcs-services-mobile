import { createWorkOrder, updateWorkOrderStatus } from '@/actions/work-orders';
import { getPermissions, requireCompanyContext } from '@/lib/auth/permissions';
import { enumLabel, formatDateTime } from '@/lib/format';

type CustomerOption = { id: string; name: string };
type AssetOption = {
  id: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  customer_id: string | null;
};
type WorkOrderRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_for: string | null;
  estimated_hours: number | null;
  customer_notes: string | null;
  customers: { name: string } | { name: string }[] | null;
  assets: { asset_type: string; manufacturer: string | null; model: string | null } | { asset_type: string; manufacturer: string | null; model: string | null }[] | null;
};

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const initialState = { ok: false, message: '' };
const statuses = ['draft', 'scheduled', 'checked_in', 'in_progress', 'waiting_parts', 'waiting_approval', 'completed', 'delivered', 'cancelled'];
const priorities = ['low', 'normal', 'high', 'urgent'];

async function createWorkOrderForm(formData: FormData) {
  'use server';
  await createWorkOrder(initialState, formData);
}

function value(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const raw = params?.[key];
  return Array.isArray(raw) ? raw[0] || '' : raw || '';
}

function joinedCustomer(workOrder: WorkOrderRow) {
  const customer = Array.isArray(workOrder.customers) ? workOrder.customers[0] : workOrder.customers;
  return customer?.name || 'No customer';
}

function joinedAsset(workOrder: WorkOrderRow) {
  const asset = Array.isArray(workOrder.assets) ? workOrder.assets[0] : workOrder.assets;
  if (!asset) return 'No asset';
  return [enumLabel(asset.asset_type), asset.manufacturer, asset.model].filter(Boolean).join(' ');
}

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const context = await requireCompanyContext();
  const permissions = await getPermissions([
    'workorders.create',
    'workorders.edit_all',
    'workorders.edit_assigned',
    'workorders.complete'
  ], context);
  const status = value(params, 'status') || 'open';

  let request = context.supabase
    .from('work_orders')
    .select('id, title, status, priority, scheduled_for, estimated_hours, customer_notes, customers(name), assets(asset_type, manufacturer, model)')
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(50);

  if (status === 'open') {
    request = request.not('status', 'in', '("completed","delivered","cancelled")');
  } else if (status !== 'all') {
    request = request.eq('status', status);
  }

  const [{ data, error }, { data: customerData }, { data: assetData }] = await Promise.all([
    request,
    context.supabase.from('customers').select('id, name').neq('status', 'archived').order('name', { ascending: true }).limit(200),
    context.supabase.from('assets').select('id, asset_type, manufacturer, model, customer_id').is('archived_at', null).order('updated_at', { ascending: false }).limit(200)
  ]);

  const workOrders = (data || []) as WorkOrderRow[];
  const customers = (customerData || []) as CustomerOption[];
  const assets = (assetData || []) as AssetOption[];
  const canEditStatus = permissions['workorders.edit_all'] || permissions['workorders.edit_assigned'];

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <p className="kicker">Service</p>
          <h1 className="page-title">Work Orders</h1>
        </div>
      </div>

      {error && <div className="notice error">{error.message}</div>}

      <form className="toolbar glass" action="/work-orders">
        <select className="input compact" name="status" defaultValue={status}>
          <option value="open">Open</option>
          {statuses.map((workOrderStatus) => <option key={workOrderStatus} value={workOrderStatus}>{enumLabel(workOrderStatus)}</option>)}
          <option value="all">All</option>
        </select>
        <button className="button secondary" type="submit">Filter</button>
      </form>

      {permissions['workorders.create'] && (
        <form action={createWorkOrderForm} className="panel-grid glass">
          <div className="form-section">
            <h2>New work order</h2>
            <label className="label" htmlFor="title">Title</label>
            <input className="input" id="title" name="title" required />
            <label className="label" htmlFor="customer_id">Customer</label>
            <select className="input" id="customer_id" name="customer_id">
              <option value="">No customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <label className="label" htmlFor="asset_id">Asset</label>
            <select className="input" id="asset_id" name="asset_id">
              <option value="">No asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {[enumLabel(asset.asset_type), asset.manufacturer, asset.model].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="form-section">
            <label className="label" htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue="draft">
              {statuses.map((workOrderStatus) => <option key={workOrderStatus} value={workOrderStatus}>{enumLabel(workOrderStatus)}</option>)}
            </select>
            <label className="label" htmlFor="priority">Priority</label>
            <select className="input" id="priority" name="priority" defaultValue="normal">
              {priorities.map((priority) => <option key={priority} value={priority}>{enumLabel(priority)}</option>)}
            </select>
            <label className="label" htmlFor="technician_id">Technician UUID</label>
            <input className="input" id="technician_id" name="technician_id" />
            <label className="label" htmlFor="scheduled_for">Scheduled</label>
            <input className="input" id="scheduled_for" name="scheduled_for" type="datetime-local" />
            <label className="label" htmlFor="estimated_hours">Estimated hours</label>
            <input className="input" id="estimated_hours" name="estimated_hours" inputMode="decimal" />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="labor_notes">Labor notes</label>
            <textarea className="input" id="labor_notes" name="labor_notes" rows={3} />
            <label className="label" htmlFor="internal_notes">Internal notes</label>
            <textarea className="input" id="internal_notes" name="internal_notes" rows={3} />
            <label className="label" htmlFor="customer_notes">Customer notes</label>
            <textarea className="input" id="customer_notes" name="customer_notes" rows={3} />
            <button className="button" type="submit">Create work order</button>
          </div>
        </form>
      )}

      <div className="data-list">
        {workOrders.map((workOrder) => (
          <article className="row-card glass" key={workOrder.id}>
            <div>
              <strong>{workOrder.title}</strong>
              <p>{joinedCustomer(workOrder)} · {joinedAsset(workOrder)}</p>
              <div className="meta-line">
                <span>{enumLabel(workOrder.status)}</span>
                <span>{enumLabel(workOrder.priority)}</span>
                <span>{formatDateTime(workOrder.scheduled_for)}</span>
                {workOrder.estimated_hours !== null && <span>{workOrder.estimated_hours} estimated hours</span>}
              </div>
              {workOrder.customer_notes && <p>{workOrder.customer_notes}</p>}
            </div>
            {canEditStatus && (
              <form action={updateWorkOrderStatus} className="inline-form">
                <input type="hidden" name="id" value={workOrder.id} />
                <select className="input compact" name="status" defaultValue={workOrder.status}>
                  {statuses.map((workOrderStatus) => (
                    <option key={workOrderStatus} value={workOrderStatus} disabled={workOrderStatus === 'completed' && !permissions['workorders.complete']}>
                      {enumLabel(workOrderStatus)}
                    </option>
                  ))}
                </select>
                <button className="button secondary" type="submit">Update</button>
              </form>
            )}
          </article>
        ))}
        {!workOrders.length && <div className="empty">No work orders found.</div>}
      </div>
    </section>
  );
}
