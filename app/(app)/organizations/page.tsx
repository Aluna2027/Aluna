import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 48;
type SortOrder = 'score' | 'name' | 'name_desc' | 'country';
type Params = { type?: string; q?: string; sort?: string; page?: string };

function directoryUrl(type?: string, q?: string, sort?: string, page?: number) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (q) params.set('q', q);
  if (sort) params.set('sort', sort);
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/organizations?${query}` : '/organizations';
}

function scoreWidth(value: number | null) {
  return value == null ? 0 : Math.max(0, Math.min(100, Number(value) * 10));
}

export default async function Organizations({ searchParams }: { searchParams: Promise<Params> }) {
  const { type, q: rawQuery, sort: rawSort, page: rawPage } = await searchParams;
  const client = await createClient();
  const filter = ['university', 'ngo', 'company'].includes(type ?? '') ? type : undefined;
  const queryText = (rawQuery ?? '').trim().slice(0, 120);
  const normalized = queryText.toLocaleLowerCase('en');
  const typeSearch = ['university', 'universities'].includes(normalized)
    ? 'university'
    : ['ngo', 'ngos'].includes(normalized)
      ? 'ngo'
      : ['company', 'companies', 'business', 'businesses'].includes(normalized)
        ? 'company'
        : null;
  const companyView = (filter ?? typeSearch) === 'company';
  const validSorts: SortOrder[] = ['score', 'name', 'name_desc', 'country'];
  const sort: SortOrder = validSorts.includes(rawSort as SortOrder)
    ? rawSort as SortOrder
    : companyView ? 'score' : 'name';
  const parsedPage = Number(rawPage);
  const page = Number.isSafeInteger(parsedPage) && parsedPage >= 1 ? Math.min(parsedPage, 10000) : 1;

  let query = client.from('organizations')
    .select('id,name,organization_type,country,description,location_text,wba_total_score', { count: 'exact' })
    .is('removed_at', null);
  if (filter) query = query.eq('organization_type', filter);
  if (queryText) {
    if (typeSearch) {
      query = query.eq('organization_type', typeSearch);
    } else {
      const safe = queryText.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,location_text.ilike.%${safe}%,country.ilike.%${safe}%`);
    }
  }

  if (sort === 'score') {
    query = query.order('wba_total_score', { ascending: false, nullsFirst: false }).order('name');
  } else if (sort === 'country') {
    query = query.order('country', { ascending: true, nullsFirst: false }).order('name');
  } else {
    query = query.order('name', { ascending: sort === 'name' });
  }

  const start = (page - 1) * PAGE_SIZE;
  const { data: organizations, count, error } = await query.range(start, start + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="deck-label">ALUNA ACTORS</p>
          <h1 className="mt-2 text-4xl">Organizations</h1>
        </div>
        <Link href={filter ? `/organizations/new?type=${filter}` : '/organizations/new'} className="h-fit rounded-xl bg-gold px-5 py-3 font-semibold text-navy hover:bg-gold-soft">
          Create organization
        </Link>
      </div>

      <form method="get" className="glass rounded-2xl p-4">
        {filter && <input type="hidden" name="type" value={filter} />}
        {rawSort && validSorts.includes(rawSort as SortOrder) && <input type="hidden" name="sort" value={rawSort} />}
        <label htmlFor="organization-search" className="block text-sm">Search Organizations</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="organization-search" name="q" defaultValue={queryText} placeholder="Search Universities, Companies and NGOs" className="w-full rounded-xl border border-line bg-panel-raised p-3" />
          <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Search</button>
          {queryText && <Link href={directoryUrl(filter, undefined, rawSort)} className="rounded-xl border border-line px-5 py-3 text-center text-gold">Clear</Link>}
        </div>
      </form>

      <nav aria-label="Organization types" className="flex gap-2 overflow-x-auto">
        {([['All', ''], ['Universities', 'university'], ['NGOs', 'ngo'], ['Companies', 'company']] as const).map(([label, value]) => (
          <Link
            key={label}
            href={directoryUrl(value, queryText)}
            aria-current={(filter ?? '') === value ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm ${(filter ?? '') === value ? 'bg-gold text-navy' : 'glass'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="glass flex flex-wrap items-end justify-between gap-4 rounded-2xl p-4">
        <div>
          <p className="deck-label">EXPLORE THE NETWORK</p>
          <p className="mt-1 text-sm text-muted">
            {total > 0 ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} organizations` : 'No organizations found'}
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          {filter && <input type="hidden" name="type" value={filter} />}
          {queryText && <input type="hidden" name="q" value={queryText} />}
          <div>
            <label htmlFor="organization-sort" className="mb-1 block text-xs text-muted">Sort by</label>
            <select id="organization-sort" name="sort" defaultValue={sort} className="min-w-56 rounded-xl border border-line bg-panel-raised px-3 py-2 text-sm">
              <option value="score">WBA Total Score — Highest first</option>
              <option value="name">Organization Name — A to Z</option>
              <option value="name_desc">Organization Name — Z to A</option>
              <option value="country">Country — A to Z</option>
            </select>
          </div>
          <button className="rounded-xl border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10">Apply</button>
        </form>
      </div>

      {error && <p role="alert" className="text-sm text-muted">Organizations could not be loaded. Please try again.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {organizations?.map(org => (
          <Link key={org.id} href={`/organizations/${org.id}`} className="glass rounded-2xl p-6 transition-colors hover:border-gold">
            <p className="deck-label">{org.organization_type}{org.country && <> · <span className="text-gold">{org.country}</span></>}</p>
            <h2 className="mt-2 text-xl">{org.name}</h2>
            {org.location_text && <p className="mt-2 text-sm text-muted">{org.location_text}</p>}
            <p className="mt-3 line-clamp-2 text-sm text-muted">{org.description || 'Explore this organization’s profile.'}</p>
            {org.organization_type === 'company' && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">WBA Total Score</span>
                  {org.wba_total_score != null ? (
                    <span className="flex items-baseline gap-1">
                      <span className="metric-number text-2xl leading-none text-gold">{(Number(org.wba_total_score) * 10).toFixed(1)}</span>
                      <span className="text-xs text-muted">/ 100</span>
                    </span>
                  ) : <span className="text-xs text-muted">Not scored</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${scoreWidth(org.wba_total_score)}%` }} />
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
      {!error && !organizations?.length && <p className="text-muted">{queryText ? 'No organizations match your search.' : 'No organizations in this category yet.'}</p>}

      {totalPages > 1 && (
        <nav aria-label="Organizations pages" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link className="rounded-xl border border-line px-4 py-2 text-gold hover:border-gold" href={directoryUrl(filter, queryText, sort, page - 1)}>← Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {totalPages}</span>
          {page < totalPages ? <Link className="rounded-xl border border-line px-4 py-2 text-gold hover:border-gold" href={directoryUrl(filter, queryText, sort, page + 1)}>Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
