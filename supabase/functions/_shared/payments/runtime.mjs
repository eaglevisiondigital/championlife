// Server-only foundation. Runtime bindings are scoped metadata, never browser configuration.
import { executionGate, providerContract, safeInput } from "./providers.mjs";
export function credentialReference({
  organization_id,
  gateway_id,
  environment,
  version,
}) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      organization_id,
    ) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      gateway_id,
    ) ||
    !["sandbox", "live"].includes(environment) ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    throw Error("Credential binding is invalid");
  return `payments/${organization_id}/${gateway_id}/${environment}/v${version}`;
}
export function resolveCredential(binding, scope, readRuntimeSecret) {
  if (
    binding.reference !== credentialReference(scope) ||
    binding.organization_id !== scope.organization_id ||
    binding.gateway_id !== scope.gateway_id ||
    binding.environment !== scope.environment ||
    binding.version !== scope.version
  )
    throw Error("Credential owner/account/environment/version mismatch");
  const key = `PAYMENTS_${scope.gateway_id.replaceAll("-", "").toUpperCase()}_${scope.environment.toUpperCase()}_V${scope.version}`;
  const secret = readRuntimeSecret(key);
  if (typeof secret !== "string" || secret.length < 12)
    throw Error("Credential missing");
  return secret;
}
export function credentialStatus(binding, scope, readRuntimeSecret) {
  try {
    resolveCredential(binding, scope, readRuntimeSecret);
    return { status: "Configured", environment: scope.environment };
  } catch {
    return {
      status: "Missing or invalid",
      environment: scope?.environment || null,
    };
  }
}
export async function processHeldOperation(
  client,
  { organization_id, operation_id },
) {
  safeInput({ organization_id, operation_id });
  const result = await client.rpc("payments_service", {
    p_action: "operation_claim",
    p_org: organization_id,
    p_payload: { id: operation_id },
  });
  if (result.error) throw Error("Provider operation unavailable.");
  const claim = result.data;
  if (!claim.claimed) return { status: "held", claimed: false };
  if (!executionGate({ ...claim.gate, stage_enabled: false }))
    return {
      status: "held",
      claimed: true,
      message: "Payment processing is not yet enabled.",
    };
  throw Error("GIV-3A has no execution transport.");
}
export async function verifyBoundWebhook(provider, { body, signature, scope }) {
  if (
    typeof body !== "string" ||
    new TextEncoder().encode(body).length > 262144
  )
    throw Error("Webhook body exceeds bound");
  safeInput(scope);
  return providerContract(provider).verify_webhook({ body, signature, scope });
}
