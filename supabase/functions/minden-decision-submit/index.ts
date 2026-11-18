import {createDecisionHandler} from './gateway.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
Deno.serve(createDecisionHandler({url:env('SUPABASE_URL'),serviceKey:env('SUPABASE_SERVICE_ROLE_KEY'),pepper:env('MINDEN_DECISION_NETWORK_PEPPER'),turnstileSecret:env('MINDEN_DECISION_TURNSTILE_SECRET'),mode:env('MINDEN_DECISION_MODE'),origin:env('MINDEN_DECISION_ORIGIN'),acceptanceProject:env('MINDEN_DECISION_ACCEPTANCE_PROJECT')}));
