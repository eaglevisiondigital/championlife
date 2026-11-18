import {createWorkerHandler} from './worker.mjs';
Deno.serve(createWorkerHandler({
 mode:Deno.env.get('P1_NOTICE_DELIVERY_MODE'),
 environment:Deno.env.get('P1_NOTICE_ENVIRONMENT'),providerAccount:Deno.env.get('P1_NOTICE_PROVIDER_ACCOUNT'),
 invokeSecret:Deno.env.get('P1_NOTICE_WORKER_SECRET'),resendKey:Deno.env.get('P1_NOTICE_RESEND_API_KEY'),
 reconciliationMode:Deno.env.get('P1_NOTICE_RECONCILIATION_MODE'),providerReadKey:Deno.env.get('P1_NOTICE_PROVIDER_READ_KEY'),
 url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}));
