import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Card} from '@/components/ui';
import {adminDb,tokenHash,verifiedIdentity} from '@/lib/org-access';
import {acceptInvitation} from '../../access/actions';

export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[0-9a-f]{64}$/.test(token))redirect('/organizations');
 const identity=await verifiedIdentity();
 const invitationPath='/organizations/invite/'+token;
 if(!identity)return <Card title="Organization invitation"><p>Sign in with the verified email address to which your invitation was sent before accepting.</p><Link className="text-gold" href={'/login?next='+encodeURIComponent(invitationPath)}>Log in or create an account</Link></Card>;

 // Only read the recipient and state. Never expose the stored token hash to the client.
 const db=adminDb();
 const {data:invitation,error}=await db.from('organization_invitations')
  .select('organization_id,recipient_email,expires_at,revoked_at,redeemed_at')
  .eq('token_hash',tokenHash(token)).maybeSingle();
 if(error)return <Card title="Organization invitation"><p>We could not check this invitation. Please try again later.</p></Card>;
 if(!invitation)return <Card title="Organization invitation"><p>This invitation link is invalid.</p></Card>;
 if(invitation.revoked_at||invitation.redeemed_at||new Date(invitation.expires_at).getTime()<=Date.now())
  return <Card title="Organization invitation"><p>This invitation is no longer available. It may have been accepted, revoked, or expired. Request a new invitation from your organization.</p></Card>;

 const invitedEmail=invitation.recipient_email.trim().toLowerCase();
 if(identity.email!==invitedEmail)return <Card title="Organization invitation">
  <p className="mb-3">This invitation was sent to <strong>{invitedEmail}</strong>.</p>
  <p className="mb-3">You are currently signed in as <strong>{identity.email}</strong>.</p>
  <p className="mb-3 text-amber-300" role="alert">These email addresses do not match. You cannot accept this invitation with the current account.</p>
  <p>Sign out using the profile menu, then reopen the invitation link and sign in with the invited email address.</p>
 </Card>;

 return <Card title="Organization invitation">
  <p className="mb-3">Invited email: <strong>{invitedEmail}</strong></p>
  <p className="mb-4">You are signed in with the correct verified Aluna email. Invitations expire after seven days and can be used once.</p>
  <form action={acceptInvitation}><input type="hidden" name="token" value={token}/><button className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Accept invitation</button></form>
 </Card>;
}
