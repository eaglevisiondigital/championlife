# World English Bible public text

Local reader data from the official `https://ebible.org/Scriptures/engwebp_vpl.zip`, retrieved November 15, 2026. [Rights](https://ebible.org/engwebp/copyright.htm): public domain; “World English Bible” is a trademark. Verse text is not rewritten. This Protestant edition contains 66 books and 1,189 chapters. Source empty verse records remain in JSON and are omitted in visible prose without renumbering later verses.

`PROVENANCE.json` pins the archive, original verse text and each generated book file. `index.json` supplies navigation. The reader loads fixed same-origin public data per book. Browser-managed same-origin cookies may accompany the request so an isolated protected host can authorize its static assets; the reader does not read credentials or add member bearer tokens. Redirects are rejected, with no third-party request or cross-origin credential forwarding. These files remain excluded from the main website's production manifest with the rest of this local package.

To reproduce from the exact reviewed archive (no network step in the script):

```sh
python3 tools/live-worship/prepare-scripture.py /path/to/engwebp_vpl.zip
node --test tools/live-worship/layout.test.mjs
```

The preparation script checks the archive hash and reads only `engwebp_vpl.txt`; it never extracts or executes the archive's SQL, HTML or signature file. Updating the upstream package requires a new pin and review. The final production translation/rights and host configuration remain explicit release decisions.
