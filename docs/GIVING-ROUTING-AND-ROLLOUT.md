# Separate giving destinations and controlled rollout

Dave confirmed September 25, 2026: keep every existing giving link in place. Do not replace checkout until the new system is tested and approved.

## Required account mapping

| Giving purpose | Owning organization | Planned checkout | Authorize.Net gateway and merchant account |
| --- | --- | --- | --- |
| Outreach giving | SowGo | SowGo checkout | SowGo's separate Authorize.Net account and merchant account |
| Church giving forms | Champion Life | Champion Life online checkout | Champion Life Church's separate Authorize.Net account and merchant account |

Website placement does not determine financial ownership. An outreach form displayed on championlifefwb.com must retain the SowGo financial owner. A shared account or donor identity does not combine either organization's receipts, settlements, refunds, statements or financial staff access. Do not route outreach through the church account merely because the page is on the church domain. There must be no fallback from an unavailable destination to the other organization's account.

## Built in this phase

`giving_destinations` stores two draft destination plans, derived from the existing organization IDs. These records are non-secret labels, not connected merchant accounts and not verification of actual gateway/merchant ownership. No gateway login, transaction key, signature key, card data, bank data or checkout URL is stored here.

`giving_funds` holds organization-owned designations. `giving_form_routes` maps permanent form keys to funds and destinations through composite organization/destination foreign keys. Cross-organization routing and a fund from a different destination are rejected. Existing records cannot be moved to a different organization or merchant destination through browser writes. A route may be draft or archived; there is no live state. Destination rollout state is constrained to draft.

Giving setup in the staff workspace provides destination plans, fund creation/editing/archive/restore, draft form-route configuration, scoped fund search, routing preview and recent change history. The preview explicitly states that processing is disabled. These are form routing plans, not published giving forms or the future general forms builder.

Reads require finance.read. Configuration writes require a verified account with finance.read, finance.configure and staff.manage for the same organization. finance.configure depends on finance.read and may be delegated only by an administrator who holds it. Holding staff.manage alone does not reveal giving setup. Holding finance.configure without staff.manage does not authorize changes. Initial real finance administrators still require the explicitly approved provisioning process.

## Integration design for the next stage

Future server checkout resolution must start with an authoritative published form identifier. Resolve its organization, fund and verified merchant connection on the server. Do not trust a client-submitted organization, merchant account, destination or charge total. Reject unavailable or ambiguous mappings instead of silently falling back to another account.

Keep gateway credentials in server-side secret storage, separately bound to organization, destination and environment. Do not put credentials in the public configuration tables, frontend, GitHub, ordinary audit payloads or this document. Sandbox credentials and production credentials must remain separate. Authorize.Net documents merchant authentication using the account's API Login ID and Transaction Key; Accept Hosted token requests include that merchant authentication. The correct gateway credentials therefore select the intended gateway account. The actual association between that gateway and the intended merchant/settlement account must also be verified before launch.

Scope provider transaction IDs, customer/payment profile IDs, recurring subscriptions, webhook verification credentials, refunds and reconciliation to the same account/environment. Never assume provider IDs are portable between the two accounts. Verify webhook signatures and authoritative transaction state server-side. Browser redirects or client success messages are not proof of payment.

Fund labels do not establish tax deductibility. Ledger entry types, DAF treatment, refunds/corrections and statement rules remain governed by the previously approved giving requirements. No payment, donor balance, receipt or statement is produced by this configuration phase.

## Before any checkout replacement

1. Confirm each actual Authorize.Net account is connected to its intended merchant account and settlement destination.
2. Configure isolated sandbox connections and verify that church forms resolve only to the church test connection and outreach forms only to the outreach test connection.
3. Test guest giving, optional registration, verified historical-gift claims and account ownership conflicts.
4. Verify declined/canceled/duplicate payments, duplicate/out-of-order notifications, timeouts, retries, refunds and reconciliation with no duplicate gifts.
5. Verify receipts and annual statements stay with the correct organization and only authorized finance staff or the verified donor can view them.
6. Complete browser/device and real-account acceptance, approve the exact replacement links/forms, and obtain Dave's go-live approval before changing the existing links.

Until those gates are complete, all public giving links stay as they are. This phase does not create a charge endpoint, replace links, call Authorize.Net, install a webhook, connect merchant accounts or enable payment processing.

## Official technical references reviewed

- Account-specific authentication: https://developer.authorize.net/support/common-setup-questions.html
- Accept Hosted token and form flow: https://developer.authorize.net/api/reference/features/accept-hosted.html
- API authentication and separate sandbox/production endpoints: https://developer.authorize.net/api/reference/index.html

These sources establish the integration mechanism. The account mapping and rollout requirements above come from Dave, not from the provider documentation.
