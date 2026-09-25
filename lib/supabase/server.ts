import { createServerClient, type CookieOptions } from '@supabase/ssr';
type CookieUpdate = { name: string; value: string; options: CookieOptions };
import { cookies } from 'next/headers';
import { supabaseConfig } from './config';

export async function createClient() {
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items: CookieUpdate[]) => {
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; middleware refreshes them. */ }
      },
    },
  });
}
