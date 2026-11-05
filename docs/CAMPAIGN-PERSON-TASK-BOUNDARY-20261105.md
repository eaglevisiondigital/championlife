# Campaign-derived canonical task boundary — source only

Base: PR #104 `24f93a42732626efddad08da26e968d529ec029f`. Owner source scope: Issue #50 comment 6671115380. This is a read-only enforcement increment, not a task issuer or identity-review producer.

## Implemented

The new guarded migration adds an initially empty private binding store and a restricted neutral task projection. Existing canonical `followup_tasks` and task audit events remain the only task system. A bound task requires BOTH current organization-wide People/follow-up permissions and the exact current assigned campaign/registration follow-up authority. An actor with only one authority sees neither the bound task nor its events. Ordinary tasks retain their existing policies and financial restrictions.

The binding records exact source, registration, organization, canonical Person, portal-link and campaign-registrant revisions, account, independent reviewer, evidence references, explicit finite expiry and immutable withdrawal history. Proof hashes are references into future independently accepted evidence; a hash is NOT evidence verification. There is no sanctioned evidence producer, actual reviewer designation, binding-creation RPC, client/service write grant, task-creation RPC or contact capability in this package. Positive fixtures are fictional owner-seeded data only.

`campaign_person_task_context(p_org,p_campaign,p_registration,p_payload)` accepts only task_id, binding_id and binding_revision. It returns the current actor/scope/binding plus task id, Person id, fixed title `Outreach follow-up`, status, due date, authorized assigned worker and revision. It never returns answers, decision/prayer/contact details, identity documents, eligibility evidence or financial data. Missing, stale, withdrawn, expired, conflicting or unverified dependencies deny access.

Every bound task write is disabled, including generic direct-table updates. Client `.eq(revision)` filters cannot enforce a mandatory server CAS contract. A future separately reviewed mutation RPC must supply atomic expected revisions before writes can be enabled. No source task or event history is rewritten: non-neutral existing task/history is rejected at binding. Binding, task-history, financial-intake and tag-workflow guards prevent protected tasks from becoming generic side-channel attachments. Compatible task row locks serialize binding with attachment/history writes.

## Installation and rollback

Do not install hosted SQL. Required reviewed local schema: the 27-migration baseline in campaign-foundation-baseline.mjs, followed by the exact existing campaign decision foundation. The new migration verifies a semantic catalog SHA-256 covering function definitions/owners/privileges, relation/column privileges, RLS, policies, constraints and triggers. Baseline semantic hash: `caf383b0f0788d277449b0dd6ca3a19dcb0b4f818b5106b059be35848ad375d6`. Native environment acceptance remains necessary; matching a disposable fixture is not managed Auth acceptance.

A drift rejection rolls back the new migration transaction. There is no destructive down migration. If a future installed deployment has bindings, stop the consuming feature and retain protection and all task/history/binding records; removing restrictions while bindings exist would expose protected records. Removal or forward repair requires an independently reviewed exact-target migration and separate owner approval. No retry after an uncertain installation outcome: inspect the migration ledger and catalog first.

## Gates not completed

- Independently authorized identity reviewer and approved source/Person verification producer, including trustworthy adult eligibility and consent evidence.
- Real source provenance, finite review policy and actual immutable evidence custody.
- Task creation/reassignment/update CAS contract and its independent concurrency review.
- Managed Supabase Auth catalog/privilege acceptance, exact-target SQL authorization, genuine account/RLS testing, independent recovery and cleanup.
- Hosted installation, activation and release approval. RELEASE NO-GO.

Synthetic test identities, claims, source hashes and evidence references must never be used as production authority. Existing campaign follow-up, private learner records, Giving, public baptism, branding and website output are unchanged.

The deferred task fence intentionally also rejects creating a task and binding it in the same transaction. This increment only validates an already-existing neutral task with accepted historical events; it is not a hidden task producer. Binding/history audit failures abort the complete transaction. Immutable source evidence and task journals are never deleted for rollback.
