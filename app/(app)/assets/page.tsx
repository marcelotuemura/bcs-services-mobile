import { archiveAsset, createAsset } from '@/actions/assets';
import { getPermissions, requireCompanyContext } from '@/lib/auth/permissions';
import { enumLabel } from '@/lib/format';

type AssetRow = {
  id: string;
  asset_type: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  registration: string | null;
  vin: string | null;
  hin: string | null;
  hours: number | null;
  color: string | null;
  archived_at: string | null;
  customers: { name: string } | { name: string }[] | null;
};

type CustomerOption = { id: string; name: string };
type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const initialState = { ok: false, message: '' };
const assetTypes = ['boat', 'engine', 'trailer', 'jet_ski', 'rv', 'car', 'equipment'];

async function createAssetForm(formData: FormData) {
  'use server';
  await createAsset(initialState, formData);
}

function value(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const raw = params?.[key];
  return Array.isArray(raw) ? raw[0] || '' : raw || '';
}

function customerName(asset: AssetRow) {
  const customer = Array.isArray(asset.customers) ? asset.customers[0] : asset.customers;
  return customer?.name || 'Unassigned';
}

export default async function AssetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const context = await requireCompanyContext();
  const permissions = await getPermissions(['assets.create', 'assets.archive'], context);
  const type = value(params, 'type') || 'all';

  let request = context.supabase
    .from('assets')
    .select('id, asset_type, manufacturer, model, year, registration, vin, hin, hours, color, archived_at, customers(name)')
    .eq('company_id', context.membership.company_id)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (type !== 'all') request = request.eq('asset_type', type);

  const [{ data, error }, { data: customersData }] = await Promise.all([
    request,
    context.supabase
      .from('customers')
      .select('id, name')
      .eq('company_id', context.membership.company_id)
      .neq('status', 'archived')
      .order('name', { ascending: true })
      .limit(200)
  ]);

  const assets = (data || []) as AssetRow[];
  const customers = (customersData || []) as CustomerOption[];

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <p className="kicker">Operations</p>
          <h1 className="page-title">Assets</h1>
        </div>
      </div>

      {error && <div className="notice error">{error.message}</div>}

      <form className="toolbar glass" action="/assets">
        <select className="input compact" name="type" defaultValue={type}>
          <option value="all">All assets</option>
          {assetTypes.map((assetType) => <option key={assetType} value={assetType}>{enumLabel(assetType)}</option>)}
        </select>
        <button className="button secondary" type="submit">Filter</button>
      </form>

      {permissions['assets.create'] && (
        <form action={createAssetForm} className="panel-grid glass">
          <div className="form-section">
            <h2>Add asset</h2>
            <label className="label" htmlFor="customer_id">Customer</label>
            <select className="input" id="customer_id" name="customer_id">
              <option value="">Unassigned</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <label className="label" htmlFor="asset_type">Asset type</label>
            <select className="input" id="asset_type" name="asset_type" required>
              {assetTypes.map((assetType) => <option key={assetType} value={assetType}>{enumLabel(assetType)}</option>)}
            </select>
            <label className="label" htmlFor="manufacturer">Manufacturer</label>
            <input className="input" id="manufacturer" name="manufacturer" />
            <label className="label" htmlFor="model">Model</label>
            <input className="input" id="model" name="model" />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="year">Year</label>
            <input className="input" id="year" name="year" inputMode="numeric" />
            <label className="label" htmlFor="vin">VIN</label>
            <input className="input" id="vin" name="vin" />
            <label className="label" htmlFor="hin">HIN</label>
            <input className="input" id="hin" name="hin" />
            <label className="label" htmlFor="registration">Registration</label>
            <input className="input" id="registration" name="registration" />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="engine">Engine</label>
            <input className="input" id="engine" name="engine" />
            <label className="label" htmlFor="serial_number">Serial number</label>
            <input className="input" id="serial_number" name="serial_number" />
            <label className="label" htmlFor="hours">Hours</label>
            <input className="input" id="hours" name="hours" inputMode="decimal" />
            <label className="label" htmlFor="color">Color</label>
            <input className="input" id="color" name="color" />
            <label className="label" htmlFor="notes">Notes</label>
            <textarea className="input" id="notes" name="notes" rows={3} />
            <button className="button" type="submit">Create asset</button>
          </div>
        </form>
      )}

      <div className="data-list">
        {assets.map((asset) => (
          <article className="row-card glass" key={asset.id}>
            <div>
              <strong>{[enumLabel(asset.asset_type), asset.manufacturer, asset.model].filter(Boolean).join(' ')}</strong>
              <p>{customerName(asset)}</p>
              <div className="meta-line">
                {asset.year && <span>{asset.year}</span>}
                {asset.registration && <span>{asset.registration}</span>}
                {asset.vin && <span>VIN {asset.vin}</span>}
                {asset.hin && <span>HIN {asset.hin}</span>}
                {asset.hours !== null && <span>{asset.hours} hours</span>}
                {asset.color && <span>{asset.color}</span>}
              </div>
            </div>
            {permissions['assets.archive'] && (
              <form action={archiveAsset}>
                <input type="hidden" name="id" value={asset.id} />
                <button className="button secondary" type="submit">Archive</button>
              </form>
            )}
          </article>
        ))}
        {!assets.length && <div className="empty">No assets found.</div>}
      </div>
    </section>
  );
}
