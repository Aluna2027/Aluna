'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAlunaSuperAdmin } from '@/lib/aluna-admin';
import { createClient } from '@/lib/supabase/server';
import { first340DatabaseFields, first340Values, validateFirst340 } from '@/lib/first340-validation';

const applyPath = '/first-340/apply';

function validationUrl(errors: Record<string, string>) {
  return `${applyPath}?error=validation&fields=${encodeURIComponent(Object.keys(errors).join(','))}`;
}

export async function startFirst340() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: id, error } = await client.rpc('start_first340_application');
  if (error || !id) redirect('/first-340?error=start');
  revalidatePath('/first-340');
  redirect(applyPath);
}

export async function reapplyFirst340() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: id, error } = await client.rpc('reapply_first340_application');
  if (error || !id) redirect('/first-340?error=reapply');
  revalidatePath('/first-340');
  redirect(applyPath);
}

export async function saveFirst340Application(form: FormData) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');

  const values = first340Values(form);
  const intent = String(form.get('intent') ?? 'draft');
  const errors = validateFirst340(values, { requireAll: intent === 'submit' });
  if (Object.keys(errors).length) redirect(validationUrl(errors));

  const { data: existing, error: readError } = await client.from('first340_applications')
    .select('id').eq('profile_id', user.id).eq('status', 'draft').maybeSingle();
  if (readError) redirect('/first-340?error=save');
  const fields = first340DatabaseFields(values);
  const result = existing
    ? await client.from('first340_applications').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('profile_id', user.id)
    : { error: new Error('Draft unavailable') };
  if (result.error) redirect('/first-340/apply?error=save');

  revalidatePath('/first-340');
  revalidatePath('/first-340/apply');
  if (intent !== 'submit') redirect('/first-340?status=saved');
  if (!existing) redirect('/first-340/apply?error=save');

  const { error: submitError } = await client.rpc('submit_first340_application', { p_id: existing.id });
  if (submitError) redirect('/first-340/apply?error=submit');
  revalidatePath('/first-340');
  redirect('/first-340?status=submitted');
}

export async function withdrawFirst340() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: application, error: readError } = await client.from('first340_applications')
    .select('id').eq('profile_id', user.id).neq('status', 'withdrawn')
    .order('application_version', { ascending: false }).limit(1).maybeSingle();
  if (readError || !application) redirect('/first-340?error=withdraw');
  const { error } = await client.rpc('withdraw_first340_application', { p_id: application.id });
  if (error) redirect('/first-340?error=withdraw');
  revalidatePath('/first-340');
  redirect('/first-340?status=withdrawn');
}

export async function decideFirst340(form: FormData) {
  const { client } = await requireAlunaSuperAdmin();
  const { error } = await client.rpc('admin_first340_decision', {
    p_id: String(form.get('id') ?? ''),
    p_status: String(form.get('status') ?? ''),
    p_team: String(form.get('team_id') ?? '') || null,
    p_note: String(form.get('note') ?? ''),
  });
  if (error) redirect('/aluna-admin/first-340?error=decision');
  revalidatePath('/aluna-admin/first-340');
  revalidatePath('/first-340/admin');
  redirect('/aluna-admin/first-340?status=saved');
}
