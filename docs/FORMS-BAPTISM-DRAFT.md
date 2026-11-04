# Existing Water Baptism Interest → canonical private Forms draft

Source-only successor of GIV-2C PR #19 at `edf82fb34e8db448a0d6c6465a3799c75993d5a2`.
This is not a current-main release composition. Its historical Forms, shared staff,
Giving and schema dependencies remain separate release gates. No migration changes.

The existing Forms chooser now offers **Water Baptism Interest — existing fields
(draft)**. An authorized Forms creator selects the organization, gives the draft a
name, then opens the existing canonical builder. The eight collection fields, labels,
required flags and choices come from `baptism-interest.html`, SHA-256
`159f4277da14bdcf8be84e192365aa1eead87d7a9d29c96de04266d849c4e754`.
That source is byte-identical in current production-main source `999f4a75eeb8e4a05580dc603dda39ba64eb0409`.
The catalog descriptor is frozen at version 1; each invocation returns independent
field objects. Hyphenated Netlify names map deterministically to underscore keys;
no hidden answers, consent choices, guardian assertions or Person identifiers are added.

The definition starts with `public_available=false` and `payment={}`. It uses the
existing `forms_workspace` create/save/read RPC, immutable published versions,
revision conflicts, organization permissions and canonical audit. It never calls
funds, public submit or publish while creating this draft. Existing separate
`forms.publish` authorization remains required for any future publication; saving
answers is not membership, baptism, salvation, Dream Track or identity evidence.

The live Netlify form and endpoints remain untouched. No existing response is
imported or linked. Religious answers are sensitive; source availability is not
permission to read submissions. Existing `forms.submissions.read` organization/
form scope remains authoritative. A future hosted release must independently prove
current authorization, consent/version snapshots and any separately approved
retention process before enabling new collection.

Create controls bind to their original principal, organization, navigation epoch
and connected panel. A fresh identity read precedes creation. Detached controls,
changed accounts and delayed prior-account successes cannot submit or navigate the
new workspace. Pending duplicate clicks issue only one create request. The server
still performs all actual authorization and validation; frontend checks do not
replace it.

No alternate People system, permissions, Global Propel production host or tenant
installation is introduced. A future Global Propel host must additionally enforce
its own tenant package/module/feature entitlement and individual permissions; this
historical Champion Life template does not confer those entitlements.

Validation: exact source-field/hash tests, synthetic Chromium/WebKit mobile and
desktop create/deny/account-switch journeys, canonical PGlite migration replay and
positive/negative draft/revision/audit checks, existing Forms database/DOM/gateway
regressions, and two reproducible public builds. Genuine Auth, managed PostgreSQL,
Storage, publication and provider acceptance remain untested for this successor.
