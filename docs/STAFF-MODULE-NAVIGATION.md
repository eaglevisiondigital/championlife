# Permission-aware staff navigation — source successor

This narrow successor preserves frozen PR #90 and reuses its approved sidebar,
home cards, Church/Outreach selector, responsive drawer and Powered by Propel
branding. It adds links to reviewed existing module routes, not new modules,
permissions, People records or authentication infrastructure.

The existing canonical `staff_workspace_context` remains authoritative for staff
organization grants and the existing Outreach RPC remains authoritative for
campaign discovery. The Forms private-draft context is additionally consulted
because exact-form/campaign grants are intentionally absent from generic staff
discovery. Only its reviewed `private_draft_v1` capability profile is accepted.
Scoped form identifiers and names are immediately discarded; only authorized
organization IDs/names enter navigation state.

| Destination | Existing authority required for navigation |
| --- | --- |
| People & Follow-up | Organization-wide `people.read`; destination separately checks households, follow-up and each action |
| Church Events | Current `events.view` or `events.manage`, organization-wide or nonempty department scope; destination enforces exact scope |
| Forms | Canonical Forms context grants an existing read/create/edit capability for the organization or specific form/campaign |
| Dream Team & Manual Follow-up | All four organization-wide `dream_team.application.read`, `dream_team.application.restricted`, `people.read`, `followup.read` |
| Registration & Check-In | Existing independently discovered Outreach campaign; destination enforces individual capabilities |

Forms-only and Events-only workers can select their authorized organization but
receive no People, household, financial or Dream Team authority. Financial Outreach
navigation retains the existing separate `outreach.view` plus `finance.read` rule.
The original canonical People workspace supplies existing household and Person
task workflows; this package does not create another follow-up route or infer
serving qualification, course completion or verified application provenance.

Module links contain only the exact organization/campaign scope. Repeated, empty
or unavailable explicit selections fail closed. Home canonicalization drops
private record IDs, arbitrary next values and fragments. Registered destinations
must belong to the current rendered authorized scope. Ordinary link/selector
navigation performs fresh identity and permission discovery before leaving.
New tabs and destinations still perform their own authoritative access checks.
Detached controls cannot navigate or request after retirement.

Missing or incompatible optional Forms capability hides Forms while preserving
independent People/Outreach access. Explicit authorization denials, changed
permission projections, expired identity, replaced Auth/client, account changes
and navigation retirement clear protected state. Failed optional Forms transport
cannot preserve previously available Forms authority: its changed projection
retires the existing workspace. No Events metadata or private application data is
fetched solely to construct navigation.

Integration testing reproduced a pre-existing account-transition defect in the
shell's guarded RPC adapter: a delayed People list could return after an account
change without an Auth callback. The successor checks fresh Auth identity and
current local session after RPC completion, before returning data. A mismatch
clears protected content and the previous account label. Final discovery retains
both checks too, including a local-session fence after a delayed Auth response.
Auth callbacks still invalidate synchronously and never await provider operations.

## Explicit composition and release dependencies

This branch is **not a standalone deployment candidate**. It is based on PR #90;
the new module pages and SQL are not copied into it. An independently reviewed
release composition must explicitly include Events #96 and its guarded installer,
Forms #95/#98, Dream #94/#99 and shared-session #97, with their accepted immutable
sources. Events navigation uses existing authoritative grants and its destination
fails closed; a link is not evidence that its uninstalled SQL is live. Dream Team
requires existing canonical application records and all separate provenance gates.

The existing People request wrapper also fences direct task-table success and error responses against the captured current session/client before a late consumer can restore a previous account’s review or uncertain-save control. Same-account uncertain writes retain the existing no-automatic-retry behavior; already committed records are preserved.

No migration, grant, SDK, public page, shared Auth/session, financial component,
style or artwork changes are introduced. Source navigation acceptance does not
constitute actual provider authentication or permission acceptance. Managed Auth
execution privileges, exact-target migration review, independently witnessed
recovery/cleanup, protected isolated Auth acceptance and production release remain
separate mandatory gates.

The permanent local suite exercises actual staff HTML and runtime with fictional
Auth/discovery and all non-loopback traffic blocked. The existing affected real-SDK
browser suites retain their assertions; fixtures explicitly represent an absent
optional Forms backend. The independent corrected delayed People-list replay
completed in four actual-SQL browser configurations. The complete corrected
SQL-backed composition remains INCOMPLETE and unpublished because its specialist
was interrupted by automatic safety screening; the corrected direct-table
uncertain-save scenario has author browser coverage but no completed independent
actual-SQL replay. No real account, provider action or hosted resource is used.

## Historical source verification remains immutable

The prior Backoffice `source-manifest.json` is unchanged and checked against its
exact frozen PR #90 Git bytes. A separate successor binding names exactly two
reviewed runtime changes and four directly affected test fixtures. It verifies
both prior and successor hashes and rejects a third runtime, an unexpected test,
a changed baseline, incorrect hashes or a rewritten historical manifest. The
fixtures add an explicit absent-Forms response, preserve every prior assertion,
and capture the stale Save control before its DOM is replaced. The People task
suite adds held-result account-transition cases without weakening existing
same-account uncertainty/no-retry scenarios.
