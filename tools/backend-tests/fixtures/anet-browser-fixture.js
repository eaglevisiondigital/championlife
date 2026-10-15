// Disconnected synthetic QA only. Never included in the public manifest.
(() => {
  const s = window.paymentsFixture;
  s.configuration.gateways = s.configuration.gateways.filter(
    (g) => g.provider === "authorize_net",
  );
  s.configuration.routes = s.configuration.routes.filter((r) =>
    r.gateway_id.startsWith("AN-"),
  );
  s.configuration.destinations.forEach((d, i) => {
    d.gateway_id = "AN-" + i;
    d.route_id = "AN-MID-" + i;
  });
  s.detail.lines.splice(2, 1);
  s.detail.legs.splice(2, 1);
  s.detail.legs.forEach((l, i) => {
    l.provider = "authorize_net";
    l.gateway_label = "Authorize.Net " + ["Main", "Youth", "Merch"][i];
    l.route_label = ["Main", "Youth", "Merch"][i];
  });
  s.detail.session.total_minor = "28500";
  s.detail.receipt.total_minor = "28500";
  s.detail.receipt.charitable_minor = "25000";
  s.configuration.sessions[0].total_minor = "28500";
  s.methods[0].last4 = "1111";
  s.methods[0].gateway_count = 3;
  document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("payments-app");
    if (root?.dataset.view !== "checkout") return;
    let mounted = false;
    const mount = () => {
      if (
        mounted ||
        !root.querySelector("h1") ||
        !root.querySelector("table") ||
        !window.AuthorizeNetHosted
      )
        return;
      mounted = true;
      observer.disconnect();
      const h = window.AuthorizeNetHosted.mount(root, {
        enabled: true,
        gateway_id: "AN-0",
        checkAccess: async () => !s.deny,
        createSession: async () => ({
          status: "tokenized",
          environment: "sandbox",
          gateway_id: "AN-0",
          form_url: "https://test.authorize.net/payment/payment",
          form_token: "mock_only_hosted_form_token_123456",
          expires_in_seconds: 900,
        }),
        handoff: async () => {
          root.querySelector(".anet-hosted-panel [role=status]").textContent =
            "MOCK ONLY — hosted handoff simulated. No Authorize.Net page loaded, no provider request and no payment.";
        },
      });
      const note = document.createElement("p");
      note.textContent =
        "DISCONNECTED BUILD QA — provider component is mocked. No credentials or card data.";
      root.querySelector(".anet-hosted-panel").prepend(note);
    };
    const observer = new MutationObserver(mount);
    observer.observe(root, { childList: true, subtree: true });
    mount();
  });
})();
