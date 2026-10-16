# Huntsville minimal release candidate

2026-10-16: local candidate on `codex/huntsville-minimal-production-package`, based exactly on production main `a9c8a73c228866749831f0df4236295c3791216f`. Accepted source `dba68735cd68ddfc00ddbc16109a01e2794027dc` used only for the registration slice. Two new forward migrations; 14 tables/22 functions; guarded disabled Huntsville draft. No inherited workflow seeds or production writes.

Local proof: 66 migration safety, 95 registration security, 56 Huntsville, 25 calendar DOM, 38 staff/public DOM, 29 gateway checks, existing baseline suite, six eight-worker native races and 389-file build pass. Local browser public submission/staff totals/check-in/responsive checks pass. This candidate has not been hosted. Real Turnstile/Auth/Edge/native-download and hosted race gate remain pending on an isolated exact 22+2 target. Recommendation NOT READY for controlled production release. Stop at review; no merge/deploy/activation/SowGo release.

See [dependency graph](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md) and [full release/containment plan](docs/HUNTSVILLE-MINIMAL-RELEASE.md). These docs describe only this isolated production-based candidate; unrelated draft systems are not imported.
