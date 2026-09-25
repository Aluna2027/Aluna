'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { paymentAdmin, siteOrigin, stripeServer } from '@/lib/payments';
export async function manageDonation(form:FormData){const id=String(form.get('checkout_id')??'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/donations');const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');const admin=paymentAdmin();const {data}=await admin.from('donation_checkouts').select('stripe_customer_id,frequency').eq('id',id).eq('donor_user_id',user.id).maybeSingle();if(!data||data.frequency!=='monthly'||!data.stripe_customer_id)redirect('/donations');let url:string|undefined;try{const portal=await stripeServer().billingPortal.sessions.create({customer:data.stripe_customer_id,return_url:`${siteOrigin()}/donations`});url=portal.url;}catch{redirect('/donations?portal_error=1');}if(!url)redirect('/donations?portal_error=1');redirect(url);}
