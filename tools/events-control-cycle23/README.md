# Events control lifetime

Source-only correction on Staff12695723fae. The exact original Events runtime
could submit new mutations after a save button, form or ancestor was removed and
reinserted, including during its awaited local-session identity check. Controls
now permanently retire on removal; pending observer records are consumed before
invocation and before new RPC dispatch. Existing event scope/revisions/server
permissions remain authoritative. No hosted migration or new authority.

Already-dispatched operations are not undone, retried or declared unsubmitted.
Their existing authority cleanup still runs after a response, even when initiating
controls retired. Host removal clears protected state. A first candidate skipped
this cleanup; independent review reproduced and rejected it before publication.
The permanent tests cover that regression separately from the original defect.

Tests use fictional identities/HTTP and actual selected SDK2.118.0. getUser in the
selected ChampionLifeAuth wrapper reads the SDK local session: a synthetic async
gate tests awaited replacement, not genuine provider validation. Root/request
permissions are enforced by the existing RPC and require genuine target RLS
acceptance. All five mutation forms retain their original action and revision
contracts; protected answers, notes, accounts and provider operations are absent.

The existing partner-home-cycle22 exact-source guard is extended with explicit
Events derivations and hashes. Historical guard predicates/source pins stay.
Current builds differ from Staff126 only in assets/js/staff-events.js among430
public files. No new integrity framework, SDK, public markup or layout redesign.
The prior required CI shutdown and historical WebKit causes remain UNKNOWN;
source acceptance never implies genuine Auth/RLS/recovery or release authority.
RELEASE NO-GO.

Organization-switch recovery: an injected browser history error previously left old organization content displayed under the new selection. The runtime now commits the route before adopting the organization; failure clears/retire the existing workspace. Existing retirement and dispatched-result authority cleanup remain. Appended tests cover normal switching, history failure, held identity and already-dispatched writes; no claim of cancelling an accepted write. No SQL or authority change.

Safe save recovery: a lost/ambiguous dispatched mutation holds further saves for that principal and organization for the page lifetime, including captured handlers and reopened forms. Current form inputs stay in memory only; existing account/organization retirement clears protected UI. Known transactional rejection remains distinct from UNKNOWN. Successful saves require returned organization, identity (where available) and exact next revision. The five existing mutation contracts and post-dispatch authority fences are preserved. Confirmed event save followed by schedule-load failure states that the save was confirmed. No reconciliation RPC, automatic retry, browser persistence, SQL or permissions are added. Page reload/navigation discards this local hold: the guidance explicitly forbids resubmitting after reload. Durable cross-tab/device recovery still requires a separately reviewed server-owned operation receipt; no exactly-once guarantee is claimed. Existing detail/catalog materialize schedules and are not read-only reconciliation. All original browser scenarios remain; append-only safe-save scenarios exercise actual SDK2.118.0 with fictional intercepted responses. Genuine hosted acceptance remains outstanding.
