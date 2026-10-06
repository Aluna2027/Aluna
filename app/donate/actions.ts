'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { amountMinor, paymentAdmin, siteOrigin, stripeServer, type CheckoutRecord, reportPaymentError } from '@/lib/payments';
import { isReferralSource } from '@/lib/referrals';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function startDonation(form:FormData){
 const campaignId=String(form.get('campaign_id')??''),fundraiserId=String(form.get('fundraiser_id')??'')||null,requestKey=String(form.get('request_key')??'');
 if(!uuid.test(campaignId)||!uuid.test(requestKey)||fundraiserId&&!uuid.test(fundraiserId))redirect('/fundraising');
 const admin=paymentAdmin();const {data:campaign}=await admin.from('fundraising_campaigns').select('id,mission_id,title,currency_code').eq('id',campaignId).is('removed_at',null).is('archived_at',null).maybeSingle();if(!campaign)redirect('/fundraising');
 const returnPath=fundraiserId?`/f/${fundraiserId}`:`/c/${campaignId}`;
 const fail=()=>`/c/${campaignId}?donation_error=1`;
 const {data:fundraiser}=fundraiserId?await admin.from('fundraisers').select('id,slug,campaign_id').eq('id',fundraiserId).maybeSingle():{data:null};
 if(fundraiserId&&(!fundraiser||fundraiser.campaign_id!==campaignId))redirect(fail());
 const back=fundraiser?`/f/${fundraiser.slug}`:returnPath;
 let amount:number;try{amount=amountMinor(String(form.get('amount_choice')??''),String(form.get('custom_amount')??'').trim());}catch{redirect(`${back}?donation_error=amount`);}
 const frequency=String(form.get('frequency')??''),kind=String(form.get('donation_kind')??''),donorKind=String(form.get('donor_kind')??'');const companyName=String(form.get('company_name')??'').trim(),anonymous=form.has('anonymous');
 if(!['once','monthly'].includes(frequency)||!['standard','sponsorship'].includes(kind)||!['individual','company'].includes(donorKind)||kind==='sponsorship'&&amount<10000||donorKind==='company'&&(companyName.length<2||companyName.length>180))redirect(`${back}?donation_error=details`);
 if(!['EUR','USD','GBP'].includes(campaign.currency_code))redirect(`${back}?donation_error=currency`);
 const {data:mission}=await admin.from('missions').select('title').eq('id',campaign.mission_id).single();if(!mission)redirect(`${back}?donation_error=mission`);
 const referral=(await cookies()).get('aluna_referral')?.value??'';const parts=referral.split('.');let referralId:string|null=null,campaignReferralId:string|null=null,referralSource:string|null=null;
 if(parts.length===2){const [token,source]=parts;if(/^[a-f0-9]{32}$/.test(token)&&isReferralSource(source)){const {data:link}=await admin.from('fundraiser_referral_links').select('id,fundraisers!inner(campaign_id)').eq('token',token).maybeSingle();if(link&&(link.fundraisers as unknown as {campaign_id:string})?.campaign_id===campaignId){referralId=link.id;referralSource=source;}}}
 if(parts.length===3&&parts[0]==='campaign'){const [,token,source]=parts;if(/^[a-f0-9]{32}$/.test(token)&&isReferralSource(source)){const {data:link}=await admin.from('campaign_referral_links').select('id,campaign_id,is_active').eq('token',token).maybeSingle();if(link&&link.campaign_id===campaignId&&link.is_active){campaignReferralId=link.id;referralSource=source;}}}
 const userClient=await createClient();const {data:{user}}=await userClient.auth.getUser();
 if(frequency==='monthly'&&!user)redirect(`/login?next=${encodeURIComponent(back)}`);
 const expected={campaign_id:campaignId,fundraiser_id:fundraiserId,amount_minor:amount,currency_code:campaign.currency_code,frequency,donation_kind:kind,donor_kind:donorKind,company_name:donorKind==='company'?companyName:null,anonymous,referral_link_id:referralId,campaign_referral_link_id:campaignReferralId,referral_source:referralSource,donor_user_id:user?.id??null};
 const {error:insertError}=await admin.from('donation_checkouts').insert({...expected,request_key:requestKey});
 if(insertError&&insertError.code!=='23505'){reportPaymentError(insertError);redirect(`${back}?donation_error=unavailable`);}
 const {data:checkout,error:lookupError}=await admin.from('donation_checkouts').select('*').eq('request_key',requestKey).single();if(lookupError||!checkout){reportPaymentError(lookupError);redirect(`${back}?donation_error=unavailable`);}
 const record=checkout as CheckoutRecord;
 if(Object.entries(expected).some(([key,value])=>JSON.stringify(checkout[key])!==JSON.stringify(value))){redirect(`${back}?donation_error=retry`);}
 if(record.stripe_session_id){const stripe=stripeServer();try{const session=await stripe.checkout.sessions.retrieve(record.stripe_session_id);if(session.status==='open'&&session.url)redirect(session.url);if(session.payment_status==='paid')redirect(`${siteOrigin()}/donate/thank-you?session_id=${encodeURIComponent(session.id)}`);}catch(error){if(error&&typeof error==='object'&&'digest' in error)throw error;reportPaymentError(error);}redirect(`${back}?donation_error=retry`);}
 if(Date.now()-Date.parse(record.created_at)>60*60*1000)redirect(`${back}?donation_error=retry`);
 const stripe=stripeServer();const origin=siteOrigin();const sessionParams:Stripe.Checkout.SessionCreateParams={mode:frequency==='monthly'?'subscription':'payment',payment_method_types:['card'],line_items:[{price_data:{currency:campaign.currency_code.toLowerCase(),unit_amount:amount,product_data:{name:`Support ${mission.title.slice(0,120)}`},...(frequency==='monthly'?{recurring:{interval:'month' as const}}:{})},quantity:1}],success_url:`${origin}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}${back}?donation=cancelled`,client_reference_id:record.id,metadata:{checkout_id:record.id},billing_address_collection:donorKind==='company'?'required':'auto',name_collection:donorKind==='company'?{business:{enabled:true,optional:false}}:{individual:{enabled:true,optional:false}},...(frequency==='once'?{customer_creation:'always' as const,invoice_creation:{enabled:true},payment_intent_data:{metadata:{checkout_id:record.id}},submit_type:'donate' as const}:{subscription_data:{metadata:{checkout_id:record.id}},submit_type:'subscribe' as const})};
 let session:Stripe.Checkout.Session;try{session=await stripe.checkout.sessions.create(sessionParams,{idempotencyKey:`aluna-donation-${record.id}`});}catch(error){reportPaymentError(error);redirect(`${back}?donation_error=unavailable`);}
 if(!session.url)redirect(`${back}?donation_error=unavailable`);
 const {error:saveError}=await admin.from('donation_checkouts').update({stripe_session_id:session.id,stripe_session_url:session.url,status:'checkout',updated_at:new Date().toISOString()}).eq('id',record.id).eq('status','pending');
 if(saveError){reportPaymentError(saveError);redirect(`${back}?donation_error=unavailable`);}
 redirect(session.url);
}
