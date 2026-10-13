import { createFormsHandler } from "./gateway.mjs";
const env = (name: string) => Deno.env.get(name) || "",
  list = (name: string) =>
    env(name)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
// Dedicated default-off Forms gateway. No configuration/deployment occurs in GIV-2C BUILD.
Deno.serve(
  createFormsHandler({
    url: env("SUPABASE_URL"),
    serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    pepper: env("FORMS_NETWORK_PEPPER"),
    turnstileSecret: env("FORMS_TURNSTILE_SECRET"),
    origins: list("FORMS_ALLOWED_ORIGINS"),
    hostnames: list("FORMS_TURNSTILE_HOSTNAMES"),
    mode: env("FORMS_MODE"),
  }),
);
