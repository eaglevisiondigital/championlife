import { fingerprint } from "../outreach-partner-submit/gateway.mjs";
const message =
  "Could not complete this form request. Check your response and try again.";
export function createFormsHandler(config, fetcher = fetch) {
  const origins = new Set(config.origins || []),
    dummy = /^[123]x0+AA$/.test(config.turnstileSecret || "");
  const ready =
    /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url || "") &&
    !!config.serviceKey &&
    (config.pepper || "").length >= 32 &&
    !!config.turnstileSecret &&
    origins.size > 0 &&
    (config.hostnames || []).length > 0 &&
    [...origins].every((o) => {
      try {
        return new URL(o).origin === o && o.startsWith("https://");
      } catch {
        return false;
      }
    }) &&
    (!dummy ||
      (config.mode === "acceptance" &&
        config.url === "https://bkbmjisprwmkptywtmih.supabase.co"));
  return async (req) => {
    const origin = req.headers.get("origin"),
      headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
      reply = (status, data) =>
        new Response(JSON.stringify(data), { status, headers });
    if (!origins.has(origin)) return reply(403, { accepted: false, message });
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, apikey, x-client-info",
    });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, { accepted: false, message });
    if (!ready) return reply(503, { accepted: false, message });
    if (
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
        req.headers.get("content-type") || "",
      )
    )
      return reply(415, { accepted: false, message });
    let reader, timer;
    try {
      if (!req.body) throw Error("body");
      reader = req.body.getReader();
      let bytes = 0,
        parts = [];
      const read = async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 125000) throw Error("size");
          parts.push(value);
        }
        const data = new Uint8Array(bytes);
        let i = 0;
        for (const p of parts) {
          data.set(p, i);
          i += p.length;
        }
        return JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(data),
        );
      };
      const input = await Promise.race([
        read(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("timeout")), 5000);
        }),
      ]);
      clearTimeout(timer);
      if (
        !input ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (k) =>
            ![
              "action",
              "organization",
              "slug",
              "payload",
              "turnstile_token",
              "bot_field",
            ].includes(k),
        ) ||
        !["submit", "reserve_file"].includes(input.action) ||
        !/^[a-f0-9-]{36}$/.test(input.organization || "") ||
        !/^[a-z0-9][a-z0-9-]{2,79}$/.test(input.slug || "") ||
        !input.payload ||
        Array.isArray(input.payload) ||
        input.bot_field ||
        typeof input.turnstile_token !== "string" ||
        !input.turnstile_token ||
        input.turnstile_token.length > 2048
      )
        throw Error("input");
      const network = await fingerprint(req.headers, config.pepper),
        challenge = await fetcher(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: config.turnstileSecret,
              response: input.turnstile_token,
            }),
            signal: AbortSignal.timeout(4000),
          },
        );
      if (!challenge.ok) throw Error("challenge");
      const v = await challenge.json(),
        acceptanceDummy =
          dummy &&
          input.turnstile_token === "XXXX.DUMMY.TOKEN.XXXX" &&
          v.metadata?.result_with_testing_key === true &&
          v.hostname === "example.com" &&
          v.action === undefined;
      if (
        v.success !== true ||
        (!acceptanceDummy &&
          (v.action !== "forms_submit" ||
            !config.hostnames.includes(v.hostname)))
      )
        return reply(400, { accepted: false, message });
      const h = {
        "Content-Type": "application/json",
        apikey: config.serviceKey,
        Authorization: "Bearer " + config.serviceKey,
      };
      // Separate committed quota call: failed validation cannot roll back network accounting.
      const quota = await fetcher(config.url + "/rest/v1/rpc/forms_gateway", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          p_action: "rate",
          p_org: input.organization,
          p_slug: input.slug,
          p_payload: {},
          p_network: network,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!quota.ok) throw Error("quota");
      const allowed = await quota.json();
      if (allowed.accepted !== true)
        return reply(allowed.reason === "rate" ? 429 : 400, {
          accepted: false,
          message,
        });
      const r = await fetcher(config.url + "/rest/v1/rpc/forms_gateway", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          p_action: input.action,
          p_org: input.organization,
          p_slug: input.slug,
          p_payload: input.payload,
          p_network: network,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw Error("database");
      const result = await r.json();
      if (result?.accepted !== true)
        return reply(result?.reason === "rate" ? 429 : 400, {
          accepted: false,
          message,
        });
      if (input.action === "reserve_file") {
        if (
          result.bucket !== "platform-form-files" ||
          !new RegExp("^" + input.organization + "/[a-f0-9-]{36}$").test(
            result.path || "",
          ) ||
          !/^[a-f0-9-]{36}$/.test(result.id || "")
        )
          throw Error("file");
        const signed = await fetcher(
          config.url +
            "/storage/v1/object/upload/sign/platform-form-files/" +
            result.path,
          {
            method: "POST",
            headers: h,
            body: JSON.stringify({ upsert: false }),
            signal: AbortSignal.timeout(4000),
          },
        );
        if (!signed.ok) throw Error("storage");
        const data = await signed.json(),
          path = data.url || data.signedURL;
        if (
          typeof path !== "string" ||
          !path.startsWith("/object/upload/sign/platform-form-files/")
        )
          throw Error("signed path");
        return reply(200, {
          accepted: true,
          id: result.id,
          upload_url: config.url + "/storage/v1" + path,
        });
      }
      if (
        !/^F-[A-F0-9]{32}$/.test(result.reference || "") ||
        !["none", "provider_not_configured"].includes(result.payment_status)
      )
        throw Error("result");
      return reply(200, {
        accepted: true,
        reference: result.reference,
        payment_status: result.payment_status,
      });
    } catch {
      return reply(400, { accepted: false, message });
    } finally {
      clearTimeout(timer);
      if (reader) {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
  };
}
