# Unified Outreach candidate security model

Authority comes from verified Auth identity plus current active/dated database staff, campaign, or partner grants. User-editable metadata and cached JWT role claims grant no capability. Missing, revoked, inactive, expired, future, cross-campaign and cross-church authority denies. Organization scope remains separate from campaign and partner assignment scope.

Public application tables use RLS and RPC-only access; new raw table privileges are denied to anon/authenticated. Privileged implementations use empty search paths and explicit capability checks. Private source implementations renamed by the integration are not browser-executable. Recreated wrappers explicitly revoke PostgreSQL's default PUBLIC EXECUTE. Scoped Storage predicates remain required for private documents.

Partners cannot browse or claim the unassigned pool, query another church/campaign UUID, choose another church's worker, or acquire general People/finance rights. Composite foreign keys bind partner follow-up and pastoral notes to their exact assignment/campaign/church. Both histories are immutable. Existing verified accounts are required before any partner grant; the UI sends no invitations.

Private pastoral content has a separate capability or explicitly scoped pastoral-care permission. It is absent from ordinary staff projections, CSV and general audit metadata. Household projections return registering-adult/guardian contact and omit child answer/contact fields. Central follow-up cannot rewrite original decision/contact/prayer/timestamp/consent fields and may assign only a currently authorized verified worker. CSV is scoped, server-generated, formula-neutralized and audited.

The shell rechecks current authority on focus and every 15 seconds. Access/assignment revisions clear protected UI without logout; any RPC denial clears it immediately. A shared request epoch rejects late protected responses after revocation/session change. Sign Out clears protected DOM before navigation. Backend denial remains authoritative regardless of UI timing.

Profile models describe Dave/Roddy/Tania full Champion Life/Outreach, Kelsea full Outreach, Pastor Chris assigned Bessemer-only and local Huntsville pastors assigned Huntsville-only. No real identity/grant is created. Staff-provisioning writes are held behind a separate release; the directory read is limited to organizations for which the current administrator has staff.manage, with no unrelated-tenant Auth enumeration.

Communications global/org/provider enablement is false/unconfigured; no actual provider credentials, worker deployment, scheduler, test send or financial activation occurs. Protected public registration functions, Edge gateways, headers/routes and historical migrations remain unchanged.

Local role, negative authorization, export, immutable-source, race and responsive browser tests are evidence for this candidate. They do not establish real hosted Auth, API/Storage exposure, Turnstile, email callbacks, live database migration application or production release readiness. Exact-stack hosted acceptance and separate production GO are still required.
