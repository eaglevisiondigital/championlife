# Event Day arrival triage — source-only

The existing campaign registration workspace now connects attendance totals to a
read-only arrival queue and the existing household check-in/reversal workflow.
Staff can search an active household, inspect awaiting check-in, missing waiver
coverage, checked-in or all-attending records, review the household, perform an
already-authorized individual action, and refresh the queue to see its result.

The existing `outreach_registration_workspace` context/list/detail contract is
reused. No new Event Day, People, guardian, assignment, contact or permission
system is added. Historical PR #35's broader `outreach_event_day_workspace` and
its uninstalled operations dependencies are deliberately not imported.

`list.summary` provides campaign-wide active/attending totals, independent of
search. The existing list is unpaginated; this view reads at most 20 matching
active household details per page. Its attendee filter is explicitly page-local.
All three active registration statuses are checked again against each detail.
Inactive and not-attending attendees never appear. Waiver coverage is the exact
backend value, not a household, age or consent inference. There is no bulk
check-in, contact action, export or automatic registration/status update.

Private rows are staged until a final capability and verified-identity check.
Account, campaign, navigation, page restoration, replaced auth ownership and
permission-denial transitions retire pending views and detached handlers. A
verified identity change discovered by focus without an Auth callback also
clears the arrival search/page/filter. Same-account refresh preserves that search.
Ordinary network failure clears the obsolete queue and requires a fresh read.
This is an explicitly labeled snapshot; there is no claim of real-time updates
or that several separate read RPCs form one database snapshot. Household actions
reauthorize through the existing server RPC and current household view.

The approved registration, charcoal/gold and responsive components are reused;
no CSS, artwork, shared Auth, allowlist, SDK or migration is changed. The new
arrival form uses the existing one-column mobile form class to keep filter
labels readable. PR #85 restoration remains held behind its separate guarded
capacity migration approval; this increment does not install or activate it.

Validation uses fictional controlled Chromium/WebKit requests at 390, 768 and
1440 pixels and a native PostgreSQL test loading the exact existing migration
order without installing the restoration migration. The native test validates
summary/search semantics, individual check-in/reversal and idempotent audit,
corrected-waiver denial, other-campaign/unassigned/unverified/anonymous/view-only
and revoked-role denial. Browser tests are not genuine provider authentication.
Local native startup is currently blocked by macOS shared-memory exhaustion
before assertions, including with supported mmap/posix initialization. The
source-only CI database job must pass before final native acceptance is claimed.
No unrelated IPC/kernel setting or running service was altered.

No hosted installation, real grants, messages, payment, deployment or release is
authorized. Genuine Auth/revocation acceptance and separate release approval are
still required. Frozen PR #84 and independent PR #86 are unchanged.
