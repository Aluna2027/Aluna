'use client';

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { useMemo } from 'react';

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function First340PhoneField({ initialE164 = '', initialCountry = '', phoneError, countryError }:
  { initialE164?: string; initialCountry?: string; phoneError?: string; countryError?: string }) {
  const initial = useMemo(() => {
    const parsed = initialE164 ? parsePhoneNumberFromString(initialE164) : undefined;
    return { country: (initialCountry || parsed?.country || 'US') as CountryCode, national: parsed?.nationalNumber || initialE164 };
  }, [initialE164, initialCountry]);
  const countries = useMemo(() => getCountries().map((country) => ({
    code: country,
    label: displayNames.of(country) || country,
    dial: getCountryCallingCode(country),
  })).sort((a, b) => a.label.localeCompare(b.label)), []);

  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
    <label className="block text-sm" htmlFor="phone_country_code">Phone country <span aria-hidden="true" className="text-gold">*</span>
      <select id="phone_country_code" name="phone_country_code" required defaultValue={initial.country}
        aria-invalid={!!countryError} aria-describedby={countryError ? 'phone_country_error' : 'phone_help'}
        className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3">
        {countries.map((country) => <option key={country.code} value={country.code}>{country.label} (+{country.dial})</option>)}
      </select>
      <span id="phone_help" className="mt-1 block text-xs text-muted">Type a country name while the list is open to find it quickly.</span>
      {countryError && <span id="phone_country_error" role="alert" className="mt-1 block text-sm text-red-300">{countryError}</span>}
    </label>
    <label className="block text-sm" htmlFor="phone_number">International phone number <span aria-hidden="true" className="text-gold">*</span>
      <input id="phone_number" name="phone_number" type="tel" inputMode="tel" autoComplete="tel-national"
        required defaultValue={initial.national} aria-invalid={!!phoneError}
        aria-describedby={phoneError ? 'phone_error' : undefined}
        className="mt-2 w-full rounded-xl border border-line bg-panel-raised p-3"/>
      {phoneError && <span id="phone_error" role="alert" className="mt-1 block text-sm text-red-300">{phoneError}</span>}
    </label>
  </div>;
}
