import {
  ACCEPTANCE,
  createNmiAdapter,
  inputOnly,
  NmiFailure,
} from "../_shared/payments/nmi.mjs";
const uuid = (v) =>
  typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(v);
export function createNmiHandler(
  config,
  fetcher = fetch,
  readSecret = (_key) => "",
) {
  const origins = new Set(config.origins || []);
  return async (request) => {
    const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
      origin = request.headers.get("Origin");
    const reply = (status, data) =>
      new Response(JSON.stringify(data), { status, headers });
    if (
      !origin ||
      !origins.has(origin) ||
      !/^https:\/\/[a-z0-9-]+--championlifechurch\.netlify\.app$/.test(origin)
    )
      return reply(403, { error: "Sandbox access unavailable." });
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization,apikey,content-type,x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return reply(405, { error: "Sandbox access unavailable." });
    if (
      config.project !== ACCEPTANCE ||
      config.enabled !== true ||
      !config.serviceKey ||
      !config.publicKey
    )
      return reply(503, { error: "Sandbox processing is held." });
    let claim, input;
    const rpc = async (name, action, org, payload, bearer) => {
      const key = bearer ? config.publicKey : config.serviceKey;
      const res = await fetcher(config.project + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: bearer || "Bearer " + key,
        },
        body: JSON.stringify({
          p_action: action,
          p_org: org,
          p_payload: payload,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new NmiFailure("configuration_error", "failed");
      return res.json();
    };
    try {
      if (Number(request.headers.get("Content-Length")) > 1500)
        return reply(400, { error: "Invalid sandbox request." });
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { error: "Invalid sandbox request." });
      let length = 0,
        parts = [];
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 1500) {
          await reader.cancel();
          return reply(400, { error: "Invalid sandbox request." });
        }
        parts.push(chunk.value);
      }
      const combined = new Uint8Array(length);
      let at = 0;
      for (const part of parts) {
        combined.set(part, at);
        at += part.length;
      }
      const raw = new TextDecoder().decode(combined);
      input = inputOnly(JSON.parse(raw), [
        "organization_id",
        "session_id",
        "leg_id",
        "operation",
        "request_key",
        "method_id",
        "refund_id",
        "instruction_id",
        "plan_reference",
        "payment_token",
        "save_method",
      ]);
      if (
        !["organization_id", "session_id", "leg_id", "request_key"].every((k) =>
          uuid(input[k]),
        )
      )
        return reply(400, { error: "Invalid sandbox request." });
      if (
        ["method_id", "refund_id", "instruction_id"].some(
          (k) => input[k] !== undefined && !uuid(input[k]),
        )
      )
        return reply(400, { error: "Invalid sandbox request." });
      if (
        input.save_method !== undefined &&
        typeof input.save_method !== "boolean"
      )
        return reply(400, { error: "Invalid sandbox request." });
      if (
        input.payment_token !== undefined &&
        (typeof input.payment_token !== "string" ||
          !/^[A-Za-z0-9_-]{8,256}$/.test(input.payment_token) ||
          /^\d{13,19}$/.test(input.payment_token))
      )
        return reply(400, { error: "Invalid sandbox request." });
      const bearer = request.headers.get("Authorization");
      if (!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer || ""))
        return reply(401, { error: "Sign in to the sandbox checkout." });
      const auth = await fetcher(config.project + "/auth/v1/user", {
        headers: { apikey: config.publicKey, Authorization: bearer },
        signal: AbortSignal.timeout(5000),
      });
      if (!auth.ok)
        return reply(401, { error: "Sign in to the sandbox checkout." });
      const user = await auth.json();
      if (!uuid(user.id) || !user.email_confirmed_at || user.is_anonymous)
        return reply(403, { error: "Sandbox access unavailable." });
      const { payment_token, save_method, organization_id, ...intent } = input;
      intent.save_method = save_method === true;
      const prepared = await rpc(
        "payments_nmi_workspace",
        "prepare",
        organization_id,
        intent,
        bearer,
      );
      claim = await rpc("payments_nmi_service", "claim", organization_id, {
        id: prepared.id,
        actor_id: user.id,
      });
      if (!claim.claimed)
        return reply(409, {
          id: prepared.id,
          status: claim.state,
          retry_automatically: false,
          message:
            "This sandbox attempt already exists. Review its status before another attempt.",
        });
      const adapter = createNmiAdapter({
        config: {
          ...config,
          organization_id,
          gateway_id: claim.scope.gateway_id,
        },
        scope: claim.scope,
        readSecret,
        fetcher,
      });
      // Validate credentials and exact operation input BEFORE marking network handoff, without logging.
      const { credential } = await import("../_shared/payments/nmi.mjs");
      credential(
        { ...config, organization_id, gateway_id: claim.scope.gateway_id },
        claim.scope,
        readSecret,
      );
      claim = await rpc("payments_nmi_service", "handoff", organization_id, {
        id: prepared.id,
        actor_id: user.id,
        lease: claim.lease,
      });
      const op = claim.operation;
      let params;
      const method = claim.vault_reference
        ? {
            vault_reference: claim.vault_reference,
            initial_transaction_id: claim.initial_transaction_id,
            initiated_by: "customer",
          }
        : { payment_token };
      if (["sale", "authorize"].includes(op))
        params = {
          amount_minor: claim.amount_minor,
          method,
          save_method: claim.save_method === true,
        };
      else if (op === "create_customer")
        params = { payment_token, customer_id: claim.customer_id };
      else if (["capture", "refund"].includes(op))
        params = {
          transaction_reference: claim.transaction_reference,
          amount_minor: claim.amount_minor,
        };
      else if (["void", "retrieve_transaction"].includes(op))
        params = { transaction_reference: claim.transaction_reference };
      else if (op === "create_recurring_profile")
        params = {
          plan_id: claim.plan_reference,
          method,
          start_date: claim.start_date,
        };
      else if (op === "update_recurring_profile")
        params = {
          subscription_reference: claim.subscription_reference,
          amount_minor: claim.amount_minor,
          start_date: claim.start_date,
        };
      else if (op === "cancel_recurring_profile")
        params = { subscription_reference: claim.subscription_reference };
      else throw new NmiFailure("configuration_error", "failed");
      let outcome;
      try {
        outcome = await adapter[op](params);
      } catch (e) {
        outcome = {
          status: e instanceof NmiFailure ? e.status : "review",
          category: e instanceof NmiFailure ? e.category : "unknown",
        };
      }
      // Secret/token variables exist only in this request's memory. No raw response, lookup data or PAN/CVV reaches RPC.
      const safe = { id: prepared.id, lease: claim.lease };
      for (const k of [
        "status",
        "category",
        "provider_reference",
        "customer_reference",
        "last4",
        "brand",
        "amount_minor",
      ])
        if (outcome[k] !== undefined) safe[k] = outcome[k];
      const result = await rpc(
        "payments_nmi_service",
        "complete",
        organization_id,
        safe,
      );
      return reply(200, {
        ...result,
        message:
          outcome.status === "review"
            ? "The sandbox outcome requires reconciliation. Do not retry."
            : outcome.status === "failed"
              ? "The sandbox payment was not completed."
              : "Sandbox operation recorded.",
        retry_automatically: false,
      });
    } catch {
      // Failure after claimed/dispatched remains non-retryable and may require reconciliation; never expose exception/body.
      return reply(claim?.claimed ? 409 : 403, {
        error: claim?.claimed
          ? "Sandbox outcome requires review. Do not retry blindly."
          : "Sandbox access unavailable.",
        status: claim?.claimed ? "review" : "held",
        retry_automatically: false,
      });
    }
  };
}
