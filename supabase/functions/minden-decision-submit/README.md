# Protected Minden decision gateway — disabled source candidate

This function is not deployed. Deployment and activation require separate owner approval after genuine isolated acceptance.

Required server values: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MINDEN_DECISION_NETWORK_PEPPER` (at least 32 characters), `MINDEN_DECISION_TURNSTILE_SECRET`, `MINDEN_DECISION_MODE`, `MINDEN_DECISION_ORIGIN`; acceptance additionally requires `MINDEN_DECISION_ACCEPTANCE_PROJECT` equal to the explicit nonproduction project ref. Never paste secrets into chat, source or browser configuration.

Production mode `live` is bound to production `exdocjbmylgxssanymjk` and `https://championlifefwb.com`. Acceptance mode rejects that backend and requires an explicit isolated HTTPS or loopback origin. No default mode/origin activates anything. A provider deployment would use `verify_jwt=false` for this public challenge-protected intake; the service RPC itself is unavailable to anonymous/authenticated clients. Verify this exact setting, current forwarded `cf-connecting-ip` ingress contract and real action/hostname using hosted acceptance before release. This is not a deployment command.

Client configuration remains `enabled:false`. Both independent database flags, an explicitly approved immutable current bilingual policy and exact canonical source map must also exist before intake/book rights can activate. They are not seeded by the installer. This function cannot access Resend, Auth OTP or notification workers. Do not repurpose P0 receipt keys or change P0 secrets.

Vendor references checked November 18: [Cloudflare server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) and [Supabase Edge Auth headers](https://supabase.com/docs/guides/functions/auth-headers). Token re-verification idempotency is not application submission dedupe; the database also records a unique proof-spend digest. A completed recognized SQL rejection is rolled back; an ambiguous persistence response returns UNKNOWN and must be reconciled.
