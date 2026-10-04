import { createHandler } from './gateway.mjs';
const env = (name: string) => Deno.env.get(name) || '';
const list = (name: string) => env(name).split(',').map(v => v.trim()).filter(Boolean);
Deno.serve(createHandler({
  url: env('SUPABASE_URL'), serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  pepper: env('OUTREACH_NETWORK_PEPPER'), turnstileSecret: env('OUTREACH_TURNSTILE_SECRET'),
  origins: list('OUTREACH_ALLOWED_ORIGINS'), hostnames: list('OUTREACH_TURNSTILE_HOSTNAMES'),
  action: env('OUTREACH_TURNSTILE_ACTION'), mode: env('OUTREACH_MODE')
}));
