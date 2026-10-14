import {
  ACCEPTANCE,
  verifyNmiWebhook,
  webhookProjection,
  NmiFailure,
} from "../_shared/payments/nmi.mjs";
export function createNmiWebhook(
  config,
  readSecret = (_key) => "",
  fetcher = fetch,
) {
  return async (req) => {
    const reply = (status, v) =>
      new Response(JSON.stringify(v), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    if (req.method !== "POST") return reply(405, { accepted: false });
    if (
      config.project !== ACCEPTANCE ||
      config.enabled !== true ||
      !/^[a-f0-9-]{36}$/.test(config.organization_id || "") ||
      !/^[a-f0-9-]{36}$/.test(config.gateway_id || "") ||
      !config.serviceKey
    )
      return reply(503, { accepted: false });
    try {
      const reader = req.body?.getReader();
      if (!reader) return reply(403, { accepted: false });
      let bytes = 0,
        parts = [];
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        bytes += r.value.length;
        if (bytes > 262144) {
          await reader.cancel();
          return reply(413, { accepted: false });
        }
        parts.push(r.value);
      }
      const joined = new Uint8Array(bytes);
      let offset = 0;
      for (const p of parts) {
        joined.set(p, offset);
        offset += p.length;
      }
      const raw = new TextDecoder().decode(joined);
      const secret = readSecret(
        "PAYMENTS_" +
          config.gateway_id.replaceAll("-", "").toUpperCase() +
          "_SANDBOX_WEBHOOK_V1",
      );
      if (
        !(await verifyNmiWebhook(
          raw,
          req.headers.get("Webhook-Signature"),
          secret,
        ))
      )
        return reply(403, { accepted: false });
      const event = webhookProjection(raw);
      if (event.merchant_reference !== config.merchant_reference)
        return reply(403, { accepted: false });
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", joined)),
        (x) => x.toString(16).padStart(2, "0"),
      ).join("");
      const res = await fetcher(
        config.project + "/rest/v1/rpc/payments_nmi_service",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.serviceKey,
            Authorization: "Bearer " + config.serviceKey,
          },
          body: JSON.stringify({
            p_action: "webhook",
            p_org: config.organization_id,
            p_payload: { gateway_id: config.gateway_id, ...event, digest },
          }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok)
        return reply(res.status === 409 ? 409 : 403, { accepted: false });
      return reply(200, { accepted: true });
    } catch {
      return reply(403, { accepted: false });
    }
  };
}
