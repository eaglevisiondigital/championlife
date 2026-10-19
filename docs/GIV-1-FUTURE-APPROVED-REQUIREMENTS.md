# GIV-1 requirements addendum — FUTURE APPROVED REQUIREMENTS

Approved directly by Dave on October 10, 2026. This records requirements for the upcoming Giving Dashboard, Reporting and Form Builder phases. It does **not** expand the current GIV-1 assignment, authorize GIV-2, redesign GIV-1, or claim these features are implemented, tested, deployed or approved for release.

The original GIV-1 assignment governs current implementation scope. Preserve GiveHub and existing giving links, organization/merchant boundaries, production and existing working systems. Architecture hooks may be considered only within that assignment; this addendum does not authorize building the future screens or form builder now.

## 1. Fund hierarchy

Giving funds must support a true hierarchy:

- standalone/top-level fund;
- parent fund;
- child/sub-fund beneath a parent;
- future deeper nesting only if architecture safely supports it.

Examples:

```text
MISSIONS
  Foreign Missions
  Local Missions

YOUTH
  Camp
  Events
  General Youth
```

Reporting must work at both the individual child fund level and the rolled-up parent fund level. Merchant/MID routing remains independent from fund hierarchy. These requirements do not turn reporting categories or tags into a substitute for the actual hierarchy, or authorize changing current routing/schema in this documentation task.

## 2. Finance Dashboard instant date filters

The future Giving Dashboard must support quick reporting buttons/filters for:

- Past 24 Hours;
- Today;
- Past 7 Days / Week;
- Month;
- Quarter;
- Semiannual;
- Annual / Year-to-Date.

Use canonical date/timezone-aware financial data. No hardcoded fake values. Exact rolling/calendar/fiscal period definitions remain part of the upcoming functional contract; this addendum does not silently choose them.

## 3. Comparison reporting

Future dashboard/reporting must support:

- Sunday-to-Sunday comparison;
- week-to-week comparison;
- month-to-month comparison;
- quarter comparison;
- year-to-date vs prior year where data exists.

Sunday comparison must use configurable church/service reporting boundaries, not assume universal calendar weeks. Missing prior data must not be replaced with invented financial results.

## 4. Dashboard charts

The future Giving Dashboard should provide:

- week-to-week giving trend;
- month-to-month giving comparison;
- fund/category trend;
- recurring vs one-time trend where useful.

Charts must use real canonical ledger data.

## 5. Finance management sidebar

The future Giving/Finance workspace must use the accepted shared Staff Workspace shell with a full expandable left navigation structure. Expected major areas may include:

- Giving Overview;
- Gifts;
- Donors;
- Funds;
- Pledges;
- Recurring Giving;
- Forms;
- Batches & Reconciliation;
- Reports;
- Statements;
- Merchant Configuration.

Permission-filter every section. Navigation visibility does not replace server authorization and does not grant any permission.

## 6. Custom form builder

The future Giving platform must include a reusable drag-and-drop form builder supporting:

- desktop editor/preview;
- mobile editor/preview;
- drag/reorder fields;
- custom sections;
- required/optional fields;
- giving/payment-enabled forms where authorized;
- registration/event forms where appropriate;
- reusable field types;
- conditional fields/rules;
- save draft;
- preview;
- publish/versioning.

Do not build the form builder inside GIV-1 unless required only for architecture hooks within its original assignment. Payment enablement and publication are not authorized by merely recording these requirements.

## 7. Broader Kingdom Propel analytics

Giving reporting must be designed so it can later feed a broader executive analytics layer combining:

- Giving;
- Visitors;
- Attendance;
- Classrooms / Kids;
- Check-In;
- Events;
- Outreach;
- Discipleship;
- other ministry KPIs.

Do not put all non-financial analytics inside the Giving Dashboard. Giving Dashboard remains finance-focused; future Kingdom Propel Executive Analytics provides cross-ministry reporting. This future integration does not authorize cross-organization data sharing or a product database merger.

## 8. Pastor / executive reporting

Architecture must support Pastor Roddy / authorized leadership eventually seeing fast executive metrics without granting unrestricted finance configuration authority.

Reporting permission must remain distinct from:

- merchant configuration;
- refunds;
- manual financial posting;
- staff administration.

No title, leadership role, dashboard visibility or requirement in this document grants a real account any authority. Exact permission implementation/provisioning remains separately scoped.

## 9. Documentation and phase boundary

These are **FUTURE APPROVED REQUIREMENTS**, linked from architecture, decisions, giving rollout and build-state documents. They are not a completed feature list or GIV-2 authorization.

Continue GIV-1 only under its original complete assignment. Do not begin GIV-2. Preserve the consolidated future functional/visual contract review before building Giving Dashboard / Reports / Forms UI. This documentation task changes no application code, migration, Auth, finance grant, giving link, merchant configuration, deployment or production data.

## 2026-10-11 phase authorization update

The original approved requirements above remain preserved. Chat subsequently accepted GIV-1 at `2eada4821e7b45a5f8221112a0982c36c33e9551` and explicitly authorized **GIV-2A build only**. Earlier “do not begin GIV-2” wording records the original addendum's historical gate; the complete later GIV-2A assignment now authorizes the scoped management UX. [GIV-2A](GIVING-GIV-2A-FINANCE-MANAGEMENT-UX.md) implements hierarchy management/rollups, timezone-aware quick periods, light month/service comparisons, eight-item finance navigation and report-only leadership separation. It does not authorize release. Full reporting/charts/statements/executive polish remain GIV-2B; the form builder remains GIV-2C; broader executive analytics remains separately scoped. Neither later package is started.
