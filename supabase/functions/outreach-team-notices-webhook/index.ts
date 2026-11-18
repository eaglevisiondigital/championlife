import {createWebhookHandler} from './webhook.mjs';
// Future webhook deployment requires JWT verification off and raw Svix verification on.
// This source file alone creates no webhook, secret or deployed endpoint.
Deno.serve(createWebhookHandler({
 environment:Deno.env.get('P1_NOTICE_ENVIRONMENT'),providerAccount:Deno.env.get('P1_NOTICE_PROVIDER_ACCOUNT'),
 webhookSecret:Deno.env.get('P1_NOTICE_WEBHOOK_SECRET'),
 url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}));
