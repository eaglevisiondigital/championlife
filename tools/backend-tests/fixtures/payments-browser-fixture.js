// Local disconnected synthetic QA ONLY. Not included in the deploy artifact.
(() => {
  const org = "74000000-0000-4000-8000-000000000001",
    id = "91000000-0000-4000-8000-000000000090",
    per = [
      "payments.view",
      "payments.configure",
      "payments.route",
      "payments.refund",
      "payments.void",
      "payments.recurring.manage",
      "payments.provider.activate",
    ];
  const names = ["Main Giving", "Youth", "Outreach", "Events", "Merch"];
  const gateways = [
    {
      id: "NMI",
      provider: "nmi",
      label: "NMI Gateway",
      environment: "sandbox",
      enabled: false,
      status: "missing",
      credential_status: "Missing",
      last_verified: null,
      capabilities: ["sale", "recurring"],
    },
    ...names.map((label, i) => ({
      id: "AN-" + i,
      provider: "authorize_net",
      label: "Authorize.Net " + label,
      environment: "sandbox",
      enabled: false,
      credential_status: "Missing",
      capabilities: ["authorize", "capture"],
    })),
  ];
  const routes = [
    ...names.map((label, i) => ({
      id: "MID-" + i,
      gateway_id: "NMI",
      label,
      currency: "USD",
      country: "US",
      environment: "sandbox",
      enabled: false,
      capabilities: ["sale", "refund"],
    })),
    ...names.map((label, i) => ({
      id: "AN-MID-" + i,
      gateway_id: "AN-" + i,
      label: label + " account route",
      currency: "USD",
      country: "US",
      environment: "sandbox",
      enabled: false,
      capabilities: [],
    })),
  ];
  const destinations = names.map((label, i) => ({
    id: "dest-" + i,
    label: "Champion Life " + label,
    gateway_id: "NMI",
    route_id: "MID-" + i,
    currency: "USD",
    revision: 1,
  }));
  const funds = names
    .slice(0, 3)
    .map((name, i) => ({
      id: "fund-" + i,
      name,
      destination_id: "dest-" + i,
      tax_eligible: true,
    }));
  const lines = [
    {
      amount_minor: "20000",
      purpose: "charitable_contribution",
      fund: "Tithe",
      merchant: "Main Giving",
      tax_eligible: true,
    },
    {
      amount_minor: "5000",
      purpose: "charitable_contribution",
      fund: "Youth",
      merchant: "Youth",
      tax_eligible: true,
    },
    {
      amount_minor: "10000",
      purpose: "charitable_contribution",
      fund: "Outreach",
      merchant: "Outreach",
      tax_eligible: true,
    },
    {
      amount_minor: "3500",
      purpose: "merchandise",
      fund: null,
      merchant: "Merch",
      tax_eligible: false,
    },
  ];
  const legs = lines.map((l, i) => ({
    id: "leg-" + i,
    amount_minor: l.amount_minor,
    status: "created",
    provider: "nmi",
    gateway_label: "NMI Gateway",
    route_label: ["Main Giving", "Youth", "Outreach", "Merch"][i],
    gate: { execution_allowed: false },
  }));
  const configuration = {
    gateways,
    routes,
    destinations,
    funds,
    sessions: [
      { id, total_minor: "38500", currency: "USD", status: "pending" },
    ],
    global_enabled: false,
  };
  const detail = {
    session: {
      id,
      person_id: "synthetic-donor",
      currency: "USD",
      total_minor: "38500",
      status: "pending",
      anonymous: false,
    },
    lines,
    legs,
    receipt: {
      state: "preview_held",
      date: "2026-10-14T12:00:00Z",
      reference: id,
      total_minor: "38500",
      payment_method_summary: "Not selected — processing held",
      charitable_minor: "35000",
      non_charitable_minor: "3500",
      delivery: "held",
    },
    checkout: {
      recurring_choice: "once",
      receipt_email: "synthetic@example.test",
    },
    message: "Payment processing is not yet enabled.",
  };
  const methods = [
    {
      id: "logical-method",
      person_id: "synthetic-donor",
      brand: "Visa",
      last4: "4242",
      status: "held",
      gateway_count: 2,
    },
  ];
  const state = (window.paymentsFixture = {
    org,
    id,
    per,
    configuration,
    detail,
    methods,
    calls: [],
    deny: false,
    user: { id: "synthetic-user", email: "payments@example.test" },
    delayAction: null,
    failAction: null,
  });
  const authHandlers = [];
  window.ChampionLifeAuth = {
    enabled: true,
    getUser: async () => state.user,
    client: {
      auth: {
        onAuthStateChange(fn) {
          authHandlers.push(fn);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
      rpc: async (name, args = {}) => {
        state.calls.push({ name, args });
        if (args.p_action === state.delayAction)
          await new Promise((resolve) => {
            state.release = resolve;
          });
        if(name==='shared_platform_context')return{data:{staff:{organizations:[{id:org,name:'Synthetic Church'}],grants:[]},modules:['payments'],giving:{organizations:[]},payments:{organizations:state.deny?[]:[{id:org,name:'Synthetic Church',permissions:[...state.per]}]},forms:{organizations:[]},communications:{organizations:[],campaigns:[]},outreach:{contexts:state.deny?[]:['champion'],campaigns:[],role_label:'Synthetic payments',access_version:state.deny?'revoked':'active'},decisions:[],partners:[]}};
        if (name === "staff_workspace_context") return { data: { grants: [] } };
        if (!name.startsWith("payments_"))
          return {
            data: args.p_action === "context" ? { organizations: [] } : [],
          };
        if (args.p_action === "context")
          return {
            data: {
              organizations: state.deny
                ? []
                : [
                    {
                      id: org,
                      name: "Champion Life · SYNTHETIC",
                      permissions: [...state.per],
                    },
                  ],
            },
          };
        if (state.deny) return { error: { code: "42501" } };
        if (args.p_action === state.failAction)
          return { error: { code: "PT409" } };
        if (args.p_action === "configuration") return { data: configuration };
        if (args.p_action === "session" || args.p_action === "form_checkout")
          return { data: detail };
        if (args.p_action === "methods") return { data: { methods } };
        if (args.p_action === "activation_request")
          return {
            data: {
              enabled: false,
              message:
                "Provider activation requires a separately authorized release.",
            },
          };
        if (args.p_action === "gateway_create") {
          const g = {
            ...gateways[0],
            id: "created-gateway",
            label: args.p_payload.label,
            provider: args.p_payload.provider,
            environment: args.p_payload.environment,
          };
          gateways.push(g);
          return { data: { id: g.id, enabled: false } };
        }
        if (args.p_action === "method_remove") {
          methods.splice(0, methods.length);
          return { data: { status: "removed" } };
        }
        return { data: { id: "synthetic-prepared", execution: "held" } };
      },
    },
  };
  state.signOut = () => {
    state.user = null;
    authHandlers.forEach((fn) => fn("SIGNED_OUT", null));
  };
  if (!window.__PAYMENTS_DOM_TEST__)
    document.addEventListener("DOMContentLoaded", () => {
      const aside = document.createElement("aside");
      aside.className = "giving-panel";
      aside.setAttribute("aria-label", "Disconnected synthetic QA");
      const text = document.createElement("p");
      text.textContent =
        "SYNTHETIC disconnected build QA. No real credentials, records, provider calls or payments.";
      const revoke = document.createElement("button");
      revoke.textContent = "Revoke synthetic payment access";
      revoke.onclick = () => {
        state.deny = true;
        window.StaffWorkspace?.refresh();
        window.dispatchEvent(new Event("focus"));
      };
      aside.append(text, revoke);
      document.body.append(aside);
    });
})();
