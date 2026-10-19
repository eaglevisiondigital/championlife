// Undeployed GIV-3A boundary. No real provider verifier/transport is installed.
import { providerContract } from "../_shared/payments/providers.mjs";
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  // Do not parse/log/persist unauthenticated raw payment payloads while the stage is held.
  const verification = await providerContract("future").verify_webhook({});
  if (!verification.verified)
    return new Response(
      JSON.stringify({
        accepted: false,
        error: "Provider webhook verification is not configured.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  return new Response(null, { status: 403 });
});
