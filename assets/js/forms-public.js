(async function () {
  "use strict";
  const root = document.getElementById("public-form-app"),
    R = window.FormsRenderer,
    el = R.el,
    client = window.ChampionLifeAuth?.client,
    q = new URLSearchParams(location.search),
    // Internal hosting rewrites leave the clean URL visible to the browser.
    publicPath = location.pathname.match(
      /^\/forms\/([a-f0-9-]{36})\/([a-z0-9][a-z0-9-]{2,79})\/?$/,
    ),
    org = q.get("organization") || publicPath?.[1],
    slug = q.get("slug") || publicPath?.[2];
  const key = crypto.randomUUID();
  let token = "",
    widget = null;
  function unavailable() {
    root.replaceChildren(
      el("section", "This form is not currently accepting responses.", {
        class: "public-form-header",
        role: "status",
      }),
    );
  }
  async function challenge() {
    if (
      !window.turnstile ||
      !window.CHAMPION_LIFE_FORMS?.siteKey
    )
      throw Error("This form is awaiting secure submission configuration.");
    if (token) return token;
    throw Error("Complete the security check before submitting.");
  }
  async function gateway(action, payload) {
    await challenge();
    const r = await client.functions.invoke("forms-submit", {
      body: {
        action,
        organization: org,
        slug,
        payload,
        turnstile_token: token,
        bot_field: "",
      },
    });
    token = "";
    if (widget !== null) window.turnstile?.reset(widget);
    if (r.error || r.data?.accepted !== true)
      throw Error(
        "Could not complete this request. Check your response and try again.",
      );
    return r.data;
  }
  try {
    if (!client || !org || !slug) {
      unavailable();
      return;
    }
    const r = await client.rpc("forms_public", { p_org: org, p_slug: slug });
    if (r.error || !r.data?.available) {
      unavailable();
      return;
    }
    const d = r.data.definition;
    root.replaceChildren();
    const header = el("header", null, { class: "public-form-header" });
    header.append(
      el("p", "CHAMPION LIFE", { class: "forms-eyebrow" }),
      el("h1", r.data.name),
      el("p", r.data.description),
    );
    const panel = el("div"),
      check = el("div", null, {
        id: "forms-challenge",
        "aria-label": "Security check",
      });
    root.append(header, panel, check);
    R.render(panel, d, {
      funds: r.data.funds,
      minorScale: r.data.minor_unit_scale,
      onFile: async (f, file) => {
        const data = await gateway("reserve_file", {
          request_key: key,
          version_id: r.data.version_id,
          field_key: f.key,
          filename: file.name,
          mime: file.type,
          size_bytes: file.size,
        });
        if (!data.upload_url) throw Error("Upload authorization unavailable.");
        const upload = await fetch(data.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!upload.ok) throw Error("Upload failed.");
        return data.id;
      },
      onSubmit: async (answers) => {
        const result = await gateway("submit", {
          request_key: key,
          version_id: r.data.version_id,
          answers,
        });
        const success = el("section", null, {
          class: "public-form-header",
          tabindex: "-1",
          role: "status",
        });
        success.append(
          el("h2", "Response received"),
          el("p", d.settings?.success_message || "Thank you."),
          el("p", result.reference),
        );
        if (result.payment_status === "provider_not_configured")
          success.append(
            el(
              "p",
              "Payment has not been collected. The provider is not configured.",
            ),
          );
        if (d.settings?.next_link)
          success.append(
            el("a", "Next step", {
              href: d.settings.next_link,
              class: "forms-button",
            }),
          );
        root.replaceChildren(success);
        success.focus();
        if (
          d.settings?.redirect &&
          /^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*(\.html)?$/.test(d.settings.redirect)
        )
          location.assign(d.settings.redirect);
      },
    });
    const wait = setInterval(() => {
      if (
        window.turnstile &&
        window.CHAMPION_LIFE_FORMS?.siteKey
      ) {
        clearInterval(wait);
        widget = window.turnstile.render(check, {
          sitekey: window.CHAMPION_LIFE_FORMS.siteKey,
          action: "forms_submit",
          callback: (t) => (token = t),
          "expired-callback": () => (token = ""),
        });
      }
    }, 200);
    setTimeout(() => clearInterval(wait), 10000);
  } catch {
    unavailable();
  }
})();
