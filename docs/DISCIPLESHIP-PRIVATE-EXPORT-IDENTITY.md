# Existing private worksheet exports: current-account fence

Source-only successor to PR #76 at `537be527b86a1887eaf3fb457c0fe1b02033f0a3`.
The existing Lessons 1–4 Download Answers, Print and email-copy controls previously
trusted the account captured when the worksheet loaded. A missed Auth callback
could leave those controls exporting the former account's private answers.

Each existing export now verifies the same current verified principal, a fresh
unexpired local session, the exact Auth/client/helper references, view generation
and connected active form before reading private fields. A mismatch or verification
failure clears private state; retired asynchronous handlers cannot act on a newly
loaded account. Concurrent activations create one copy. Normal same-account print
and download remain available. Email-copy uses the same gate; tests exercise only
its denial path and do not open a mail client or send anything.

The correction changes no HTML, design, workbook questions, worksheet save/load,
backend ownership, RLS, consent, course completion or viewing evidence. All 13
worksheet routes and the distinct device-note storage remain unchanged. Lesson
activity is not proof of the 95% watch threshold or certification. Existing missing
videos, approved multipart bindings, trusted playback and retention decisions
remain independent release prerequisites.

Focused Chromium/WebKit tests use actual lesson pages and runtime with fictional
Auth and blocked external HTTP. Existing account/privacy regressions and two
reproducible builds preserve every public file except the corrected runtime.
The existing CI retains all prior test groups and adds the focused export group;
all groups must succeed at the exact reviewed PR head. These checks do not establish
genuine Supabase Auth, provider, hosted SQL or release acceptance.
