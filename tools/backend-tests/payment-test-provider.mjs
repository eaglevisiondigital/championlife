// Deterministic offline test double. This file is excluded from the public/server production artifact.
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  safeInput,
  minor,
  normalizeError,
  compatibleToken,
  operations,
} from "../../supabase/functions/_shared/payments/providers.mjs";
export function testProvider({ scenario = "success" } = {}) {
  const journal = new Map();
  let calls = 0;
  const api = {
    mode: "synthetic_non_network",
    networkCalls: () => 0,
    calls: () => calls,
  };
  for (const operation of operations)
    api[operation] = async (input) => {
      safeInput(input);
      if (operation === "normalize_error") return normalizeError(input);
      if (operation === "verify_webhook") {
        const expected = createHmac("sha256", "synthetic-local-key")
          .update(input.body)
          .digest("hex");
        const a = Buffer.from(expected),
          b = Buffer.from(input.signature || "");
        return { verified: a.length === b.length && timingSafeEqual(a, b) };
      }
      if (
        !input?.request_key ||
        !input.gateway_id ||
        !input.organization_id ||
        !input.route_id ||
        input.environment !== "sandbox"
      )
        throw Error("Synthetic scoped operation required");
      if (input.amount_minor !== undefined) minor(input.amount_minor);
      if (input.token && !compatibleToken(input.token, input))
        throw Error("Token scope mismatch");
      const key = [
        input.organization_id,
        input.gateway_id,
        input.route_id,
        operation,
        input.request_key,
      ].join(":");
      const digest = JSON.stringify(input);
      if (journal.has(key)) {
        const old = journal.get(key);
        if (old.digest !== digest) throw Error("Idempotency content mismatch");
        return old.answer;
      }
      calls++;
      let answer;
      if (scenario === "timeout")
        answer = {
          status: "review",
          failure_category: "unknown",
          retry_automatically: false,
        };
      else if (scenario === "decline")
        answer = {
          status: "failed",
          failure_category: "declined",
          retry_automatically: false,
        };
      else if (operation === "create_tokenization_session")
        answer = {
          status: "tokenized",
          widget_enabled: false,
          token_reference: "synth:opaque:" + input.gateway_id,
        };
      else if (operation === "authorize")
        answer = {
          status: "authorized",
          provider_reference: "synth:authorization:" + input.request_key,
        };
      else if (operation === "void")
        answer = {
          status: "voided",
          provider_reference: "synth:void:" + input.request_key,
        };
      else if (operation === "refund")
        answer = {
          status: input.partial ? "partially_refunded" : "refunded",
          provider_reference: "synth:refund:" + input.request_key,
        };
      else if (operation.includes("recurring"))
        answer = {
          status: "created",
          provider_reference: "synth:schedule:" + input.request_key,
        };
      else
        answer = {
          status: "captured",
          provider_reference: "synth:transaction:" + input.request_key,
        };
      journal.set(key, { digest, answer });
      return answer;
    };
  return api;
}
