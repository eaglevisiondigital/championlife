import assert from "node:assert/strict";
import { createFormsHandler } from "../../supabase/functions/forms-submit/gateway.mjs";
import { createFileHandler } from "../../supabase/functions/forms-file-access/gateway.mjs";
let n = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  n++;
  console.log("PASS " + m);
};
const org = "87000000-0000-4000-8000-000000000001",
  id = "87000000-0000-4000-8000-000000000002",
  origin = "https://acceptance.example.test";
const cfg = {
  url: "https://bkbmjisprwmkptywtmih.supabase.co",
  serviceKey: "synthetic-service",
  publicKey: "synthetic-public",
  pepper: "synthetic-".repeat(5),
  turnstileSecret: "1x0000000000000000000000000000000AA",
  origins: [origin],
  hostnames: ["acceptance.example.test"],
  mode: "acceptance",
};
const input = {
  action: "submit",
  organization: org,
  slug: "synthetic-form",
  payload: { request_key: id, version_id: id, answers: {} },
  turnstile_token: "XXXX.DUMMY.TOKEN.XXXX",
  bot_field: "",
};
const req = (body = input, extra = {}) =>
  new Request("https://gateway.example.test", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "cf-connecting-ip": "192.0.2.23",
      ...extra,
    },
    body: JSON.stringify(body),
  });
const response = (x) =>
  new Response(JSON.stringify(x), {
    headers: { "content-type": "application/json" },
  });
let calls = [];
const fetcher = async (url, args) => {
  calls.push([url, args]);
  if (url.includes("siteverify"))
    return response({
      success: true,
      hostname: "example.com",
      metadata: { result_with_testing_key: true },
    });
  if (url.includes("/rpc/forms_gateway"))
    return response(
      input.action === "x"
        ? {}
        : {
            accepted: true,
            reference: "F-" + "A".repeat(32),
            payment_status: "provider_not_configured",
          },
    );
  throw Error("unexpected");
};
const handler = createFormsHandler(cfg, fetcher);
const passed = await handler(req());
ok(
  passed.status === 200 &&
    (await passed.json()).payment_status === "provider_not_configured",
  "verified service gateway returns safe held reference",
);
const submitted = JSON.parse(
  calls.find(([url]) => url.includes("/rpc/forms_gateway"))[1].body,
);
ok(
  /^[a-f0-9]{64}$/.test(submitted.p_network) &&
    !JSON.stringify(submitted).includes("192.0.2.23"),
  "network HMAC instead of raw address",
);
ok(
  passed.headers.get("access-control-allow-origin") === origin &&
    passed.headers.get("cache-control") === "no-store",
  "exact CORS + no cache",
);
for (const [body, headers, label] of [
  [input, { origin: "https://evil.example" }, "foreign origin"],
  [{ ...input, bot_field: "bot" }, {}, "honeypot"],
  [{ ...input, action: "admin" }, {}, "unsupported action"],
  [{ ...input, organization: "production" }, {}, "invalid tenant"],
  [{ ...input, secret: "x" }, {}, "unknown fields"],
  [{ ...input, turnstile_token: "" }, {}, "missing challenge"],
  [
    input,
    { "cf-connecting-ip": "", "x-forwarded-for": "192.0.2.1" },
    "untrusted XFF",
  ],
])
  ok(
    (await handler(req(body, headers))).status >= 400,
    "gateway denies " + label,
  );
ok(
  (await createFormsHandler({ ...cfg, serviceKey: "" }, fetcher)(req()))
    .status === 503,
  "unconfigured service fails closed",
);
ok(
  (
    await createFormsHandler(
      { ...cfg, url: "https://exdocjbmylgxssanymjk.supabase.co" },
      fetcher,
    )(req())
  ).status === 503,
  "dummy challenge never production",
);
ok(
  (
    await createFormsHandler(cfg, async () =>
      response({
        success: true,
        hostname: "evil.example",
        action: "forms_submit",
      }),
    )(req({ ...input, turnstile_token: "real-looking" }))
  ).status === 400,
  "challenge wrong hostname",
);
let fileCalls = [];
const fileHandler = createFileHandler(cfg, async (url, args) => {
  fileCalls.push([url, args]);
  if (url.includes("/rpc/forms_workspace"))
    return response({
      bucket: "platform-form-files",
      path: org + "/" + id,
      filename: "synthetic.pdf",
    });
  if (url.includes("/object/sign/"))
    return response({
      signedURL:
        "/object/sign/platform-form-files/" +
        org +
        "/" +
        id +
        "?token=synthetic-temporary",
    });
  throw Error("unexpected");
});
const fileRequest = (authorization = "Bearer synthetic-user") =>
  new Request("https://gateway.example.test", {
    method: "POST",
    headers: { origin, authorization, "content-type": "application/json" },
    body: JSON.stringify({
      organization: org,
      form: id,
      submission: id,
      file: id,
    }),
  });
const fileResult = await fileHandler(fileRequest());
ok(fileResult.status === 200, "file authorization signs exact allowed object");
ok(
  fileCalls[0][1].headers.Authorization === "Bearer synthetic-user",
  "file permission read runs as user, not service",
);
ok(
  JSON.parse(fileCalls[1][1].body).expiresIn === 60,
  "private file URL expires in 60 seconds",
);
ok(
  (await fileHandler(fileRequest(""))).status === 403,
  "missing identity cannot download",
);
const denied = createFileHandler(
  cfg,
  async () => new Response("{}", { status: 403 }),
);
ok(
  (await denied(fileRequest())).status === 403,
  "revoked current permission prevents signing",
);
ok(
  !JSON.stringify(await (await denied(fileRequest())).json()).includes(
    "synthetic-service",
  ),
  "safe errors contain no service credential",
);
console.log(n + " Forms gateway/security checks passed");
