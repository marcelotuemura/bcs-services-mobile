import { archiveCustomer, createCustomer, restoreCustomer } from '@/actions/customers';
import { getPermissions, requireCompanyContext, verifyPageAccess } from '@/lib/auth/permissions';

type CustomerRow = {
  id: string;
  customer_number: string | null;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  state: string | null;
  status: string;
  tags: string[] | null;
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const initialState = { ok: false, message: '' };
const pageSize = 10;

async function createCustomerForm(formData: FormData) {
  'use server';
  await createCustomer(initialState, formData);
}

function value(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const raw = params?.[key];
  return Array.isArray(raw) ? raw[0] || '' : raw || '';
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const context = await requireCompanyContext();
  await verifyPageAccess('customers.view', context);
  const permissions = await getPermissions([
    'customers.create',
    'customers.archive',
    'customers.restore'
  ], context);
  const query = value(params, 'q').trim();
  const status = value(params, 'status') || 'active';
  const page = Math.max(Number(value(params, 'page')) || 1, 1);
  const from = (page - 1) * pageSize;

  let request = context.supabase
    .from('customers')
    .select('id, customer_number, name, company_name, email, phone, mobile, city, state, status, tags', { count: 'exact' })
    .eq('company_id', context.membership.company_id)
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (query) request = request.ilike('name', `%${query}%`);
  if (status !== 'all') request = request.eq('status', status);

  const { data, count, error } = await request;
  const customers = (data || []) as CustomerRow[];
  const totalPages = Math.max(Math.ceil((count || 0) / pageSize), 1);

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <p className="kicker">Operations</p>
          <h1 className="page-title">Customers</h1>
        </div>
      </div>

      {error && <div className="notice error">{error.message}</div>}

      <form className="toolbar glass" action="/customers">
        <input className="input compact" name="q" placeholder="Search customers" defaultValue={query} />
        <select className="input compact" name="status" defaultValue={status}>
          <option value="active">Active</option>
          <option value="lead">Lead</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <button className="button secondary" type="submit">Filter</button>
      </form>

      {permissions['customers.create'] && (
        <form action={createCustomerForm} className="panel-grid glass">
          <div className="form-section">
            <h2>Add customer</h2>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required />
            <label className="label" htmlFor="company_name">Company</label>
            <input className="input" id="company_name" name="company_name" />
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" />
            <label className="label" htmlFor="phone">Phone</label>
            <input className="input" id="phone" name="phone" />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="mobile">Mobile</label>
            <input className="input" id="mobile" name="mobile" />
            <label className="label" htmlFor="address">Address</label>
            <input className="input" id="address" name="address" />
            <div className="mini-grid">
              <div>
                <label className="label" htmlFor="city">City</label>
                <input className="input" id="city" name="city" />
              </div>
              <div>
                <label className="label" htmlFor="state">State</label>
                <input className="input" id="state" name="state" />
              </div>
              <div>
                <label className="label" htmlFor="zip">ZIP</label>
                <input className="input" id="zip" name="zip" />
              </div>
            </div>
            <label className="label" htmlFor="country">Country</label>
            <input className="input" id="country" name="country" defaultValue="US" />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="tax_id">Tax ID</label>
            <input className="input" id="tax_id" name="tax_id" />
            <label className="label" htmlFor="tags">Tags</label>
            <input className="input" id="tags" name="tags" placeholder="fleet, priority" />
            <label className="label" htmlFor="status">Status</label>
            <select className="input" id="status" name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="lead">Lead</option>
              <option value="inactive">Inactive</option>
            </select>
            <label className="label" htmlFor="notes">Notes</label>
            <textarea className="input" id="notes" name="notes" rows={3} />
            <button className="button" type="submit">Create customer</button>
          </div>
        </form>
      )}

      <div className="data-list">
        {customers.map((customer) => (
          <article className="row-card glass" key={customer.id}>
            <div>
              <strong>{customer.customer_number ? `[${customer.customer_number}] ` : ''}{customer.name}</strong>
              <p>{customer.company_name || customer.email || customer.phone || 'No contact details yet'}</p>
              <div className="meta-line">
                <span>{customer.status}</span>
                {(customer.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                {(customer.city || customer.state) && <span>{[customer.city, customer.state].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
            <div className="row-actions">
              {customer.status === 'archived' && permissions['customers.restore'] ? (
                <form action={restoreCustomer}>
                  <input type="hidden" name="id" value={customer.id} />
                  <button className="button secondary" type="submit">Restore</button>
                </form>
              ) : permissions['customers.archive'] ? (
                <form action={archiveCustomer}>
                  <input type="hidden" name="id" value={customer.id} />
                  <button className="button secondary" type="submit">Archive</button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
        {!customers.length && <div className="empty">No customers found.</div>}
      </div>

      <div className="pagination">
        <span>Page {page} of {totalPages}</span>
        <a className="button secondary" href={`/customers?q=${encodeURIComponent(query)}&status=${status}&page=${Math.max(page - 1, 1)}`}>Previous</a>
        <a className="button secondary" href={`/customers?q=${encodeURIComponent(query)}&status=${status}&page=${Math.min(page + 1, totalPages)}`}>Next</a>
      </div>
    </section>
  );
}
