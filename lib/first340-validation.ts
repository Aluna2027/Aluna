import { getCountries, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export const first340RequiredFields = [
  'motivation', 'country', 'languages', 'skills', 'expertise', 'relevant_experience',
  'availability', 'preferred_role', 'travel_availability', 'additional_information',
  'contact_email', 'phone_number', 'phone_country_code',
] as const;

export type First340Field = typeof first340RequiredFields[number];

export type First340FormValues = {
  motivation: string;
  country: string;
  languages: string[];
  skills: string[];
  expertise: string;
  relevant_experience: string;
  availability: string;
  preferred_role: string;
  travel_availability: string;
  additional_information: string;
  contact_email: string;
  phone_number: string;
  phone_country_code: string;
};

const textFields = [
  'motivation', 'country', 'expertise', 'relevant_experience', 'availability',
  'preferred_role', 'travel_availability', 'additional_information',
] as const;

const maxLengths: Record<(typeof textFields)[number], number> = {
  motivation: 5000, country: 120, expertise: 3000, relevant_experience: 5000,
  availability: 1000, preferred_role: 500, travel_availability: 1000,
  additional_information: 5000,
};

function field(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function first340Values(form: FormData): First340FormValues {
  return {
    motivation: field(form, 'motivation'),
    country: field(form, 'country'),
    languages: splitList(field(form, 'languages')),
    skills: splitList(field(form, 'skills')),
    expertise: field(form, 'expertise'),
    relevant_experience: field(form, 'relevant_experience'),
    availability: field(form, 'availability'),
    preferred_role: field(form, 'preferred_role'),
    travel_availability: field(form, 'travel_availability'),
    additional_information: field(form, 'additional_information'),
    contact_email: field(form, 'contact_email').toLowerCase(),
    phone_number: field(form, 'phone_number'),
    phone_country_code: field(form, 'phone_country_code').toUpperCase(),
  };
}

export function first340PhoneE164(phone: string, countryCode: string) {
  if (!phone.trim()) return null;
  if (!getCountries().includes(countryCode.toUpperCase() as CountryCode)) return null;
  const parsed = parsePhoneNumberFromString(phone, countryCode.toUpperCase() as CountryCode);
  if (!parsed?.isValid()) return null;
  if (parsed.country && parsed.country !== countryCode.toUpperCase()) return null;
  return parsed.number;
}

export function validateFirst340(values: First340FormValues, { requireAll }: { requireAll: boolean }) {
  const errors: Partial<Record<First340Field, string>> = {};
  const add = (key: First340Field, message: string) => { errors[key] = message; };
  if (values.motivation.length > maxLengths.motivation) add('motivation', 'Use no more than 5,000 characters.');
  else if (requireAll && values.motivation.trim().length < 10) add('motivation', 'Enter at least 10 characters.');
  if (values.country.length > maxLengths.country) add('country', 'Use no more than 120 characters.');
  else if (requireAll && !values.country.trim()) add('country', 'Enter your country.');
  if (requireAll && !values.languages.some((language) => language.trim())) add('languages', 'Enter at least one language.');
  if (requireAll && !values.skills.some((skill) => skill.trim())) add('skills', 'Enter at least one skill.');
  for (const key of textFields) {
    if (values[key].length > maxLengths[key]) add(key, `Use no more than ${maxLengths[key].toLocaleString('en')} characters.`);
    else if (requireAll && key !== 'motivation' && key !== 'country' && !values[key].trim()) add(key, 'This field is required.');
  }
  if (values.contact_email.length > 320 || (values.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact_email))) {
    add('contact_email', 'Enter a valid contact email address.');
  } else if (requireAll && !values.contact_email.trim()) add('contact_email', 'Enter a contact email address.');
  const phone = first340PhoneE164(values.phone_number, values.phone_country_code);
  if (values.phone_number && !phone) add('phone_number', 'Enter a valid number for the selected country.');
  else if (requireAll && !phone) add('phone_number', 'Enter a valid phone number and select its country.');
  if (!values.phone_country_code || !getCountries().includes(values.phone_country_code as CountryCode)) {
    if (requireAll || values.phone_number) add('phone_country_code', 'Select a supported country.');
  }
  return errors;
}

export function first340DatabaseFields(values: First340FormValues) {
  return {
    motivation: values.motivation,
    country: values.country,
    languages: values.languages,
    skills: values.skills,
    expertise: values.expertise,
    relevant_experience: values.relevant_experience,
    availability: values.availability,
    preferred_role: values.preferred_role,
    travel_availability: values.travel_availability,
    additional_information: values.additional_information,
    contact_email: values.contact_email || null,
    phone_e164: first340PhoneE164(values.phone_number, values.phone_country_code),
    phone_country_code: values.phone_country_code || null,
  };
}
