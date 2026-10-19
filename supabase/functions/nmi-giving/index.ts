import {createGivingHandler} from './gateway.mjs';
import {NMI_GIVING_ACCEPTANCE_PIN} from '../_shared/payments/acceptance-pin.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
Deno.serve(createGivingHandler({acceptance_pin:NMI_GIVING_ACCEPTANCE_PIN,project:env('SUPABASE_URL'),publicKey:env('SUPABASE_ANON_KEY'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),enabled:env('NMI_GIVING_SANDBOX_ENABLED')==='true',recoveryEnabled:env('NMI_GIVING_SANDBOX_RECOVERY_ENABLED')==='true',origins:env('NMI_GIVING_ALLOWED_ORIGINS').split(',').filter(Boolean),turnstileSecret:env('NMI_GIVING_TURNSTILE_SECRET'),pepper:env('NMI_GIVING_NETWORK_PEPPER')},fetch,env));
