import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {adminDb} from '@/lib/org-access';
import {Card} from '@/components/ui';
import {createInvitation,decideClaim,revokeOrganizationInvitation} from '../../organizations/access/actions';

export default async function OrganizationAccessAdmin({searchParams}:{searchParams:Promise<{status?:string;error?:string}>}){
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)redirect('/login');
 const {data:isAdmin,error:roleError}=await client.rpc('is_aluna_super_admin');
 if(roleError||isAdmin!==true)redirect('/organizations');
 const {status,error}=await searchParams;
 const db=adminDb();
 const [{data:claims,error:claimsError},{data:invitations,error:invitesError},{data:audit,error:auditError}] = await Promise.all([
  db.from('organization_claim_requests').select('id,organization_id,requester_id,requester_email,domain,status,created_at').in('status',['needs_review','dns_pending']).order('created_at',{ascending:true}).limit(100),
  db.from('organization_invitations').select('id,organization_id,recipient_email,created_at,expires_at,redeemed_at,revoked_at').order('created_at',{ascending:false}).limit(30),
  db.from('organization_access_audit').select('id,organization_id,action,occurred_at').order('occurred_at',{ascending:false}).limit(30)
 ]);
 const organizationIds=[...new Set([...(claims??[]).map(c=>c.organization_id),...(invitations??[]).map(i=>i.organization_id),...(audit??[]).map(a=>a.organization_id)])];
 const {data:organizations,error:orgError}=organizationIds.length
  ?await db.from('organizations').select('id,name,removed_at').in('id',organizationIds)
  :{data:[],error:null};
 const orgNames=new Map((organizations??[]).map(o=>[o.id,o.name]));
 const blocked=!!claimsError||!!invitesError||!!auditError||!!orgError;
 return <div className="space-y-6">
  <header><p className="deck-label">ALUNA GLOBAL NETWORK · RESTRICTED</p><Link href="/aluna-admin" className="text-sm text-gold">← Aluna Administration</Link><h1 className="mt-3 text-3xl font-bold">Organization Access</h1><p className="mt-2 text-muted">Claim exceptions, verified-email invitations and audit history. Super Admin only.</p></header>
  {status&&<p role="status" className="rounded-xl border border-gold p-3 text-gold">Action completed: {status}</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Action not completed ({error}). Please review the request status.</p>}
  {blocked?<p role="alert" className="rounded-xl border border-red-700 p-3 text-red-300">Organization access records could not be loaded. Actions are unavailable.</p>:<>
   <div className="grid gap-4 sm:grid-cols-3">
    <Card title="Pending Claims"><p className="metric-number text-4xl text-gold">{claims?.length??0}</p><p className="text-xs text-muted">First 100 pending requests</p></Card>
    <Card title="Recent Invitations"><p className="metric-number text-4xl text-gold">{invitations?.length??0}</p></Card>
    <Card title="Recent Decisions"><p className="metric-number text-4xl text-gold">{audit?.length??0}</p></Card>
   </div>
   <Card title="Claim Requests — Manual Exceptions"><div className="space-y-4">
    <p className="text-sm text-muted">Approve only after independently confirming the applicant is authorized to represent this organization. Matching an email domain alone is not sufficient. Approvals grant the first Organization Admin role.</p>
    {(claims??[]).map(claim=><div key={claim.id} className="space-y-3 rounded-xl border border-line p-4">
     <div><Link href={`/organizations/${claim.organization_id}?tab=profile`} className="font-semibold text-gold">{orgNames.get(claim.organization_id)??'Organization'}</Link><p className="text-sm text-ink">{claim.requester_email}</p><p className="text-xs text-muted">Email domain: {claim.domain} · {claim.status} · {new Date(claim.created_at).toLocaleString('en-GB')}</p></div>
     <div className="flex flex-wrap gap-3">
      <form action={decideClaim} className="space-y-2"><input type="hidden" name="claim_id" value={claim.id}/><input type="hidden" name="decision" value="approve"/><label className="flex items-center gap-2 text-xs"><input type="checkbox" required name="evidence_confirmed" value="yes"/> I independently verified the representative&apos;s authority</label><button type="submit" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy">Approve first admin</button></form>
      <form action={decideClaim}><input type="hidden" name="claim_id" value={claim.id}/><input type="hidden" name="decision" value="reject"/><button type="submit" className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-300">Reject request</button></form>
     </div>
    </div>)}
    {!claims?.length&&<p>No claim requests awaiting manual review.</p>}
   </div></Card>
   <Card title="Invite an Organization Representative"><p className="mb-4 text-sm text-muted">A recipient-bound, single-use invitation lasts seven days. Send only after verifying the intended organization and email address. Delivery requires the Aluna email provider configuration.</p><form action={createInvitation} className="grid max-w-2xl gap-3 sm:grid-cols-2">
    <label className="text-sm">Organization ID<input name="organization_id" required maxLength={36} placeholder="Organization UUID" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
    <label className="text-sm">Representative email<input name="email" type="email" required maxLength={254} placeholder="representative@organization.org" className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/></label>
    <button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy sm:col-span-2">Send invitation</button>
   </form></Card>
   <Card title="Recent Invitations"><div className="space-y-2">{(invitations??[]).map(inv=><div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-sm"><p>{orgNames.get(inv.organization_id)??'Organization'} · {inv.recipient_email} · {inv.revoked_at?'Revoked':inv.redeemed_at?'Accepted':new Date(inv.expires_at)<new Date()?'Expired':'Pending'}</p>{!inv.revoked_at&&!inv.redeemed_at&&new Date(inv.expires_at)>new Date()&&<form action={revokeOrganizationInvitation}><input type="hidden" name="invitation_id" value={inv.id}/><button type="submit" className="rounded-lg border border-red-700 px-3 py-2 text-red-300">Revoke</button></form>}</div>)}{!invitations?.length&&<p>No invitations sent.</p>}</div></Card>
   <Card title="Organization Access Audit"><div className="space-y-2">{(audit??[]).map(entry=><p className="border-b border-line py-2 text-sm" key={entry.id}>{orgNames.get(entry.organization_id)??'Organization'} · {entry.action} · {new Date(entry.occurred_at).toLocaleString('en-GB')}</p>)}{!audit?.length&&<p>No access decisions recorded.</p>}</div></Card>
  </>}
 </div>;
}
