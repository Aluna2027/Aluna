import Link from 'next/link';
import { Card } from '@/components/ui';
import { requireAlunaSuperAdmin } from '@/lib/aluna-admin';
import { first340Statuses, first340StatusLabel } from '@/lib/first340';

type Search = { q?: string; status?: string; country?: string; from?: string; to?: string; page?: string };

function queryHref(params: Search, page: number) {
  const next = new URLSearchParams();
  for (const key of ['q','status','country','from','to'] as const) if (params[key]) next.set(key, params[key]!);
  next.set('page', String(page));
  return `/aluna-admin/first-340?${next.toString()}`;
}

export default async function First340AdminOverview({ searchParams }:{searchParams:Promise<Search>}) {
  const params = await searchParams;
  const { client } = await requireAlunaSuperAdmin();
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const limit = 25;
  const { data: people, error } = await client.rpc('first340_admin_application_page', {
    p_search: params.q?.trim() || null,
    p_status: params.status || null,
    p_country: params.country?.trim() || null,
    p_submitted_from: params.from || null,
    p_submitted_to: params.to || null,
    p_limit: limit,
    p_offset: (page - 1) * limit,
  });
  const rows = (people ?? []) as Array<{
    profile_id: string; display_name: string|null; username: string|null; contact_email: string|null;
    phone_e164: string|null; phone_country_code: string|null; country: string|null; latest_status: string|null;
    latest_submitted_at: string|null; latest_activity_at: string|null; latest_application_id: string|null;
    current_draft_id: string|null; total_count: number|string;
  }>;
  const total = Number(rows[0]?.total_count ?? 0);
  return <div className="space-y-6">
    <header><p className="deck-label">ALUNA · SUPER ADMIN · RESTRICTED</p><h1 className="mt-2 text-4xl">340 Applications</h1><p className="mt-2 text-muted">Search applicants and open their versioned application dossiers.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/aluna-admin" className="text-sm text-gold">← Aluna Administration</Link>
      <Link href="/aluna-admin/first-340/teams" className="rounded-xl border border-line px-4 py-2 text-sm text-gold">View Teams →</Link>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Applications could not be loaded.</p>}
    <Card title="Search and filter">
      <form method="get" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm lg:col-span-2">Name, username, email or profile ID<input name="q" defaultValue={params.q} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
          <label className="text-sm">Status<select name="status" defaultValue={params.status ?? ''} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"><option value="">All statuses</option>{first340Statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">Country<input name="country" defaultValue={params.country} className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto] lg:items-end">
          <label className="text-sm">Submitted from<input lang="en-GB" type="date" name="from" defaultValue={params.from} className="mt-2 w-full min-w-[12rem] rounded-xl border border-line bg-panel-raised p-3"/></label>
          <label className="text-sm">Submitted to<input lang="en-GB" type="date" name="to" defaultValue={params.to} className="mt-2 w-full min-w-[12rem] rounded-xl border border-line bg-panel-raised p-3"/></label>
          <div className="flex items-end gap-3"><button className="rounded-xl bg-gold px-4 py-3 font-semibold text-navy">Apply filters</button><Link href="/aluna-admin/first-340" className="pb-3 text-sm text-gold">Clear</Link></div>
        </div>
      </form>
    </Card>
    <Card title={`Applicants · ${total}`}>
      <div className="space-y-3">{rows.map((row) => <article key={row.profile_id} className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="font-semibold text-ink">{row.display_name || row.username || 'Applicant'}</h2>
            <p className="mt-1 break-all text-xs text-muted">{row.username ? `@${row.username} · ` : ''}{row.profile_id}</p>
            <p className="mt-2 break-all text-sm">{row.contact_email || 'No contact email'} · {row.phone_e164 || 'No phone'}</p>
            <p className="mt-1 text-sm text-muted">{row.country || 'Country not provided'} · {row.latest_status ? first340StatusLabel(row.latest_status) : 'Draft only'}</p>
            <p className="mt-1 text-xs text-muted">Latest submitted: {row.latest_submitted_at ? new Date(row.latest_submitted_at).toLocaleString() : 'None'} · Activity: {row.latest_activity_at ? new Date(row.latest_activity_at).toLocaleString() : '—'}{row.current_draft_id ? ' · Current draft available' : ''}</p>
          </div>
          <Link href={`/aluna-admin/first-340/${row.profile_id}`} className="shrink-0 rounded-lg border border-gold px-4 py-2 text-sm text-gold">Open dossier →</Link>
        </div>
      </article>)}
      {!rows.length && !error && <p className="text-sm text-muted">No matching applicants.</p>}</div>
      <nav aria-label="Applicant pages" className="mt-5 flex justify-between">
        {page > 1 ? <Link href={queryHref(params,page-1)} className="text-gold">← Previous</Link> : <span/>}
        {page * limit < total ? <Link href={queryHref(params,page+1)} className="text-gold">Next →</Link> : <span/>}
      </nav>
    </Card>
  </div>;
}
