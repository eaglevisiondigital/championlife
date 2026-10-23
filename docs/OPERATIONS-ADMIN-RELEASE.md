# Operations security release candidate

This candidate extends security source `28bb772e663f2ce8de28d56bff659456184c38d8` on production `53beb5d5c0d1ee259155128e4e282d18b4195623`. Consolidation adds reproducible tests and release documentation only. The original four runtime UI changes and forward migration are unchanged. No account, invitation or permission seed is included.

## Role contracts

The separately scoped nonfinancial operations set is `people.read`, `people.create`, `people.update`, `people.export`, `households.read`, `households.manage`, `followup.read`, `followup.manage`, `registrations.view`, `registrations.manage`, `outreach.view`.

An approved dual-organization operator may receive that set independently in Church and Outreach. An Outreach-only operator receives it only in Outreach; ordinary Church membership adds no Church staff grants. Membership is not proof of donor ownership or household giving authority. Member resources still require their existing eligibility rules and publication state.

Registration projection is limited to `registration.view`, `registration.manage`, `registration.export` and `checkin.manage` for campaigns belonging to the explicitly assigned organization. It neither adds campaign administrator rows nor automatically grants future capabilities. Full team, logistics, communications, Event Day and member-portal experiences remain separate release gates.

Both roles exclude finance, donor commitments and their linked histories, private pastoral notes, merchant/payment administration, staff permission administration and self-granting. Individual authentication, verified contact bindings, reviewed dates and independent assignment authority are required before activation. A future full-platform administrator policy is not a present grant or a way around these gates.

## Source reconciliation

Reviewed child heads: NMI `4e463f792bf9a2af03345e8854433e2d00863729`, Outreach `76c328c507460406218f4aff279d3ce3467c9710`, Shared Gate0 `bbadd2b4adf75a4342b653d57c81fac8aa86e74a`.

The exact SQL passed twelve native migration-order compositions, including both combined child orders, preserving all 87 combined capabilities. The standalone production baseline remains 29 capabilities; do not replace it with the child registry. Keep child histories and test inventories. Explicitly add this migration and the scope tests to each future reviewed composition. Never replace a child's 38/30-file migration list with the production 26-file list.

The three JavaScript deltas are compatible with both children. Preserve Outreach's newer premium `staff-people.html` and shared navigation instead of overwriting it with the standalone page. Keep the separately reviewed staff-shell startup correction and obsolete acceptance-harness exclusion in their own child adoption. No child PR is merged by this candidate.

## Ordered production release gates

1. Verify the exact candidate head, CI, current production baseline and four SQL function drift guards. Review affected existing `outreach.view` grants: donation-intake review now also requires `finance.read`. Do not grant finance automatically to preserve prior visibility.
2. Capture the current immutable production website deployment and database object/ACL definitions. Preserve historical migration aliases `20261016201932→20261018113932`, `20261016201933→20261018113939`, `20261018121900→20261018144843`. No bulk replay, repair or reset.
3. Obtain separate production authorization. Apply only `20261022201357_operations_admin_security.sql`, once, with its ledger entry. SHA-256: `a5cb9ad66faf87db263414c80a89b76a7498025188661691e1d9e196b603304a`.
4. Verify the intended four function replacements, two private helpers, three restrictive policies, two corrected SELECT policies and additive audit constraint. Preserve existing owners/ACLs, 49 public RLS tables, 29 capabilities, grants and audit records. The ledger increases from 25 to 26 only after success.
5. After database verification, release only the reviewed website delta through the existing production workflow: `assets/js/outreach-people.js`, `assets/js/outreach-registration-staff.js`, `assets/js/staff-outreach-partners.js`, `staff-people.html`. Keep Theme Song, public registration, giving links, protected systems and all unrelated files unchanged.
6. Check signed-out denial, public-route preservation and expected financial/permission denials. Real-account acceptance and role activation require their own approval. No real participant edits or tests that create live registrations are implied.

Before database commit, the migration is atomic and must roll back fully on failure. After commit, keep the stronger database security; do not restore financial leakage or remove audit kinds. An authorized website rollback restores the captured immutable deployment only. Role containment uses the independent audited assignment path and verifies stale-session denial; it must not delete immutable history.

## Validation and boundaries

`npm test --prefix tools/backend-tests` includes both dual-organization security and Outreach-only/Church-member scope tests. `test:operations-native`, `test:operations-member-native` and `test:operations-browser` provide native PostgreSQL and offline browser validation. These use fictional local data, never hosted credentials. Successful local/CI tests do not establish hosted identity or provider acceptance.

Existing owner reporting can be granted independently through the current campaign-scoped view/export model. It needs no security migration, full Outreach launch or broad staff administrator assignment. Exact personal identities, dates, invitation drafts and reviewed execution SQL remain in private owner-controlled evidence, outside this repository and public build.
