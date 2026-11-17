import {createVolunteerHandler} from './gateway.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
Deno.serve(createVolunteerHandler({url:env('SUPABASE_URL'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),pepper:env('OUTREACH_NETWORK_PEPPER'),turnstileSecret:env('OUTREACH_TURNSTILE_SECRET'),resendKey:env('MINDEN_RESEND_API_KEY'),enabled:env('MINDEN_VOLUNTEER_MODE')==='live'}));
