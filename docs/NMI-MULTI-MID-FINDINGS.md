# NMI multi-MID findings — build evidence versus provider evidence

Current stage: BUILD ONLY. GIV-3A architecture and its isolated hosted acceptance are accepted. No GIV-3B provider acceptance has started. No sandbox credentials or actual processor IDs have been supplied/configured in this build.

| Required provider question | Exact current finding |
|---|---|
| A — number of available processor IDs | NOT DISCOVERED. Zero actual NMI processor IDs configured; this is not a claim the account has zero processors. |
| B — explicit sale processor routing | Official v5 sale schema documents `processor_id`. Exact routing is implemented/tested against mocks; distinct actual processor acceptance NOT TESTED. |
| C — auth/capture routing | Auth documents processor selector; capture binds original payment ID. Actual two-route auth/capture NOT TESTED. |
| D — refund/void routing | Original payment/account/route is frozen; no undocumented override. Actual provider adjustments NOT TESTED. |
| E — vault reuse across processor IDs | NOT TESTABLE WITH CURRENT SANDBOX CONFIGURATION — credentials/processors unavailable and hosted gate unopened. Do not label supported or unsupported. |
| F — subscriptions by processor | Current v5 subscription schema does not expose processor selector. Code holds until actual default route/timezone/plan binding is verified; nondefault route remains held. Provider behavior NOT TESTED. |
| G — settlement by processor | Official batch events expose processor identity/gross/count; missing fields stay unknown. Actual delivery/data NOT TESTED. |
| H — webhook processor identification | Transaction and settlement documented samples include processor identifier. Actual signed sandbox deliveries NOT TESTED. |

Conceptual MAIN / YOUTH / OUTREACH / EVENTS / MERCH remain canonical route/fund/purpose mappings, independent from fund hierarchy. No real IDs are inferred, scraped or fabricated. Local fixtures use visibly `mock-*` values and are excluded from published files. A future sandbox with fewer processors must report PARTIAL provider multi-MID proof; architecture proof does not supply missing provider proof.

NMI's official package (1.1.1) uses shared secure tokenization hosts; its initialization `testMode`, merchant identity and supported currencies must match the reviewed sandbox configuration before card fields mount. No Collect.js fallback is used. The account's exact sandbox capabilities and any confirmed provider limitation can only be recorded after separately authorized hosted testing.

Full five-route and vault cross-route results remain gated. SowGo stays held without its own reviewed route; there is no fallback to Champion Life Main. Global live processing, real financial posting and GiveHub remain unchanged/off.
