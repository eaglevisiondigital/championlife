import { createFileHandler } from "./gateway.mjs";
const env = (name: string) => Deno.env.get(name) || "";
Deno.serve(
  createFileHandler({
    url: env("SUPABASE_URL"),
    serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    publicKey: env("SUPABASE_ANON_KEY"),
    origins: env("FORMS_ALLOWED_ORIGINS")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  }),
);
