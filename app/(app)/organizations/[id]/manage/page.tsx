import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {Card} from '@/components/ui';
import { Building2, UsersRound, Wifi, Target, HandCoins } from 'lucide-react';
import {createInvitation} from '../../access/actions';
export default async function ManageOrganization({params}:{params:Promise<{id:string}>}){
 const {id}=await params,client=await createClient();
 const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 const {data:member}=await client.from('organization_members').select('member_role').eq('organization_id',id).eq('profile_id',user.id).maybeSingle();
 if(member?.member_role!=='admin')notFound();
 const {data:org}=await client.from('organizations').select('name').eq('id',id).is('removed_at',null).maybeSingle();if(!org)notFound();
 const sections=[
  {label:'Organization Profile',text:'Name, logo, description, location and website',href:'/organizations/'+id+'/edit'},
  {label:'Members',text:'Review membership requests and approved members',href:'/organizations/'+id+'?tab=members&manage=1'},
  {label:'Wi-Fi Mesh Communities',text:'Manage existing communities and create new ones',href:'/organizations/'+id+'?tab=wi-fi-mesh&manage=1'},
  {label:'Missions',text:'Manage the organization’s SDG missions',href:'/organizations/'+id+'?tab=missions&manage=1'},
  {label:'Fundraising',text:'Manage the organization’s fundraising activity',href:'/organizations/'+id+'?tab=fundraising&manage=1'}
 ];
 return <div className="space-y-5"><Link className="text-gold" href={'/organizations/'+id+'?tab=profile'}>← Organization Profile</Link><h1 className="text-3xl font-bold">Manage Organization</h1><p className="text-muted">{org.name} · Organization Admin</p>
 <div className="grid gap-4 sm:grid-cols-2">{sections.map((s,i)=><Card key={s.label} title={s.label}><span className="mb-2 inline-flex text-[#26E7D4]">{[<Building2 key="profile" size={25}/>,<UsersRound key="members" size={25}/>,<Wifi key="wifi" size={25}/>,<Target key="missions" size={25}/>,<HandCoins key="fundraising" size={25}/>][i]}</span><p className="mb-3 text-sm text-muted">{s.text}</p><Link className="text-gold" href={s.href}>Open →</Link></Card>)}</div>
 <Card title="Invite Representative"><p className="mb-3 text-sm text-muted">Invite a representative to manage this organization. This grants organization administration privileges after verified-email acceptance.</p><form action={createInvitation} className="flex flex-wrap gap-3"><input type="hidden" name="organization_id" value={id}/><input type="email" name="email" required placeholder="name@organization.org" className="rounded-xl border border-line bg-panel-raised p-3"/><button className="rounded-xl bg-gold px-4 py-2 font-semibold text-navy">Send invitation</button></form></Card>
 </div>;
}
