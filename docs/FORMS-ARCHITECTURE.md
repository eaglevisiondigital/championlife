# Kingdom Propel Forms architecture

GIV-2C is a reusable platform capability, consumed by Champion Life. It starts at accepted GIV-2B `13aecea202dc0378f25c1c8df6650b22a0329923`. Build scope only: no hosted migration, public activation, real processor, communications delivery or existing-form migration.

## Canonical model

Organization → Form → Version → Section / Field / Condition / Payment configuration → Published instance → Submission → Typed answers / Consent / Signature / File references. A draft has a monotonically increasing revision. Save requires the expected revision. Publishing validates and freezes the definition and normalized child records; later editing creates a fresh draft. Stable keys identify fields independently of labels. Historical answers retain the published field ID, key, label and original submitted value alongside typed columns.

The builder edits one shared definition, with desktop columns/widths and mobile stacking. Sections carry a future step/page key; no parallel mobile schema. Local undo/redo affects the draft only. Live preview never invokes submission APIs. Conditions are a validated acyclic dependency graph; the server derives hidden, required and disabled state and rejects unknown/hidden/readonly answers. Plain text content only; no executable HTML, URLs or custom regex from staff. Safe patterns are named presets.

## Authority and public boundary

Distinct Forms permissions are additive to the existing registry. Organization grants use current active staff permissions and verified identity. Explicit form/campaign scoped grants are separate, expire and never confer finance configuration. Raw tables/helpers are denied to public roles with RLS as defense in depth. Every workspace operation checks current permissions and tenant scope. Version IDs, submission IDs, funds, canonical People and households are checked against the owning organization.

Anonymous callers can fetch only an active public published instance, never drafts or admin lists. Submission/file reservation runs through the service-only gateway, with exact trusted origins, Turnstile and bounded independent rate limits. Gateway deployment/configuration is a future hosted gate; defaults fail closed. No wildcard origins. Uploads use a private bucket and signed short-lived authorization; configured public file visibility is an explicit field setting, not a public bucket.

## Giving, People, Events and Communications

Payment configuration references canonical funds, allowed subsets and explicit merchant overrides. Funds are not copied into Forms. Integer minor units are authoritative. A payment-enabled submission creates one pending canonical Giving Session/lines/legs; no ledger entry, payment outcome or receipt is fabricated. Classification is donation/event fee/registration fee/deposit/purchase; non-donations must not acquire tax eligibility. Recurring preferences remain held descriptors. Pledges reference the canonical pledge model after explicit reviewed identity linkage. Unmatched submissions do not create or merge People, grant portals or infer household/guardian authority. Authorized reviewed linkage checks existing identity and household membership.

Event/campaign references and typed attendee/waiver fields prepare compatibility with accepted Event/Outreach architecture; they do not replace registration, check-in or guardian rules. Existing Outreach, Christmas, application and giving URLs remain unchanged. Future migrations require separate approval.

Form events are immutable held domain records (`form.submitted`, `form.needs_review`, future `form.payment_completed`). Communications integration must recheck current authority, purpose consent, tenant and provider gates. No outgoing URL or sending job is configured. Analytics use submissions and canonical ledger/session references; completion/conversion rates remain unavailable without real tracking.

## Build/release boundary

Direct branded hosted form rendering precedes a validated embed contract (same-origin initially, no arbitrary parent messages). GIV-3 owns real tokenization/provider checkout. Templates, drawn signatures, complex wizards, Person lookup and integration delivery are extension hooks, not claims of implementation. Hosted acceptance and visual approval remain separate from local build verification.
