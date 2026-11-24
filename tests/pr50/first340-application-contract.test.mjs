import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { first340PhoneE164, validateFirst340 } from '../../lib/first340-validation.ts';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261123090000_pr50_first340_application_lifecycle.sql');
const valid = {
  motivation: 'I want to help local communities coordinate measurable climate action.',
  country: 'Netherlands', languages: ['Dutch','English'], skills: ['organizing','research'],
  expertise: 'Community programs', relevant_experience: 'Five years organizing local projects.',
  availability: 'Two evenings per week', preferred_role: 'Community coordinator',
  travel_availability: 'Within the country', additional_information: 'I can start next month.',
  contact_email: 'applicant@example.org', phone_number: '020 7946 0018', phone_country_code: 'GB',
};

test('a complete application validates and international phone is normalized to E.164', () => {
  assert.deepEqual(validateFirst340(valid,{requireAll:true}),{});
  assert.equal(first340PhoneE164(valid.phone_number,valid.phone_country_code),'+442079460018');
});

test('every submitted answer is required; incomplete drafts remain saveable', () => {
  for (const key of ['motivation','country','languages','skills','expertise','relevant_experience','availability','preferred_role','travel_availability','additional_information','contact_email','phone_number']) {
    const copy = {...valid,[key]:Array.isArray(valid[key])?[]:''};
    assert.ok(validateFirst340(copy,{requireAll:true})[key],key);
    assert.equal(validateFirst340(copy,{requireAll:false})[key],undefined,key);
  }
  assert.equal(validateFirst340({...valid,expertise:'   '},{requireAll:true}).expertise,'This field is required.');
  assert.ok(validateFirst340({...valid,contact_email:'invalid'},{requireAll:true}).contact_email);
});

test('invalid phone numbers and mismatched selected countries are rejected', () => {
  assert.equal(first340PhoneE164('12345','US'),null);
  assert.equal(first340PhoneE164('+442079460018','US'),null);
});

test('application versions preserve history and prevent concurrent active versions', () => {
  assert.match(migration,/add column if not exists application_version integer not null default 1/i);
  assert.match(migration,/first340_applications_profile_version_uidx/);
  assert.match(migration,/first340_applications_one_active_per_profile_uidx[\s\S]*where status <> 'withdrawn'/);
  assert.match(migration,/create or replace function public\.reapply_first340_application\(\)[\s\S]*where a\.profile_id=v_profile and a\.status='withdrawn'[\s\S]*insert into public\.first340_applications/i);
  assert.doesNotMatch(migration,/delete from public\.first340_applications/i);
});

test('submission is checked in the database and contact data is stored per application', () => {
  for (const name of ['motivation','country','languages','skills','expertise','relevant_experience','availability','preferred_role','travel_availability','additional_information','contact_email','phone_e164','phone_country_code']) {
    assert.match(migration,new RegExp(`a\\.${name}`),name);
  }
  assert.match(migration,/lower\(btrim\(a\.contact_email\)\)/);
  assert.match(migration,/phone_e164 ~ '\^\\\+\[1-9\]/);
  assert.match(migration,/pr50_first340_supported_phone_country\(p_code text\)[\s\S]*'US'[\s\S]*not public\.pr50_first340_supported_phone_country\(a\.phone_country_code\)/);
});

test('only Super Admin can review or enumerate applicants and candidate activity', () => {
  assert.match(migration,/Read own or super admin applications[\s\S]*public\.is_aluna_super_admin\(\)/);
  assert.match(migration,/public\.admin_first340_decision[\s\S]*not public\.is_aluna_super_admin\(\)/);
  assert.match(migration,/public\.first340_candidate_activity[\s\S]*not public\.is_aluna_super_admin\(\)/);
  assert.match(migration,/public\.first340_candidate_breakdown[\s\S]*not public\.is_aluna_super_admin\(\)/);
  assert.match(migration,/public\.first340_admin_application_page[\s\S]*not public\.is_aluna_super_admin\(\)/);
  assert.match(migration,/count\(\*\) over\(\)/);
  assert.match(read('app/(app)/first-340/admin/page.tsx'),/redirect\('\/aluna-admin\/first-340'\)/);
});

test('application and dossier screens expose drafts, reapplication and version-specific contact details', () => {
  assert.match(read('app/(app)/first-340/page.tsx'),/reapplyFirst340/);
  assert.match(read('app/(app)/first-340/apply/page.tsx'),/Submit application/);
  assert.match(read('app/(app)/aluna-admin/first-340/[profileId]/page.tsx'),/application_version/);
  assert.match(read('app/(app)/aluna-admin/first-340/[profileId]/page.tsx'),/phone_e164/);
  assert.match(read('app/(app)/aluna-admin/first-340/[profileId]/page.tsx'),/first340_audit/);
});
