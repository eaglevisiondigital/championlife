import { createNmiWebhook } from "./gateway.mjs";
const env = (k: string) => Deno.env.get(k) || "";
Deno.serve(
  createNmiWebhook(
    {
      project: env("SUPABASE_URL"),
      enabled: env("NMI_SANDBOX_WEBHOOK_ENABLED") === "true",
      serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
      organization_id: env("NMI_SANDBOX_ORGANIZATION_ID"),
      gateway_id: env("NMI_SANDBOX_GATEWAY_ID"),
      merchant_reference: env("NMI_SANDBOX_MERCHANT_REFERENCE"),
    },
    env,
  ),
);
