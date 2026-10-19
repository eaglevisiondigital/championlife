import {createGivingWebhook} from './gateway.mjs';
import {NMI_GIVING_ACCEPTANCE_PIN} from '../_shared/payments/acceptance-pin.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
Deno.serve(createGivingWebhook({acceptance_pin:NMI_GIVING_ACCEPTANCE_PIN,project:env('SUPABASE_URL'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),enabled:env('NMI_GIVING_SANDBOX_WEBHOOK_ENABLED')==='true'},fetch,env));
