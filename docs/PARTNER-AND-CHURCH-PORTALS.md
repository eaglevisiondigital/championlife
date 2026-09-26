# Overlapping SowGo partner and church participant portals

Dave confirmed September 25, 2026 that SowGo outreach partners need their own platform and special partner areas, while church members and Dream Team participants need church areas controlled by approved tags. A church member may also be a SowGo partner and must receive both sets of access from the same login. Neither relationship replaces the other.

## Access model

| Relationship | Organization | Participant area |
| --- | --- | --- |
| Church member | Champion Life | Church member area |
| Dream Team participant | Champion Life | Dream Team area |
| SowGo outreach partner | SowGo | SowGo partner area |
| Church participant and SowGo partner | Both, independently | All areas for which that account qualifies |

One verified login can have a reviewed portal-only link to an organization contact in each organization. An enabled area-to-tag rule plus an active tag assignment, active tag/department and active account link determines participant access. Merely signing in, giving, sharing an email address or holding another organization's tag does not establish entitlement.

Tags can grant participant content access only through explicit administrator-configured rules. They never grant staff permissions, financial access, ownership of CRM records or access to another donor's history. Dream Team does not implicitly include member access; administrators can explicitly map its tag to both church areas if that is the intended policy. SowGo partner eligibility/benefits and giving thresholds remain separate policy decisions, not guessed defaults.

## Implemented foundation

- Three organization-owned portal area definitions, with no participant grants or content seeded.
- Audited, revision-checked rules mapping organization tags to areas.
- Reviewed account links for portal use only. A verified account email identifies the login after staff separately verifies the person's identity; matching email alone is insufficient. Existing links can be revoked/restored but cannot transfer to another account through this API.
- Protected access tags: assigning/removing enabled access tags requires portal management plus ordinary tag authority. Archiving/restoring/reparenting those tags, or changing their department's active state, also requires portal authority.
- Resource creation, draft/published/archived states, safe plain-text content, fixed organization/area ownership and server revisions.
- `my-ministry.html`: one sign-in, a selector showing all permitted organization areas, paginated published resources and fresh authorized resource reads. No financial/CRM data is included.
- Staff portal setup screens for resources and area rules, plus Portal account from People for reviewed links.
- Portal-specific administrative audits, unavailable to ordinary participants.

## Staff permissions

portal.manage requires people.read and tags.read. It permits resource administration and protects access-tag operations. Changing access rules or account links additionally requires staff.manage. Assigning an access tag also requires the existing tags.manage permission. Administrators can delegate only portal permissions they hold; the existing trusted first-admin process still applies.

A staff portal manager can preview organization areas and resources through staff authority. Ordinary participants see only their eligible areas and published resources. They cannot list staff account links, verification notes, rules or administrative history. Disabling a rule, revoking a link, removing a qualifying tag or archiving its tag/department removes access at the next database request without waiting for token renewal. Already displayed/copied content cannot be recalled; this is access control, not DRM.

## Setting up a participant

1. Have the person complete verified sign-in using the existing login flow.
2. In the correct organization's People record, an authorized administrator opens Portal account.
3. Verify that the selected contact and account are the same person using appropriate evidence, not only a shared email. Record the verification reason, confirm the review and save the portal-only link.
4. Configure the appropriate access tag under Participant portals. Enabling a rule applies to existing and future qualifying tag assignments, so review its audience before enabling.
5. Assign the tag using an authorized portal/tag manager. Repeat independently in the other organization when the person qualifies there too.
6. The person opens My ministry areas and can select each permitted area.

No invitation is sent by linking an account. These links do not mutate organization_people.user_id, claim guest gifts, claim household relationships, infer consent or grant financial visibility. Correcting a link to a different login requires a separate trusted identity review, not a silent email edit.

## Remaining platform work

This is the shared access/resource foundation, not the full partnership platform. Partner onboarding, benefits/thresholds, commitments, private media/files, events/meetings, ministry updates, messaging, impact reporting and donor self-service remain on the build plan. Church member and Dream Team schedules, training, serving assignments, groups and family experiences will use the same explicit area boundaries.

General public intake-to-CRM and verified self-service identity claiming are still separate work. Until those flows are built and verified, approved administrators establish portal-only account links. Do not auto-merge household members or donors by email/phone.

Current giving links remain unchanged. SowGo giving uses its future separate gateway/merchant destination, and Champion Life giving uses the church destination. Participant portal membership does not combine either organization's giving records or merchant accounts.

## Validation and release

Run `npm test --prefix tools/backend-tests`. Database checks cover dual access, independent revocation, hidden drafts, organization isolation, self-upgrade denial, protected access tags and departments, account-link identity, finance separation, unverified/anonymous access and audit restrictions. DOM checks cover participant area switching, safe content rendering, account clearing and staff resource/rule/link operations. Login redirect tests include the new route while retaining external redirect rejection.

No real links, access rules, content or staff grants are provisioned by this migration. Actual sign-in, identity-review acceptance, desktop/mobile browser visual checks and publication approval remain required. Main stays unchanged until the approved release.

## Resource discovery and protected links

Participants can search published resource titles within the selected area. Search resets pagination; switching areas clears the search. The search is a case-insensitive phrase match, limited to 100 characters, with wildcard characters treated as spaces. Results are bounded to 12 cards per page and remain subject to database RLS. Empty and failed results provide a recovery path.

A successfully opened resource has a Copy resource link action, with a selected text fallback when clipboard permission is unavailable. Links contain only the area and resource identifiers, never content or account credentials. The login return allowlist preserves only a valid UUID area/resource pair on the local my-ministry route, dropping all unrelated query parameters and fragments. Opening a link still requires a fresh published-resource query scoped to the authorized organization and area. A link does not grant access.

Pending list, detail and clipboard UI results are invalidated on relevant navigation or account changes. Sign-out immediately clears displayed resources even if the network request fails; failed sign-out still requires retrying or reloading to finish ending the session. No browser storage of private resource content was added.

Acceptance: test a copied link while signed out, verify sign-in returns to the resource, then repeat with an ineligible account and after revocation. Check clipboard fallback, search pagination, area switching, keyboard dialog use and mobile presentation. Synthetic tests cover these state transitions; actual browser/account acceptance remains pending.

Dave reconfirmed that existing giving links must remain in place through testing. Switching checkout remains a final, separately approved release step.
