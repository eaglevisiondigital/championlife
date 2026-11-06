# NMI Query response structure — source-only correction

The accepted PR78 Query parser could extract a valid-looking transaction from an invalid XML document. A response with an unclosed second transaction or mismatched wrapper still became `authoritative: true`. It also searched descendant fields: the documented nested `product/amount` could replace the transaction total. A fictional product price of 25.00 alongside a successful sale action of 50.00 was projected as 2500 minor units. These are parser failures, not observations about a real provider response.

The existing `nmi-query.mjs` now validates the complete bounded document before projecting any transaction. Scalar lookups bind to direct children of their transaction or action; nested product fields and unrelated metadata cannot supply payment identity, totals, status, refunds or batch fields. Duplicate projected scalars, malformed nesting and mixed container content fail closed. Unrecognized conditions remain `review`, including names inherited from JavaScript's object prototype. Existing exact amount, currency, processor and order/reference checks remain in place.

This is a restricted parser for the documented transaction response shape, not a general XML implementation. It accepts one `nm_response`, direct `transaction` elements, ordinary element text, empty elements, the five predefined named entities and an optional XML 1.0/UTF-8 declaration. It requires exact XML whitespace between structural elements. Attributes, namespaces, comments, CDATA, numeric/custom entities, DTDs, additional processing instructions and unsupported root children are held as UNKNOWN. The existing 1 MiB response and 100-transaction limits remain; depth and node limits bound temporary parsing. Invalid UTF-8 fails instead of silently substituting characters. Nothing fetches an entity or external schema.

The parser returns only the existing financial projection. Raw response content, product/customer information and parser errors are not persisted or exposed. Its temporary document tree does not establish source authenticity. The existing pinned transport, independently reviewed merchant/settlement binding and durable operation authority still supply that boundary.

## Local validation

- `node --test tools/backend-tests/nmi-query-structure.test.mjs` exercises whole-document rejection, direct-parent fields, product totals, duplicate scalars, encoding, XML whitespace, unknown conditions, transaction/batch lookup and the actual executor with injected fictional responses.
- `node tools/backend-tests/nmi-query-structure.native.mjs` exercises the actual executor against the existing native PostgreSQL ledger. Only a valid matching total can post; malformed XML, nested product-total mismatch and unsupported status remain UNKNOWN with no false receipt and no repeated charge.
- `node tools/backend-tests/nmi-query.test.mjs` preserves the original Query/recovery regression.

Native tests use disposable Unix-socket PostgreSQL and fictional local control rows. Application checkout remains false; the only injected provider operation is read-only Query. No real provider, customer, credential, payment, hosted SQL or migration is involved. Original baseline failures and intermediate harness/review findings are retained in the private audit workspace.

The correction is stacked on exact PR78 source `b59e1afcbe2978d16e27883750ce20adb7d3a23d`. PR73's existing dependency pins remain unchanged until separately reconciled to an independently accepted successor. Four-MID legal recipient/settlement/receipt requirements, SowGo/Soul Fuel separation, guest giving, existing GiveHub and recurring operations remain unchanged. No activation, automatic charge/retry, release or installation is authorized. Genuine provider acceptance and independent finance/custody approval remain separate gates.

References checked: [NMI Classic Query API transaction response](https://docs.nmi.com/reference/query), including its nested product and action fields; [W3C XML document and whitespace rules](https://www.w3.org/TR/xml/#sec-well-formed). No new provider capability is inferred from this local source correction.
