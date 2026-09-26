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
