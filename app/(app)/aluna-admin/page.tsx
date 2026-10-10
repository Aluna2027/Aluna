import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { removeOrganization,restoreOrganization,updateOrganizationWba } from '../organizations/actions';
import { ArchiveOrganizationConfirmation } from '@/components/archive-organization-confirmation';

export default async function AlunaAdmin({searchParams}:{searchParams:Promise<{status?:string;error?:string}>}) {
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)redirect('/login');
  const {data:isAdmin,error:roleError}=await client.rpc('is_aluna_super_admin');
  if(roleError||!isAdmin)redirect('/organizations');
  const {status,error}=await searchParams;
  const {data:organizations,error:loadError}=await client.from('organizations')
    .select('id,name,organization_type,country,management_type,removed_at,wba_assessment_year,wba_total_score,wba_human_rights_score,wba_decent_work_score,wba_acting_ethically_score')
    .order('name').limit(5000);
  const active=organizations?.filter(org=>!org.removed_at)??[];
  const archived=organizations?.filter(org=>!!org.removed_at)??[];
  const {data:audit}=await client.from('organization_admin_audit')
    .select('id,organization_name,action,occurred_at').order('occurred_at',{ascending:false}).limit(25);
  return <div className="space-y-6">
    <header><p className="deck-label">ALUNA GLOBAL NETWORK · RESTRICTED</p><h1 className="mt-2 text-4xl">Aluna Administration</h1><p className="mt-2 text-muted">Organization ownership, archives and official WBA scores.</p></header>
    {status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Action completed: {status}</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">The action could not be completed ({error}). No changes were confirmed.</p>}
    {loadError&&<p role="alert" className="text-red-300">Could not load organizations.</p>}
    <div className="grid gap-4 sm:grid-cols-3">
      <Card title="Active organizations"><p className="metric-number text-4xl text-gold">{active.length}</p></Card>
      <Card title="Archived organizations"><p className="metric-number text-4xl text-gold">{archived.length}</p></Card>
      <Card title="Aluna-managed"><p className="metric-number text-4xl text-gold">{active.filter(o=>o.management_type==='aluna_managed').length}</p></Card>
    </div>
    <Card title="Active organizations">
      <p className="mb-4 text-sm">Super Admin may archive any organization. Community creators can archive only their own inactive organizations.</p>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {active.map(org=><div key={org.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
          <div><Link href={`/organizations/${org.id}`} className="font-semibold text-ink hover:text-gold">{org.name}</Link><p className="text-xs text-muted">{org.organization_type} · {org.management_type} · {org.country??'Unknown country'}</p></div>
          <ArchiveOrganizationConfirmation><form action={removeOrganization} data-archive-organization data-organization-name={org.name}><input type="hidden" name="id" value={org.id}/><input type="hidden" name="return_to" value="admin"/><button type="submit" className="rounded-lg border border-red-700 px-3 py-2 text-sm text-red-300">Archive</button></form></ArchiveOrganizationConfirmation>
        </div>)}
        {!active.length&&<p>No active organizations.</p>}
      </div>
    </Card>
    <Card title="Archived organizations">
      <div className="space-y-2">{archived.map(org=><div key={org.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
        <div><p className="font-semibold text-ink">{org.name}</p><p className="text-xs text-muted">{org.organization_type} · {org.management_type}</p></div>
        <form action={restoreOrganization}><input type="hidden" name="id" value={org.id}/><button type="submit" className="rounded-lg border border-gold px-3 py-2 text-sm text-gold">Restore</button></form>
      </div>)}{!archived.length&&<p>No archived organizations.</p>}</div>
    </Card>
    <Card title="Official WBA score management">
      <p className="mb-4 text-sm">Change scores for one company at a time. Values are entered on the original 0–100 scale. Changes are recorded in the audit log.</p>
      <form action={updateOrganizationWba} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">Company<select required name="id" defaultValue="" className="mt-2 w-full rounded-xl border border-line p-3"><option value="" disabled>Select a company</option>{active.filter(o=>o.organization_type==='company').map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="block text-sm">Assessment year<input required type="number" name="year" min="2000" max="2100" defaultValue={new Date().getFullYear()} className="mt-2 w-full rounded-xl border border-line p-3"/></label>
        <div className="hidden sm:block"/>
        {([['total','Total score'],['human','Respecting Human Rights'],['decent','Providing and Promoting Decent Work'],['ethics','Acting Ethically']] as const).map(([key,label])=><label key={key} className="block text-sm">{label}<input name={key} type="number" min="0" max="100" step="0.1" placeholder="Not assessed" className="mt-2 w-full rounded-xl border border-line p-3"/></label>)}
        <p className="text-xs text-muted sm:col-span-2">Empty values are stored as unscored. Only submit when all current scores for this company have been checked.</p>
        <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy sm:col-span-2">Update WBA scores</button>
      </form>
    </Card>
    <Card title="Recent audit activity"><div className="space-y-2">{audit?.map(row=><div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 text-sm"><span>{row.organization_name} · {row.action}</span><span className="text-muted">{new Date(row.occurred_at).toLocaleString('en-GB')}</span></div>)}{!audit?.length&&<p>No recorded actions yet.</p>}</div></Card>
    <p className="text-xs text-muted">Bulk annual WBA imports require a separate preview-and-approval workflow; this page provides individual score updates only.</p>
  </div>;
}
