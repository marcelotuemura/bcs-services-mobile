import { getPermissions, requireCompanyContext } from '@/lib/auth/permissions';
import { formatDateTime, enumLabel } from '@/lib/format';

type SearchRow = {
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string;
  href: string;
  updated_at: string;
};

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined> | undefined, key: string) {
  const raw = params?.[key];
  return Array.isArray(raw) ? raw[0] || '' : raw || '';
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = value(params, 'q').trim();
  const context = await requireCompanyContext();
  const permissions = await getPermissions(['search.use'], context);
  const { data, error } = permissions['search.use']
    ? await context.supabase.rpc('search_company_records', {
      search_term: query,
      result_limit: 30
    })
    : { data: [], error: null };
  const results = (data || []) as SearchRow[];

  return (
    <section className="stack">
      <div className="topbar">
        <div>
          <p className="kicker">Workspace</p>
          <h1 className="page-title">Search</h1>
        </div>
      </div>

      {!permissions['search.use'] && <div className="notice error">You do not have permission to use search.</div>}
      {error && <div className="notice error">{error.message}</div>}

      <form className="toolbar glass" action="/search">
        <input className="input compact" name="q" placeholder="Search customers, assets, work orders" defaultValue={query} />
        <button className="button secondary" type="submit">Search</button>
      </form>

      <div className="data-list">
        {results.map((result) => (
          <a className="row-card glass" href={result.href} key={`${result.entity_type}-${result.entity_id}`}>
            <div>
              <strong>{result.title}</strong>
              <p>{result.subtitle}</p>
              <div className="meta-line">
                <span>{enumLabel(result.entity_type)}</span>
                <span>{formatDateTime(result.updated_at)}</span>
              </div>
            </div>
          </a>
        ))}
        {permissions['search.use'] && query && !results.length && <div className="empty">No results found.</div>}
      </div>
    </section>
  );
}
