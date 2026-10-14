import { createNmiHandler } from "./gateway.mjs";
const env = (name: string) => Deno.env.get(name) || "";
Deno.serve(
  createNmiHandler(
    {
      project: env("SUPABASE_URL"),
      publicKey: env("SUPABASE_ANON_KEY"),
      serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
      enabled: env("NMI_SANDBOX_EXECUTION_ENABLED") === "true",
      origins: env("NMI_SANDBOX_ALLOWED_ORIGINS").split(",").filter(Boolean),
    },
    fetch,
    env,
  ),
);
