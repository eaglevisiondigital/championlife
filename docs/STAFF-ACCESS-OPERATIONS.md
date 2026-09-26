# Staff access rollout

Active project: exdocjbmylgxssanymjk. Development branch: champion-sowgo-backend-v1.

## First administrator

Dave must identify the exact account email and whether its authority covers Champion Life, SowGo or both before real grants are made. Verify the account exists and has confirmed email, then use a reviewed server-side transaction to provision only the approved organization permissions and a matching organization_staff_directory label. Record the operator/approval in the release record. Never infer the initial administrator from account age, organization affiliation or profile text. There is no public bootstrap endpoint.

`staff.manage` is a non-delegable platform-provisioned permission. Grant accompanying operational permissions explicitly; it does not imply access to people, finance, care or follow-up. Administrative authority over staff inherently permits revoking operational access within that organization. The browser screen only offers permissions the acting administrator currently holds.

## Adding staff after bootstrap

1. Have the staff member complete the existing verified sign-in flow.
2. Open Staff access for the intended organization, choose Add staff access and enter the exact verified email and a display name.
3. Choose explicit permissions. People create/update/export and follow-up require people.read. Follow-up management also requires followup.read.
4. Save and review the scoped directory and access audit. This does not send an invitation email.

To remove operational access, edit the staff member, clear all permissions and save. Revision checks reject stale changes. Administrator accounts and the acting user's own account require trusted review. Revocation is enforced by database permission checks, independent of JWT renewal; previously displayed content cannot be recalled from a browser or an exported copy.

## Contacts and follow-up

Add person creates an organization contact only, not an Auth user, learner enrollment, affiliation or consent record. Use shared family emails when appropriate; duplicate detection and merge/import workflows are later work. Do not use contact existence or a task as consent to email/SMS.

Create follow-up from a contact row. Choose unassigned, yourself or an eligible directory member. All assignment writes are checked on the server, so a stale picker cannot assign newly ineligible staff. Staff without followup.manage have read-only task access. Private pastoral notes do not belong in operational task titles.

## Before publication

Complete real email sign-in, expired-link, account-switch and permission-revocation acceptance with explicitly designated test accounts. Review desktop/mobile layout in an actual browser. The existing password-protection warning needs review before password-based staff login: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Migrations in this repository are incremental; the original remote migration baseline is not yet reconciled. Do not run automated db reset or db push against production. Use reviewed additive changes and retain audits. Keep main unchanged until frontend acceptance and publication approval.

## Household staff permissions

Grant households.read together with people.read for household viewing. Add households.manage for creation, renaming, membership edits and archival. Administrators may delegate these permissions only when they hold them. People access by itself does not expose household relationships or their audit history.

Use Households to create a named record and add existing contacts. Search by last name; up to 20 matches are shown. Removed members remain visible with Restore available. An archived household must be restored before membership changes. A relationship label is descriptive only and must never be treated as a verified guardian or authorized pickup record.

## Tags, departments and giving access

Use tags.read with people.read to view departments and tags; add tags.manage to edit configuration and person assignments. The leader picker also requires followup.read and lists eligible existing staff. Department leadership requires a verified account with people.read and followup.read, but does not grant those permissions. Provision them explicitly first. A department can remain unassigned while routing is being configured.

On People, use Tags to add an active tag or remove/restore a prior assignment. Tags in an archived department cannot be newly assigned or restored. No notifications or automatic tasks are sent by this phase. Future follow-up instructions and due days are configuration only until a reviewed workflow engine is activated.

Giving data is restricted to staff with explicit organization finance.read access granted by an authorized administrator. staff.manage does not itself confer financial visibility, and an administrator cannot delegate finance.read unless they hold it. Tags, donor/member/partner/Dream Team relationships and department leadership do not grant finance access. Future giving totals, exports, statements, search results and notifications must enforce this boundary server-side. Donors' access to their own verified giving history is separate from staff authority.
