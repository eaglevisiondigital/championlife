/* GIV-3B optional checkout integration: NMI hosted fields, token-only app boundary. */
(() => {
  "use strict";
  const E = window.OutreachUI?.el,
    root = document.getElementById("payments-app");
  if (!E || !root) return;
  let generation = 0,
    widget,
    panel,
    busy = false,
    token = null,
    lastDetail;
  const dispose = () => {
    generation++;
    token = null;
    busy = false;
    lastDetail = null;
    widget?.destroy();
    widget = null;
    panel?.remove();
    panel = null;
  };
  const observer = new MutationObserver(() => {
    if (panel && !root.contains(panel)) dispose();
  });
  observer.observe(root, { childList: true, subtree: true });
  const config = () => window.CHAMPION_NMI_SANDBOX;
  const rpc = async (action, org, payload) => {
    const r = await window.ChampionLifeAuth.client.rpc(
      "payments_nmi_workspace",
      { p_action: action, p_org: org, p_payload: payload },
    );
    if (r.error) throw Error("Sandbox access unavailable.");
    return r.data;
  };
  let sdkPromise;
  const loadSDK = () => {
    if (window.NmiSandboxComponent)
      return Promise.resolve(window.NmiSandboxComponent);
    return (sdkPromise ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "assets/js/nmi-component.js";
      script.onload = () =>
        window.NmiSandboxComponent
          ? resolve(window.NmiSandboxComponent)
          : reject(Error("component"));
      script.onerror = () => reject(Error("component"));
      document.head.append(script);
    }));
  };
  async function mount(detail) {
    dispose();
    const epoch = generation,
      c = config();
    if (
      !c ||
      c.project !== "https://bkbmjisprwmkptywtmih.supabase.co" ||
      c.environment !== "sandbox" ||
      c.enabled !== true ||
      c.organization_id !== detail.organization_id
    )
      return;
    if (
      !/^https:\/\/[a-z0-9-]+--championlifechurch\.netlify\.app$/.test(
        location.origin,
      )
    )
      return;
    try {
      const data = await rpc("session", detail.organization_id, {
        session_id: detail.session_id,
      });
      if (epoch !== generation) return;
      lastDetail = detail;
      panel = E("section", null, {
        class: "giving-panel nmi-sandbox-panel",
        "aria-label": "NMI sandbox checkout",
      });
      const notice = E("h2", "SANDBOX / TEST ONLY"),
        status = E("p", "Loading secure payment fields…", {
          role: "status",
          "aria-live": "polite",
        }),
        container = E("div", null, { class: "nmi-hosted-fields" }),
        select = E("select", null, { id: "nmi-sandbox-leg" }),
        label = E("label", "Sandbox transaction leg", {
          for: "nmi-sandbox-leg",
        }),
        submit = E("button", "Process sandbox payment", {
          type: "button",
          disabled: "",
          class: "giving-button giving-primary",
        });
      const methods = E("select", null, { id: "nmi-sandbox-method" }),
        methodLabel = E("label", "Payment method", {
          for: "nmi-sandbox-method",
        });
      methods.append(
        E("option", "New payment method in NMI secure fields", { value: "" }),
      );
      for (const m of data.methods || [])
        methods.append(
          E("option", m.brand + " ending " + m.last4, { value: m.id }),
        );
      for (const l of data.legs)
        select.append(
          E(
            "option",
            (l.route_label || "Original route") +
              " · " +
              window.GivingUtils.money(l.amount_minor, data.session.currency),
            { value: l.id },
          ),
        );
      const save = E("input", null, {
          type: "checkbox",
          id: "nmi-save-sandbox",
        }),
        saveLabel = E("label", "Save this sandbox payment method", {
          for: "nmi-save-sandbox",
        });
      panel.append(
        notice,
        E(
          "p",
          "Only official test payment methods. No real money, donor receipt or live giving change.",
        ),
        label,
        select,
        methodLabel,
        methods,
        save,
        saveLabel,
        container,
        status,
        submit,
      );
      root.append(panel);
      if (data.sandbox_ready !== true || data.can_prepare !== true)
        throw Error(
          "This sandbox checkout is held until account and route verification.",
        );
      const SDK = await loadSDK();
      if (epoch !== generation) return;
      const initialized = await SDK.createNmiToken(c.public_key);
      if (epoch !== generation) return;
      if (
        initialized.testMode !== true ||
        initialized.merchantId !== c.merchant_reference ||
        !Array.isArray(initialized.currencies) ||
        !initialized.currencies.includes(data.session.currency)
      )
        throw Error("Sandbox merchant verification unavailable.");
      const existing = (l) =>
        data.attempts?.find(
          (a) =>
            a.leg_id === l &&
            ["sale", "authorize"].includes(a.operation) &&
            a.state !== "failed",
        );
      let complete = false;
      const keys = new Map();
      const update = () => {
        submit.disabled =
          busy || (!methods.value && !complete) || !!existing(select.value);
      };
      select.onchange = () => {
        container.hidden = !!methods.value;
        token = null;
        complete = false;
        widget?.resetFields();
        status.textContent = existing(select.value)
          ? "Existing sandbox attempt requires reconciliation. Do not retry."
          : "Complete the secure payment fields.";
        update();
      };
      methods.onchange = () => {
        token = null;
        complete = false;
        widget?.resetFields();
        container.hidden = !!methods.value;
        update();
      };
      widget = SDK.mountNmiPayments(container, {
        tokenizationKey: c.public_key,
        layout: "multiLine",
        paymentMethods: ["card"],
        appearance: {},
        onFieldsAvailable: () => {
          if (epoch !== generation) return;
          status.textContent = "Secure NMI sandbox fields ready.";
        },
        onChange: (event) => {
          if (epoch !== generation || busy) return;
          complete =
            event.complete === true &&
            typeof event.token === "string" &&
            /^[A-Za-z0-9_-]{8,256}$/.test(event.token);
          token = complete ? event.token : null;
          status.textContent = complete
            ? "Tokenization complete. Ready for sandbox processing."
            : "Complete the secure payment fields.";
          update();
        },
      });
      submit.onclick = async () => {
        if (busy || submit.disabled || epoch !== generation) return;
        busy = true;
        update();
        status.textContent = "Processing sandbox payment…";
        const leg = select.value;
        let request_key = keys.get(leg);
        if (!request_key) {
          request_key = crypto.randomUUID();
          keys.set(leg, request_key);
        }
        const currentToken = token;
        token = null;
        complete = false;
        try {
          const result = await window.ChampionLifeAuth.client.functions.invoke(
            "payments-nmi",
            {
              body: {
                organization_id: detail.organization_id,
                session_id: detail.session_id,
                leg_id: leg,
                operation: "sale",
                request_key,
                ...(methods.value
                  ? { method_id: methods.value }
                  : { payment_token: currentToken, save_method: save.checked }),
              },
            },
          );
          if (epoch !== generation) return;
          const outcome = result.data;
          if (result.error || !outcome) throw Error("unknown");
          const text =
            {
              authorized: "Sandbox authorization recorded; no settled gift.",
              captured: "Sandbox payment captured; settlement pending.",
              settled: "Sandbox payment settled.",
              failed: "Sandbox payment declined or unavailable.",
              review:
                "Unknown sandbox outcome. Reconcile before another attempt.",
            }[outcome.status] || "Sandbox operation requires review.";
          let savedSummary;
          if (save.checked && outcome.method_id) {
            try {
              const refreshed = await rpc("session", detail.organization_id, {
                session_id: detail.session_id,
              });
              if (epoch !== generation) return;
              savedSummary = refreshed.methods?.find(
                (m) => m.id === outcome.method_id,
              );
              if (
                savedSummary &&
                !data.methods.some((m) => m.id === savedSummary.id)
              ) {
                data.methods.push(savedSummary);
                methods.append(
                  E(
                    "option",
                    savedSummary.brand + " ending " + savedSummary.last4,
                    { value: savedSummary.id },
                  ),
                );
              }
            } catch {
              /* Safe summary unavailable; do not misstate an already recorded outcome. */
            }
          }
          const current = data.legs.find((l) => l.id === leg);
          if (current) current.status = outcome.status;
          const succeeded = data.legs.filter((l) =>
            ["captured", "settled"].includes(l.status),
          );
          status.textContent =
            text +
            (succeeded.length < data.legs.length
              ? " Checkout remains partial or under review."
              : " All sandbox legs captured; no real payment.");
          const receipt = E("section", null, {
            "aria-label": "Sandbox receipt",
          });
          receipt.append(
            E("h3", "Sandbox receipt — test only"),
            E("p", "Session " + data.session.id),
            E("p", "Sandbox transaction reference: " + outcome.id),
            E(
              "p",
              "Intended checkout total: " +
                window.GivingUtils.money(
                  data.session.total_minor,
                  data.session.currency,
                ),
            ),
            E(
              "p",
              "Sandbox captured total: " +
                window.GivingUtils.money(
                  succeeded
                    .reduce((sum, l) => sum + BigInt(l.amount_minor), 0n)
                    .toString(),
                  data.session.currency,
                ),
            ),
          );
          for (const line of data.lines)
            receipt.append(
              E(
                "p",
                (line.fund || "Payment purpose") +
                  " · " +
                  window.GivingUtils.money(
                    line.amount_minor,
                    data.session.currency,
                  ) +
                  " · " +
                  (line.tax_eligible
                    ? "Charitable contribution"
                    : "Non-charitable payment"),
              ),
            );
          receipt.append(
            E(
              "p",
              methods.value
                ? methods.selectedOptions[0].textContent
                : savedSummary
                  ? savedSummary.brand + " ending " + savedSummary.last4
                  : save.checked
                    ? "Payment method summary pending verification."
                    : "No payment method saved.",
            ),
            E(
              "p",
              "No tax statement or receipt email is issued. Partial or unknown outcomes require review.",
            ),
          );
          panel.querySelector('[aria-label="Sandbox receipt"]')?.remove();
          panel.append(receipt);
          const i = data.attempts?.find((a) => a.leg_id === leg);
          if (i) i.state = outcome.status === "failed" ? "failed" : "review";
          else
            (data.attempts ??= []).push({
              leg_id: leg,
              operation: "sale",
              state: outcome.status === "failed" ? "failed" : "review",
            });
          if (outcome.status !== "failed") container.hidden = true;
          else keys.delete(leg); // A normalized known failure may start a new deliberate attempt.
          widget?.resetFields();
        } catch {
          if (epoch !== generation) return;
          status.textContent =
            "Unknown sandbox outcome. Reconcile before another attempt.";
          (data.attempts ??= []).push({
            leg_id: leg,
            operation: "sale",
            state: "review",
          });
          container.hidden = true;
        } finally {
          if (epoch === generation) {
            busy = false;
            update();
          }
        }
      };
    } catch {
      if (epoch !== generation) return;
      if (panel) {
        const s = panel.querySelector('[role="status"]');
        if (s)
          s.textContent =
            "NMI sandbox checkout is held. Account, credentials and processor verification are required.";
        panel.querySelectorAll("button").forEach((b) => (b.disabled = true));
      }
      disposeWidget();
    }
  }
  function disposeWidget() {
    token = null;
    widget?.destroy();
    widget = null;
  }
  async function checkCurrentAccess() {
    if (!panel || !lastDetail) return;
    const epoch = generation,
      detail = lastDetail;
    try {
      const current = await rpc("session", detail.organization_id, {
        session_id: detail.session_id,
      });
      if (epoch !== generation) return;
      if (current.can_prepare !== true || current.sandbox_ready !== true)
        dispose();
    } catch {
      if (epoch === generation) dispose();
    }
  }
  window.addEventListener("focus", checkCurrentAccess);
  window.addEventListener("staff-workspace-context", checkCurrentAccess);
  setInterval(() => {
    if (document.visibilityState === "visible") checkCurrentAccess();
  }, 20000);
  window.addEventListener("payments-session-rendered", (e) => mount(e.detail));
  window.ChampionLifeAuth?.client?.auth?.onAuthStateChange((event) => {
    if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")
      checkCurrentAccess();
    else dispose();
  });
  window.addEventListener("pagehide", dispose);
})();
