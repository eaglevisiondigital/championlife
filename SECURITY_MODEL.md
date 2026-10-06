# Security — Outreach Campaign Core candidate

## Phase B security boundary

Explicit team.view/team.manage/travel.view/travel.manage are independent from Phase A follow-up and from existing People permissions. Manage requires corresponding view. Team-only users receive no hotel/vehicle/trip-setting records; travel-only users receive no applicant email/private notes or approval authority. Reviewed primary/dependent sharing additionally depends on current canonical membership, active Household and reviewed portal links. Secondary participant accounts receive only their own/reviewed dependent projections. Official travel/lodging requires approval and minor guardian review. All new tables deny raw client access; internal helpers are revoked. Capacity races, scoped CSV, direct-ID denial, revocation and local-pastor privacy are tested. No hosted/production grants or Auth settings are changed. See [Phase B contract](docs/OUTREACH-PHASE-B-TEAM-TRAVEL.md).

## Phase A foundations

All new public tables enable RLS and revoke direct PUBLIC/anon/authenticated access. Public RPCs are invokers; guarded private definers have empty search paths and qualified relations. Verified non-anonymous identity, explicit campaign/organization authority and current active/effective/expiry state are checked server-side. Campaign-only leaders receive no org-wide People grant. Organization admin capability additionally requires active existing staff assignment; no live account is seeded or provisioned.

Canonical linking/contact review additionally enforces existing People permission. Progress is limited to Getting a Grip enrollment and lesson status, through active reviewed portal links or the existing verified historical claim. Course answers/private notes/other modules never enter the projection or CSV. Export is scoped, audited and spreadsheet-formula neutralized. UI clears protected content on denial/session change and discards stale asynchronous data.

Documents are always private, including public-designated metadata. Storage INSERT/SELECT checks exact prescribed path/campaign/capability/restricted-admin access. No client overwrite/delete, no public signed URLs, actual metadata required to finalize and immutable replacement paths/history. File limits are 10 MB and approved MIME types. Scope/expiry applies to requested recipients and training/step assignees.

Prize primitives are owner-only, not callable through application roles or public RPC. Explicit draw assignment is required even for administrators. Campaign lock, pending reservation and immutable unique win ledger prevent multi-pool/multiple/concurrent wins. Eligibility changes cannot override a win. Unclaimed is not won; mandatory explicit policy governs later eligibility. Public future reveal projection contains no names/phone.

No provider messages, Auth/SMTP/DNS changes, new callbacks, production/acceptance migrations or production grants occur in this implementation. Preview build retains production-backend blocking/isolated configuration rules. Private audit/source evidence stays outside `dist/`. Remote rollout requires baseline reconciliation, isolated authenticated/Storage acceptance and separately authorized exact grants/callbacks/release.
