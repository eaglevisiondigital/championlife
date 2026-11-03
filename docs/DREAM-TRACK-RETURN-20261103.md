# Dream Track return journey — local source correction

The existing edge guard preserves a requested route, but both the access page and
code-check handler previously rejected clean numbered URLs such as
`/dream-track-2` and `/dream-track-6/`. A successful code entry therefore opened
the overview rather than the requested step. The old expression also accepted
nonexistent numbered destinations such as `/dream-track-99.html`.

Both existing return checks now accept only the overview and existing steps 1–7,
normalizing their `.html`, extensionless and trailing-slash spellings to the actual
`.html` source pages. Exact full-string matching prevents newline suffixes. The
browser parses its query once; neither layer decodes the return value again.
Absolute/external, query/fragment-bearing, encoded-separator and unavailable
routes fall back to the overview. A failed code entry preserves the canonical
step for retry. Direct POSTs are independently checked by the existing handler.

No access code, cookie, gate, edge guard, content, artwork, shared script,
registration, identity, course completion or provider configuration changes.
This shared course-content gate is not individual identity verification and
confers no membership, staff access or course completion.

`node tools/backend-tests/dream-track-return.browser.mjs` exercises the actual
local edge and function source through a temporary loopback HTTPS server, using
an ephemeral self-signed test certificate and randomly generated fictional code.
Chromium/WebKit run at 390px and 1440px with external traffic blocked. It covers
requested step → access form → rejected code → retry → accepted code → requested
existing step, plus direct handler and browser return-path negative cases.
No certificate validation exception is added to application code; only the local
test browser trusts its own ephemeral server. Test certificate files are removed.

Reproduction mode `EXPECT_BROKEN=1` is only for the original uncorrected runtime;
it records incorrect destinations and does not claim security acceptance.
Original reproduction: 194 assertions passed while documenting 28 incorrect
return destinations. Corrected acceptance and independent review are recorded in
the private audit packet. All tests use fictional local authentication; genuine
Netlify routing/function acceptance requires separate release authorization.
No hosted resources, messages, grants, migrations or deployment are authorized.
