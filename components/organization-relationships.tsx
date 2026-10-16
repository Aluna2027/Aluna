import { Handshake, HandHeart } from 'lucide-react';
import { Card } from '@/components/ui';

export async function OrganizationRelationshipCards({organizationId,isAdmin,managing}:{organizationId:string;isAdmin:boolean;managing:boolean}) {
 return <section className="grid gap-4 md:grid-cols-2">
  <Card title="Partnerships"><div className="mb-3 text-[#26E7D4]"><Handshake size={25}/></div><p className="text-sm text-muted">Organization partnerships.</p></Card>
  <Card title="Sponsorships"><div className="mb-3 text-[#26E7D4]"><HandHeart size={25}/></div><p className="text-sm text-muted">Organization sponsorships.</p></Card>
 </section>;
}
