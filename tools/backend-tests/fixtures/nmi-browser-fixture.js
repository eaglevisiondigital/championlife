// LOCAL MOCKED BUILD QA ONLY. Excluded from the public artifact. NO provider calls/card fields.
(() => {
  const org = "74000000-0000-4000-8000-000000000001",
    session = "91000000-0000-4000-8000-000000000090";
  const original = window.ChampionLifeAuth.client.rpc;
  window.ChampionLifeAuth.client.rpc = async (name, args) => {
    const scale = (r) => {
      if (r?.data?.session) {
        r = structuredClone(r);
        r.data.session.total_minor = "3850";
        for (const line of r.data.lines)
          line.amount_minor = (BigInt(line.amount_minor) / 10n).toString();
        for (const leg of r.data.legs)
          leg.amount_minor = (BigInt(leg.amount_minor) / 10n).toString();
        r.data.receipt.charitable_minor = "3500";
        r.data.receipt.non_charitable_minor = "350";
      }
      return r;
    };
    if (name !== "payments_nmi_workspace")
      return scale(await original(name, args));
    const r = scale(
      await original("payments_workspace", {
        p_action: "session",
        p_org: org,
        p_payload: { id: session },
      }),
    );
    return {
      data: {
        ...r.data,
        sandbox_ready: true,
        can_prepare: true,
        methods: [],
        attempts: [],
      },
    };
  };
  window.CHAMPION_NMI_SANDBOX = {
    project: "https://bkbmjisprwmkptywtmih.supabase.co",
    enabled: true,
    organization_id: org,
    environment: "sandbox",
    public_key: "xxxxxx-xxxxxx-xxxxxx-xxxxxx",
    merchant_reference: "mock-merchant",
  };
  window.NmiSandboxComponent = {
    createNmiToken: async () => ({
      testMode: true,
      merchantId: "mock-merchant",
      currencies: ["USD"],
    }),
    mountNmiPayments: (target, props) => {
      const note = document.createElement("p");
      note.textContent =
        "Disconnected build QA: NMI fields are NOT loaded; callbacks are simulated. No real provider evidence.";
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Simulate tokenization for build QA";
      b.onclick = () =>
        props.onChange({ complete: true, token: "synthetic_qa_token" });
      target.append(note, b);
      props.onFieldsAvailable();
      return {
        destroy() {
          target.replaceChildren();
        },
        resetFields() {},
      };
    },
  };
  window.ChampionLifeAuth.client.functions = {
    invoke: async () => ({ data: { id: "mock-canonical-attempt-build-only", status: "captured", sandbox_only: true } }),
  };
})();
