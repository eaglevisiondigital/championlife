import {createInterestHandler} from './gateway.mjs';
const env=(name:string)=>Deno.env.get(name)||'',list=(name:string)=>env(name).split(',').map(v=>v.trim()).filter(Boolean);
// Dedicated configuration. Nothing is enabled/deployed by this candidate.
Deno.serve(createInterestHandler({url:env('SUPABASE_URL'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),pepper:env('OUTREACH_NETWORK_PEPPER'),turnstileSecret:env('OUTREACH_TURNSTILE_SECRET'),origins:list('OUTREACH_ALLOWED_ORIGINS'),hostnames:list('OUTREACH_TURNSTILE_HOSTNAMES'),action:env('OUTREACH_INTEREST_TURNSTILE_ACTION'),mode:env('OUTREACH_MODE')}));
