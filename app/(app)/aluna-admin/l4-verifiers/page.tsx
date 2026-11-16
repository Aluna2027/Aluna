import Link from 'next/link';
import {Card} from '@/components/ui';
import {requireAlunaSuperAdmin,adminSearch} from '@/lib/aluna-admin';
import {changeL4Verifier} from './actions';

export default async function L4VerifierAdmin({searchParams}:{searchParams:Promise<{q?:string;status?:string;error?:string}>}){
 const {db}=await requireAlunaSuperAdmin();
 const params=await searchParams;
 const q=adminSearch(params.q);
 const [{data:grants,error:grantError},{data:people,error:peopleError}]=await Promise.all([
  db.from('pr45_l4_verifier_grants').select('profile_id,trained_on,granted_at,revoked_at,rationale').order('granted_at',{ascending:false}).limit(100),
  (()=>{let query=db.from('profiles').select('id,display_name,first_name,last_name').order('display_name').limit(25);
    if(q)query=query.or(`display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    return query;})()
 ]);
 const active=new Set((grants??[]).filter(g=>!g.revoked_at).map(g=>g.profile_id));
 const ids=(grants??[]).map(g=>g.profile_id);
 const {data:grantProfiles}=ids.length?await db.from('profiles').select('id,display_name,first_name,last_name').in('id',ids):{data:[]};
 const names=new Map((grantProfiles??[]).map(p=>[p.id,p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||p.id]));
 const fullName=(p:{id:string;display_name:string|null;first_name:string|null;last_name:string|null})=>p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||p.id;
 return <div className="space-y-6">
  <header><Link href="/aluna-admin" className="text-sm text-gold">← Aluna Administration</Link><h1 className="mt-3 text-3xl font-bold text-ink">Aluna L4 Verifier Management</h1><p className="mt-2 text-sm text-muted">Accredit trusted reviewers after Aluna training, and revoke access when required. Every grant or revocation is recorded in a protected audit table.</p></header>
  {params.status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Verifier authorization updated.</p>}
  {params.error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Authorization could not be saved. Check the training date, reason and required PR #45 migration.</p>}
  {grantError&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Verifier database migration is not installed or cannot be read. No authorization actions are available.</p>}
  <Card title="Accredited reviewers">
   <p className="mb-4 text-sm text-muted">Accredited Aluna verifiers may issue direct internal L4 approvals for others. They cannot approve Contributions they control or previously reviewed. Only Super Admins may approve their own.</p>
   {grantError?null:<div className="space-y-3">{(grants??[]).map(grant=><div key={grant.profile_id} className="rounded-xl border border-line p-4">
    <p className="font-semibold text-ink">{names.get(grant.profile_id)??grant.profile_id}</p>
    <p className="mt-1 text-xs text-muted">Training: {grant.trained_on} · {grant.revoked_at?'Revoked':'Active'}</p>
    <p className="mt-2 text-sm">{grant.rationale}</p>
    {!grant.revoked_at&&<form action={changeL4Verifier} className="mt-3 space-y-2"><input type="hidden" name="profile_id" value={grant.profile_id}/><input type="hidden" name="action" value="revoke"/><label className="block text-sm">Revocation reason *<textarea name="reason" minLength={20} maxLength={1000} required rows={2} className="mt-1 w-full rounded-xl border border-line bg-panel-raised p-3"/></label><button type="submit" className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300">Revoke L4 authorization</button></form>}
   </div>)}{!grants?.length&&<p className="text-sm text-muted">No accredited verifiers yet.</p>}</div>}
  </Card>
  <Card title="Accredit a trained Aluna verifier">
   <form action="/aluna-admin/l4-verifiers" className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search user by name" aria-label="Search user" className="min-w-0 flex-1 rounded-xl border border-line bg-panel-raised p-3"/><button className="rounded-xl border border-gold px-4 py-2 text-gold" type="submit">Search</button></form>
   {peopleError?<p role="alert" className="text-red-300">Unable to load user profiles.</p>:<div className="space-y-4">{(people??[]).filter(p=>!active.has(p.id)).map(p=><form key={p.id} action={changeL4Verifier} className="space-y-3 rounded-xl border border-line p-4">
    <p className="font-semibold">{fullName(p)}</p><p className="break-all text-xs text-muted">{p.id}</p>
    <input type="hidden" name="profile_id" value={p.id}/><input type="hidden" name="action" value="grant"/>
    <label className="block text-sm">Completed Aluna training date *<input name="trained_on" type="date" required max={new Date().toISOString().slice(0,10)} className="mt-1 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
    <label className="block text-sm">Reason and training evidence reference *<textarea name="reason" required minLength={20} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border border-line bg-panel-raised p-3" placeholder="Training attended, assessment, and why you trust this reviewer"/></label>
    <button disabled={Boolean(grantError)} className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy disabled:opacity-50" type="submit">Accredit as Aluna L4 Verifier</button>
   </form>)}{!people?.length&&<p className="text-sm text-muted">No matching people found.</p>}</div>}
  </Card>
 </div>;
}
