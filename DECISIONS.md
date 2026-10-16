# Huntsville isolation decisions — 2026-10-16

1. Start from exact current main rather than merging PR #24 ancestry. Preserve all 22 historical migrations byte-for-byte.
2. Add two forward-only migrations: required registration foundation and guarded fresh disabled Huntsville draft. Do not depend on an acceptance draft or silently update a conflict.
3. Keep accepted registration/waiver/check-in semantics and exact legal/public files. Remove template/opportunity coupling and restrict capabilities/events to registration. Retain dormant participant identity solely for the accepted check-in/reversal dependency; exclude all prize operations.
4. Replace the staff page's broad campaign assignment-list call with a registration-admin-only read action. Use a scoped shell and the current production staff return route instead of importing unpublished navigation.
5. Prove baseline+candidate locally with real independent PostgreSQL races. Earlier broader-stack hosted acceptance is not re-labeled as minimal-stack hosted evidence. No production readiness claim until the outstanding exact-stack hosted gate passes.
6. No production deployment, merge, grants, messages, payment activation or SowGo routing change is authorized by these successful tests. Stop for review.

[Exact dependency reasoning](docs/HUNTSVILLE-MINIMAL-DEPENDENCIES.md) · [Forward release and containment](docs/HUNTSVILLE-MINIMAL-RELEASE.md)
