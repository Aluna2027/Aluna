import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Card} from '@/components/ui';
import {verifiedIdentity} from '@/lib/org-access';
import {acceptInvitation} from '../../access/actions';
export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[0-9a-f]{64}$/.test(token))redirect('/organizations');
 const identity=await verifiedIdentity();
 if(!identity)return <Card title="Organization invitation"><p>Sign in with the email address to which your invitation was sent, and verify that address before accepting.</p><Link className="text-gold" href={'/login?next='+encodeURIComponent('/organizations/invite/'+token)}>Log in or create an account</Link></Card>;
 return <Card title="Organization invitation"><p className="mb-4">This invitation will grant access only if your verified Aluna email matches its recipient. Invitations expire after seven days and can be used once.</p><form action={acceptInvitation}><input type="hidden" name="token" value={token}/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Accept invitation</button></form></Card>;
}
