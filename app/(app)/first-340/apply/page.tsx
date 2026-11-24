import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { First340PhoneField } from '@/components/first340-phone-field';
import { saveFirst340Application } from '../actions';

const fieldClass = 'mt-2 w-full rounded-xl border border-line bg-panel-raised p-3';
type FieldName = 'motivation'|'country'|'languages'|'skills'|'expertise'|'relevant_experience'|'availability'|'preferred_role'|'travel_availability'|'additional_information'|'contact_email';

function RequiredField({name,label,error,children}:{name:FieldName;label:string;error?:string;children:React.ReactNode}) {
  const id = `first340_${name}`;
  return <label className="block text-sm" htmlFor={id}>
    {label} <span aria-hidden="true" className="text-gold">*</span>
    {children}
    {error && <span id={`${id}_error`} role="alert" className="mt-1 block text-sm text-red-300">{error}</span>}
  </label>;
}

export default async function Apply({searchParams}:{searchParams:Promise<{error?:string;fields?:string}>}) {
  const params = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: application, error: readError } = await client.from('first340_applications')
    .select('*').eq('profile_id', user.id).eq('status', 'draft').maybeSingle();
  if (readError || !application) redirect('/first-340');
  const invalid = new Set((params.fields ?? '').split(',').filter(Boolean));
  const messageFor = (name: string) => invalid.has(name)
    ? name === 'motivation' ? 'Enter at least 10 characters.' :
      name === 'contact_email' ? 'Enter a valid contact email address.' :
      name === 'phone_number' ? 'Enter a valid phone number.' :
      name === 'phone_country_code' ? 'Select a supported country.' :
      `Complete the ${name.replaceAll('_',' ')} field.`
    : undefined;
  const input = (name: FieldName, value: string, options: { multiline?: boolean; rows?: number } = {}) => {
    const id = `first340_${name}`;
    const error = messageFor(name);
    const props = { id, name, required: true, defaultValue: value, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}_error` : undefined, className: fieldClass };
    return options.multiline
      ? <textarea {...props} rows={options.rows ?? 3} />
      : <input {...props} />;
  };
  return <div className="space-y-5">
    <Link href="/first-340" className="text-sm text-gold">← The First 340</Link>
    <Card title="Apply for The First 340">
      <p className="mb-5 text-sm text-muted">Every field marked <span className="text-gold">*</span> is required before submission. You can save an incomplete draft and finish it later.</p>
      {params.error === 'validation' && <p role="alert" className="mb-4 rounded-xl border border-red-700 p-3 text-sm text-red-300">Please review the fields marked below.</p>}
      {params.error === 'submit' && <p role="alert" className="mb-4 rounded-xl border border-red-700 p-3 text-sm text-red-300">The application could not be submitted. Review all required fields and try again.</p>}
      {params.error === 'save' && <p role="alert" className="mb-4 rounded-xl border border-red-700 p-3 text-sm text-red-300">The draft could not be saved. Please try again.</p>}
      <form action={saveFirst340Application} className="max-w-2xl space-y-4">
        <RequiredField name="motivation" label="Motivation" error={messageFor('motivation')}>{input('motivation', application.motivation ?? '', { multiline: true, rows: 4 })}</RequiredField>
        <RequiredField name="country" label="Country" error={messageFor('country')}>{input('country', application.country ?? '')}</RequiredField>
        <RequiredField name="languages" label="Languages" error={messageFor('languages')}>{input('languages', application.languages?.join(', ') ?? '')}<span className="mt-1 block text-xs text-muted">Separate multiple languages with commas.</span></RequiredField>
        <RequiredField name="skills" label="Skills" error={messageFor('skills')}>{input('skills', application.skills?.join(', ') ?? '')}<span className="mt-1 block text-xs text-muted">Separate multiple skills with commas.</span></RequiredField>
        <RequiredField name="expertise" label="Expertise" error={messageFor('expertise')}>{input('expertise', application.expertise ?? '', { multiline: true })}</RequiredField>
        <RequiredField name="relevant_experience" label="Relevant Experience" error={messageFor('relevant_experience')}>{input('relevant_experience', application.relevant_experience ?? '', { multiline: true })}</RequiredField>
        <RequiredField name="availability" label="Availability" error={messageFor('availability')}>{input('availability', application.availability ?? '')}</RequiredField>
        <RequiredField name="preferred_role" label="Preferred Role" error={messageFor('preferred_role')}>{input('preferred_role', application.preferred_role ?? '')}</RequiredField>
        <RequiredField name="travel_availability" label="Travel Availability" error={messageFor('travel_availability')}>{input('travel_availability', application.travel_availability ?? '')}</RequiredField>
        <RequiredField name="additional_information" label="Additional Information" error={messageFor('additional_information')}>{input('additional_information', application.additional_information ?? '', { multiline: true, rows: 4 })}</RequiredField>
        <RequiredField name="contact_email" label="Contact Email" error={messageFor('contact_email')}>{<input id="first340_contact_email" name="contact_email" type="email" autoComplete="email" required defaultValue={application.contact_email ?? user.email ?? ''} aria-invalid={!!messageFor('contact_email')} aria-describedby={messageFor('contact_email') ? 'first340_contact_email_error' : undefined} className={fieldClass}/>}</RequiredField>
        <First340PhoneField initialE164={application.phone_e164 ?? ''} initialCountry={application.phone_country_code ?? ''}
          phoneError={messageFor('phone_number')} countryError={invalid.has('phone_country_code') ? 'Select a supported country.' : undefined} />
        <div className="flex flex-wrap gap-3 pt-2">
          <button name="intent" value="draft" formNoValidate className="rounded-xl border border-line px-5 py-3 font-semibold text-gold">Save draft</button>
          <button name="intent" value="submit" className="rounded-xl bg-gold px-5 py-3 font-semibold text-navy">Submit application</button>
        </div>
      </form>
    </Card>
  </div>;
}
