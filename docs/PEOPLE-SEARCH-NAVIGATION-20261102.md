# People search and return navigation

Source-only correction on the existing shared Church/Outreach People workspace. No schema, identity linking, permissions, staff-shell, registration, follow-up mutation, branding or payment changes.

## User-visible behavior

A staff member searching the People list can press Enter or select Search. Opening a contact and returning with Back to People preserves the active filter and current page. A newly submitted query starts on the first page.

Previously, Enter did nothing because the search controls were a div rather than a form. Back to People implicitly called an empty search while retaining the previous page number, unexpectedly replacing the filtered results with an unfiltered later page. Chromium and WebKit reproduced both problems at mobile and desktop dimensions.

The filter exists only in this module's memory, alongside its current page. It is cleared on organization change, account change, logout, explicit access denial and the shared shell's protected-clear event. Existing shell pagehide/history restoration already clears protected state and requires a reload; those shared controls are unchanged. No search text or person identifiers are added to storage or URLs.

The native search form checks its navigation generation, attached workspace membership and pending state before submitting. Existing permission refresh, authenticated session checks, scoped People RPC and database authorization remain authoritative. Search still sends only the existing `search` and `page` payload to `people_workspace` with the authorized organization. No registration is converted to a Person, member or decision record by this change.

## Verification

`node tools/outreach/people-navigation.browser.mjs` runs the actual People runtime in Chromium/WebKit against fictional intercepted RPC responses. It covers Enter and button search, filtered later page → detail → Back, fresh query paging, organization/account changes, delayed old-account responses, logout, permission denial and protected-clear retained forms. It verifies zero mutation requests. The existing `outreach-people.dom.mjs` verifies manage/read-only/revoked/signed-out/wrong-organization behavior, including the unchanged follow-up update boundary.

No genuine provider login or production acceptance is claimed. PR61 remains frozen and all genuine Auth/recovery/release gates remain separate. This increment is intended solely as a reviewed successor to the existing draft Outreach source stack.
