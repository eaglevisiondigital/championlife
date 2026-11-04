# Disabled NMI session-error privacy correction — November 4, 2026

The unmounted giving client at reviewed PR #73 `14ca8303100e21fbbdcf91295961304bd14f2c80` checked current identity after successful JSON parsing, but transport/JSON errors escaped that check. Without an Auth callback, a changed account could retain the previous receipt and status control. The final successful session read also omitted an expiry check.

The existing client now validates session expiry on every session read and applies the same captured identity, configuration, generation and client-boundary check before returning asynchronous failures. An identity change or expiry produces the existing `SESSION_CHANGED` result so the unchanged giving page clears its protected content. Ordinary same-account network uncertainty retains status-only recovery, with no automatic payment retry. Guest capability behavior and existing GiveHub fallbacks are preserved.

Permanent intercepted Chromium/WebKit tests cover 390/1440 widths, failed transport, failed JSON, expired successful responses and expired failed responses. Each negative case retains the old status handler and verifies that it issues no further request after retirement. Baseline reproduction is available with `--error-fence-reproduction`; focused correction checks use `--error-fence-only`. The full existing browser suite remains enabled in the existing CI job.

Local result: 32 assertions reproduced the original defect; 64 new assertions passed after correction; 430 total affected browser assertions passed. Two deterministic public builds contain exactly the same public bytes as the accepted parent; both NMI runtime assets remain outside the public allowlist and no hosted payment configuration is enabled. These tests use fictional intercepted transport, not real Auth or processor acceptance.

No migration, provider, merchant, settlement, payment API, recurring behavior, real token or production file is changed. Actual four-MID merchant/settlement evidence, provider acceptance, custody and separate activation approval remain required. Native checkout remains disabled and GiveHub unchanged.
