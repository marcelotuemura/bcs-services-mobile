import { updateCompanySettings } from '@/actions/settings';
import { getPermissions, requireCompanyContext } from '@/lib/auth/permissions';

type CompanyRow = { name: string };
type SettingsRow = {
  logo_url: string | null;
  tax_rate: number | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
};

const initialState = { ok: false, message: '' };

async function updateCompanySettingsForm(formData: FormData) {
  'use server';
  await updateCompanySettings(initialState, formData);
}

export default async function SettingsPage() {
  const context = await requireCompanyContext();
  const permissions = await getPermissions(['settings.view', 'settings.manage', 'audit.view'], context);
  const companyId = context.membership.company_id;
  const [{ data: company }, { data: settings }, { data: auditLog }] = await Promise.all([
    context.supabase.from('companies').select('name').eq('id', companyId).single(),
    context.supabase.from('company_settings').select('logo_url, tax_rate, currency, language, timezone').eq('company_id', companyId).maybeSingle(),
    context.supabase.from('audit_log').select('id, action, entity_type, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  const companyRow = company as CompanyRow | null;
  const settingsRow = settings as SettingsRow | null;

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <p className="kicker">Company</p>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      {!permissions['settings.view'] && <div className="notice error">You do not have permission to view company settings.</div>}

      {permissions['settings.view'] && (
        <form action={updateCompanySettingsForm} className="panel-grid glass">
          <div className="form-section">
            <h2>Company profile</h2>
            <label className="label" htmlFor="company_name">Company name</label>
            <input className="input" id="company_name" name="company_name" defaultValue={companyRow?.name || ''} disabled={!permissions['settings.manage']} required />
            <label className="label" htmlFor="logo_url">Logo URL</label>
            <input className="input" id="logo_url" name="logo_url" defaultValue={settingsRow?.logo_url || ''} disabled={!permissions['settings.manage']} />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="tax_rate">Tax rate</label>
            <input className="input" id="tax_rate" name="tax_rate" inputMode="decimal" defaultValue={settingsRow?.tax_rate ?? 0} disabled={!permissions['settings.manage']} />
            <label className="label" htmlFor="currency">Currency</label>
            <input className="input" id="currency" name="currency" maxLength={3} defaultValue={settingsRow?.currency || 'USD'} disabled={!permissions['settings.manage']} />
          </div>
          <div className="form-section">
            <label className="label" htmlFor="language">Language</label>
            <input className="input" id="language" name="language" defaultValue={settingsRow?.language || 'en'} disabled={!permissions['settings.manage']} />
            <label className="label" htmlFor="timezone">Timezone</label>
            <input className="input" id="timezone" name="timezone" defaultValue={settingsRow?.timezone || 'America/New_York'} disabled={!permissions['settings.manage']} />
            {permissions['settings.manage'] && <button className="button" type="submit">Save settings</button>}
          </div>
        </form>
      )}

      {permissions['audit.view'] && (
        <section className="card glass">
          <h2>Audit log</h2>
          <div className="mini-list">
            {(auditLog || []).map((entry) => (
              <span key={entry.id}>
                <strong>{entry.action}</strong>
                <small>{entry.entity_type} · {new Date(entry.created_at).toLocaleString()}</small>
              </span>
            ))}
            {!auditLog?.length && <p>No audit events recorded yet.</p>}
          </div>
        </section>
      )}
    </section>
  );
}
