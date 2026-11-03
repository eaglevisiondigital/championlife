# Isolated worksheet transaction compatibility

The source-only CAS adapter now reads and saves the approved worksheet structures for all13 lessons through the existing `owned_worksheet_transaction` RPC. Before this correction it rejected valid Lessons5–13 before making a request because its imported contract supported only Lessons1–4 with20 questions.

`worksheet-contracts.mjs` derives immutable response identifiers directly from the unchanged approved Lesson5–13 JSON catalogs. Lessons1–4 retain20 questions; Lessons5–13 have10,7,7,6,5,5,4,3,4 response groups respectively. The adapter checks the exact lesson, worksheet discriminator for5–13, question identifiers and receipt counts. Equal-sized worksheets cannot substitute for one another. Raw answers returned by the existing RPC never enter the adapter's outward projection. Saved answers grant neither viewing nor completion credit.

The existing explicit isolated-project requirement, verified caller identity, captured bearer, fresh authorization, navigation/session invalidation, opaque revision CAS, disabled automatic retries and uncertain-write handling remain intact. No backend, schema, grants, public UI, course content or media changed. The old raw-table observational reader remains deliberately limited to1–4. The canonical catalogs use JSON module imports; isolated browser hosts must serve these JSON files with `application/json`. No new package or SDK dependency is introduced.

Local tests exercise the real pinned Supabase2.118.0 client in Chromium/WebKit with intercepted fictional Auth/HTTP and the accepted RPC migrations in disposable native PostgreSQL. Neither is genuine provider acceptance. The existing source CI also runs the new native adapter composition test.

## Remaining boundaries

This adapter is not mounted in the public application and does not install any migration. Required source migration order remains the accepted worksheet transaction, progression snapshot, existing completion preparation, Lesson5, Lessons6–8, then Lessons9–13 extensions; their source guards remain unchanged. Completion evaluator and trusted completion SQL still support only1–4; the existing playback envelope is limited to1–10. Videos11–13, required multipart6/8/9 bindings, trustworthy observer acceptance, finite retention and operational recovery remain separate release gates. All adapter receipts retain `canComplete:false` and `canCommit:false`.
