# Codex work order — Lane B: Champion Life / SowGo NMI readiness
Date: 2026-11-01. Dedicated branch. Exact starting source PR #64 @ 60f5577df5a6338b0298970855e4de8ae60bc1df.

## Immediate work
1. Review Champion Life Issue #32, master #58, NMI original #34, Shared Platform Gate 0 #36, strict-boolean #64 and the four-MID onboarding document.
2. Independently test the **default-disabled** NMI readiness/planner for missing, false, malformed, mixed and contradictory route approvals, four MID aliases / five logical routes, recipient/settlement mismatch, one-time pilot vs held recurring, replay/unknown outcomes, finance-owner controls. Prefer focused source+fixtures and verified CI.
3. Prepare a private owner-controlled checklist only; GitHub may contain safe aliases MID-01..MID-04 and VERIFIED/PENDING/UNAVAILABLE status, never actual MID, bank, EIN, processing secrets, credentials or contract scans.
4. Preserve **Soul Fuel under SowGo Outreach** and settle only to the legally boarded SowGo recipient/bank, with independent finance approval. Preserve working GiveHub and recurring payments until real acceptance.

## File ownership
Own ONLY tools/nmi/**, isolated NMI test workflow and lane-specific NMI docs; never modify staff shell, public manifest, real provider config, production secrets or migrations. Do not edit shared CURRENT_BUILD_STATE.md in this lane.

## Hard stops
0/4 MIDs independently verified in current reviewed evidence. Nov 2-3 is a forecast, not proof. All actual NMI checkout must remain disabled (canSubmit=false). No live/sandbox provider calls, paid resources, merges, deployments, real transactions or bank changes without distinct approval.
Deliver actual code/tests where feasible, a draft PR, exact-head CI evidence and the external merchant intake items. Do not claim a synthetic PASS as actual provider proof.
