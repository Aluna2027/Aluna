import Link from 'next/link';
import { Card } from '@/components/ui';
import { OrganizationCreateForm } from '@/components/organization-create-form';

type OrgType='university'|'ngo'|'company';

export default async function NewOrganization({searchParams}:{searchParams:Promise<{error?:string;type?:string}>}) {
 const {error,type}=await searchParams;
 const initial=(['university','ngo','company'].includes(type??'')?type:undefined) as OrgType|undefined;
 const helper=initial?`Create a ${initial==='ngo'?'NGO':initial==='university'?'University':'Company'} Profile. You will be its first admin.`:'Create a University, NGO or Company profile. You will be its first admin.';
 return <div className="space-y-5"><Link href={initial?`/organizations?type=${initial}`:'/organizations'} className="text-sm text-gold hover:underline">← Organizations</Link><Card title="Create an organization"><p className="mb-5 text-sm">{helper}</p><OrganizationCreateForm initialType={initial} error={error}/></Card></div>;
}
