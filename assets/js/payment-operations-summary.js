/* Compact current-permission finance/leadership summaries. No donor or payment-method data. */
(() => {
  "use strict";
  const A = window.ChampionLifeAuth,
    E = window.OutreachUI?.el,
    host = document.querySelector("#giving-app,#giving-reports-app");
  if (!A || !E || !host) return;
  const box = E("section", null, {
    class: "giving-panel",
    "aria-label": "Payment operations alerts",
  });
  host.after(box);
  let sequence = 0;
  async function refresh() {
    const seq = ++sequence;
    box.replaceChildren();
    try {
      const user = await A.getUser();
      if (!user) return;
      const context = await A.client.rpc("payment_operations", {
        p_action: "context",
        p_org: null,
        p_payload: {},
      });
      if (seq !== sequence) return;
      const requested = new URLSearchParams(location.search).get(
          "organization",
        ),
        scope =
          context.data?.organizations?.find((o) => o.id === requested) ||
          (!requested ? context.data?.organizations?.[0] : null);
      if (!scope) return;
      const r = await A.client.rpc("payment_operations", {
        p_action: "summary",
        p_org: scope.id,
        p_payload: {},
      });
      if (seq !== sequence || r.error || (await A.getUser())?.id !== user.id)
        return;
      box.append(E("h2", "Payment Issues Needing Attention — " + scope.name));
      for (const [title, key] of [
        ["Failed Payments", "payment_failed"],
        ["Partial Payments", "partial_checkout"],
        ["Settlement Exceptions", "settlement_mismatch"],
        ["Refunds Awaiting Review", "refund_pending"],
        ["Unreconciled Settlements", "unreconciled"],
      ])
        box.append(E("p", title + ": " + (r.data?.[key] || 0)));
      if (scope.permissions.includes("payments.view"))
        box.append(
          E("a", "Open Payment Operations", {
            class: "giving-button",
            href:
              "staff-payment-operations.html?organization=" +
              encodeURIComponent(scope.id),
          }),
        );
    } catch {
      box.replaceChildren();
    }
  }
  window.addEventListener("focus", refresh);
  window.addEventListener("staff-workspace-context", refresh);
  A.client.auth.onAuthStateChange(() => {
    sequence++;
    box.replaceChildren();
    refresh();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, 15000);
  refresh();
})();
