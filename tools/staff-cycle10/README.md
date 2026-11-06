# Legacy Forms / WebKit observation

This is a bounded diagnostic for the unresolved Linux run42279599893/job128104797278. It does not fix application code or change error acceptance. `legacy.browser.mjs` preserves the original Cycle8 journey, fixtures, source loader and classifier, selecting only its WebKit390 Forms case. The loader still uses original PR98 Forms and exact PR97 session; `HOST_SOURCE_ROOT` changes only the shared shell. The current corrected Forms assets are not silently substituted.

Run:

```sh
node tools/staff-cycle10/verify-legacy.mjs
node --test tools/staff-cycle10/observer.test.mjs
HOST_SOURCE_ROOT="$PWD" DIAGNOSTIC_DIR=/absolute/private/output \
  SUPABASE_SDK_PATH=/absolute/path/to/accepted-sdk.js \
  node tools/staff-cycle10/legacy.browser.mjs
```

The real SDK must have SHA256 `bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`. CI uses existing Playwright1.62.1 dependencies. Local runs may set `PLAYWRIGHT_MODULE` to an existing installation's `index.mjs` without modifying dependency files. All HTTP is fulfilled by the existing fictional fixture or the exact selected source; no provider is contacted.

`verify-legacy.mjs` checks four immutable legacy input hashes and reconstructs all eight permitted driver adaptations. Every original assertion, journey ordering and error predicate remains unchanged. The observer adds no fetch wrapper, Auth call, header, response delay, cancellation, navigation, or runtime replacement. Route forwarding preserves the original arguments and return promise. A passive promise observer records fulfillment resolution/rejection without changing that promise; rejection metadata uses fixed categories rather than raw messages.

The JSON artifact `DIAGNOSTIC_DIR/legacy-observations.json` is written on page close and process exit, including assertion failure. It contains up to5000 timestamped events: request IDs, HTTP method/action, fictional principal and fixture-actor labels, frame/document epochs, lifecycle document IDs, intended and observed HTTP status, allowlisted CORS headers, fulfillment completion, requestfinished/requestfailed, and browser errors. Request/response bodies, authorization, API keys and cookies are not recorded. Existing browser error and console-error text remains diagnostic text from these fixed fictional URLs; this is not a general credential-redaction service. Overflow is explicit and makes causal interpretation incomplete.

A requestfinished event is distinct from an HTTP success status or a cancelled request. Lifecycle correlation alone does not prove cancellation or root cause. There is no retry loop, diagnostic suppression, expanded classifier or rerun-for-green behavior. A pass without the original error is non-reproduction. The previous failed CI and original evidence remain authoritative historical results. Hosted Auth/RLS/provider acceptance and release are outside this diagnostic.
