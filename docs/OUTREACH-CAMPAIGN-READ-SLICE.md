# Campaign registration summary — local source package

Production base: bfb7af214707db73a3a3164bc96ccafae7de8ccf. The new server-side composition is unregistered and not in the public build. No new schema, grants, UI, deployed endpoint or provider configuration.

## Reconciliation

| Source | Disposition |
|---|---|
| PR61 fe0cc5b4219b17d18867c4d2a588f2f42ac82ae3 | Frozen; no staff-shell edits |
| PR60 42-path overlap inventory | Avoid overlapping shell, CSS, capability registry, build manifests and established tests |
| PR35 76c328c507460406218f4aff279d3ce3467c9710 | Reviewed source reference; do not import its four unapplied 20261019004611–14 migrations |
| PR29 350512a9401c6e783673af33f2f045d6ba04f62d | Historical partner/pastoral architecture only; no chain merge |
| PR36 bbadd2b4adf75a4342b653d57c81fac8aa86e74a | Gate0 overlap remains separate; no wholesale migration import |
| Current production registration RPC | Reused unchanged with caller session and campaign-scoped authorization |

Current partner intake includes commitment/financial data and requires outreach.view plus finance.read after the operations-admin security migration. It cannot safely serve as a generic nonfinancial partner directory. This slice therefore implements an event-registration summary only; a partner-care projection needs its own reviewed field/permission contract. It does not invent a new partner schema or expose the unreleased advanced follow-up module.

## Implemented boundary

`createCampaignSummaryReader({getVerifiedSession,rpc,onInvalidate})` reads the existing outreach_registration_workspace with context → list → context for one campaign. The final context rechecks server authorization after retrieval. Only household/attendee/adult/minor/check-in aggregate counts leave this module. It rejects malformed/inconsistent counts and discards registration rows, contact information, administrative configuration and arbitrary fields. Book/course decisions remain explicitly not-linked; partner care remains separate.

The RPC internally returns registration details to the already-authorized server caller; this is not an efficient backend aggregate-only query. Do not wire it with a service-role client or present it as access for someone lacking registration.view. A future aggregate RPC optimization requires separately reviewed SQL, not a silent authority expansion.

Each read invalidates older work. Verified user ID, session ID and generation must remain identical around requests. Explicit permission denials, account changes and errors clear state through onInvalidate; overlapping responses cannot return current results. The consuming UI must call invalidate immediately on logout, navigation, campaign change and session events and discard its own prior DTO. The adapter has no DOM and cannot erase data already held by a consumer. getVerifiedSession is a trusted server adapter, not client-supplied flags. No implementation of that provider binding or UI connection is claimed here.

## Tests and release boundary

20 focused Node tests pass, covering privacy projection, counts, denied/stale sessions, overlapping work and malformed campaigns. 11 native PostgreSQL assertions pass against all existing main migrations in a disposable Unix-socket-only cluster: actual RPC mapping, other-campaign/unassigned/unconfirmed/expired denial, revocation after list, reauthorization and no finance/People/staff authority. Auth rows are fictional and do not constitute genuine Supabase Auth acceptance. The harness uses the existing backend-tests pg dependency; install its locked development dependencies or use an existing verified local installation.

Commands: `node --test tools/outreach/campaign-summary.test.mjs`; `node tools/outreach/campaign-summary.native.mjs`. Full browser suites were not repeated because no browser runtime or public-build input changed. Existing website, registration, check-in, King Kind, giving and branding are unchanged.

Next smallest package: independent source review, then a separately reviewed provider/session binding and shell mount against frozen PR61. Genuine Auth and shared-backend acceptance still require approved custody and cleanup prerequisites. No new hosted project, real grant, account or message was created.
