# Guest identity, giving and department follow-up

Approved product requirements from Dave, September 25, 2026 (America/Chicago). This specification extends the build plan. It is not a claim that giving, tags or automated email are deployed.

## One person across entry points

Every submitted person-bearing entry point, including giving, connection cards, events, outreach, courses and serving interest, must establish or connect an organization contact. Simply visiting a page does not create a contact. Preserve the source, submission time and applicable communication preferences. An account is optional for guest participation wherever the underlying activity allows it.

Keep account state separate from participation. An unregistered person remains a guest account-wise even when they have made gifts. Registration connects their verified identity to their existing organization record and history. Donor, member, partner and Dream Team (serving in the church) are distinct relationships that can coexist. They are not a mandatory progression and never confer staff permissions. Registration alone does not make someone a donor; a recorded qualifying gift establishes the donor relationship. Membership, partnership and serving status use the relevant approved workflow.

Retain separate organization records and permissions for Champion Life and SowGo. A verified account can connect to both without sharing their private financial or ministry records. Household relationships do not establish ownership of another person's gifts.

## Guest giving and later registration

1. Allow giving without account registration. Capture the contact information needed for the selected giving method and offer email and/or phone association with the gift.
2. Record the gift against an organization-owned guest contact and preserve the payment provider reference. Payment confirmation, not a client-side success screen, determines the recorded payment state.
3. On a later gift, offer an optional registration/sign-in and connection flow. Before verification, use neutral wording such as “Already given here? Connect your giving history.” Do not disclose whether the entered email/phone exists or reveal prior gifts.
4. Verify control of the chosen email or phone before offering eligible prior records to connect. Typing the same contact information is a matching hint, not proof of account ownership. Phone verification depends on the eventual configured provider.
5. Connect eligible prior and future gifts to the registered person's giving history without copying or duplicating ledger entries. Preserve claim history and the original gift/contact references.
6. Shared family email, recycled phone numbers, conflicting ownership and multiple candidate contacts require additional evidence or authorized review. Verification of a shared identifier alone must not transfer another person's gifts. Changing contact details must not silently transfer ownership either.
7. The registered donor can access their reconciled annual statement and giving history. Retain the previously approved rules for corrections, refunds, manual gifts and separate DAF attribution. Unregistered guests retain their recorded gifts and may obtain a statement through a verified request or authorized finance process; registration must not erase or gate the underlying accounting record.

Receipt delivery and statement availability are separate from marketing consent. Email/phone collection or giving does not subscribe someone to general ministry communications. Final statement template and delivery settings belong to each organization.

## Tag-triggered department follow-up

Each assignable operational tag needs an owning department and a configurable workflow. The intended default when a person newly receives that tag is:

- Create a follow-up task for the designated department leader to connect with the person.
- Send that leader an email notification linking to the protected task/person record.
- Use configurable instructions such as call, email or connect, with an optional due-date offset and escalation/fallback owner.

Leadership and task routing are explicit organization configuration. A tag never grants its leader access to finance, care, accounts or other restricted information. The leader must already have appropriate contact and task permissions. Email contains minimal operational information, with private detail accessible only after sign-in. Contacting the participant remains subject to the recorded preferences and permissions.

An unmapped tag or missing/ineligible leader must produce a visible routing exception for authorized operations staff, rather than silently dropping the follow-up or broadening permissions. Initial tag configuration should require a department, eligible owner and task template before its automation can be activated. Additional steps and timing can be defined later without changing the person identity model.

## Implementation contract

- Use a reviewed server intake path for each source. Current contact creation triggers require verified staff, so public intake cannot simply insert through the staff editor or bypass its audit controls.
- Persist source identifiers and make repeated submission/payment callbacks idempotent. Uncertain matches remain reviewable candidates; do not merge automatically by name, email or phone.
- Record each new tag assignment as an auditable event. The event identity is the deduplication key for one workflow run and its task/email actions. Saving an unchanged tag must not retrigger it. Removal followed by re-addition is a new event, with configurable re-entry suppression.
- Commit the tag event and durable workflow request together. Process task creation and email delivery with independently retryable action states. A failed email must not create duplicate tasks. Use provider idempotency where supported and record ambiguous delivery outcomes for reconciliation rather than promising exactly-once email delivery.
- Track pending, completed, retrying and needs-review actions, attempt history and rule version. Recheck organization scope and owner eligibility at execution time. Future leader changes should surface outstanding assignments for controlled reassignment.
- Provide a preview/dry run before activation and an explicit bulk-import/backfill mode so historical tagging does not accidentally send a wave of notifications.
- Existing follow-up tasks can serve as the task destination, but automation requires a separately reviewed server actor and audit path. Current verified-staff write guards must remain intact.
- User intent authorizes building these notification capabilities. No live messages are sent during development. Activate only after actual departments, recipients, templates and delivery configuration are established and reviewed.

## Acceptance criteria

1. A guest gives twice and later registers: both gifts appear once in the correct person's history and annual statement.
2. A guest declines registration: giving still succeeds and records remain available for a later verified claim.
3. An unverified visitor cannot discover donor existence, gifts or statements by entering someone else's email or phone.
4. Shared identifiers, disputed claims and cross-organization records do not silently merge or expose private history.
5. Entry from each enabled source creates or safely connects a contact while retaining provenance and preferences; existing course and outreach behavior remains functional.
6. Donor, member, partner and Dream Team relationships coexist without granting staff permissions.
7. A new mapped tag produces one department task and a tracked leader email action. Replayed events and retries do not duplicate the task.
8. Missing/revoked leaders, delivery failures, removed/re-added tags and bulk imports have visible, testable outcomes.
9. A department leader sees only authorized contact/task information; unrelated financial and restricted records remain inaccessible.

## Build order and open configuration

Implement the organization contact identity/claim model and tag/department configuration, then durable workflow actions integrated with follow-up tasks. Build giving claims and statements on the approved ledger and selected payment provider. Add actual email delivery after notification configuration and recipient review.

Still needed at the relevant implementation stage: organization payment provider, phone verification service if phone claims are enabled, department/tag mappings, designated leaders/fallbacks, task wording and timing, and email sender/template configuration. These choices do not block the model or workflow engine work.
