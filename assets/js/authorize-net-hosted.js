/* Optional host controller. No credentials, raw fields, SDK or provider request on load. */
(() => {
  "use strict";
  const URL = "https://test.authorize.net/payment/payment";
  window.AuthorizeNetHosted = Object.freeze({
    mount(
      root,
      {
        enabled = false,
        gateway_id,
        createSession,
        checkAccess = async () => false,
        handoff,
      } = {},
    ) {
      const panel = document.createElement("section");
      panel.className = "giving-panel anet-hosted-panel";
      panel.setAttribute("aria-label", "Authorize.Net sandbox hosted payment");
      const title = document.createElement("h2");
      title.textContent = "AUTHORIZE.NET · SANDBOX / TEST ONLY";
      const message = document.createElement("p");
      message.setAttribute("role", "status");
      message.setAttribute("aria-live", "polite");
      message.textContent = enabled
        ? "Ready to prepare secure sandbox payment."
        : "Hosted payment entry is disabled until isolated sandbox approval.";
      const note = document.createElement("p");
      note.textContent =
        "Payment details belong to Authorize.Net. No card or bank fields are collected here.";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "giving-button giving-primary";
      button.textContent = "Open secure sandbox payment";
      button.disabled = !enabled;
      panel.append(title, note, message, button);
      root.append(panel);
      let disposed = false,
        busy = false,
        submitted = false,
        form = null,
        epoch = 0;
      const clear = () => {
        if (form) {
          form.querySelectorAll("input").forEach((i) => (i.value = ""));
          form.remove();
          form = null;
        }
      };
      const dispose = () => {
        disposed = true;
        epoch++;
        clear();
        button.disabled = true;
        panel.remove();
        observer.disconnect();
        window.removeEventListener("focus", refresh);
      };
      const refresh = async () => {
        if (disposed) return;
        const current = epoch;
        try {
          if (!(await checkAccess()) && current === epoch) dispose();
        } catch {
          if (current === epoch) dispose();
        }
      };
      const observer = new MutationObserver(() => {
        if (!root.contains(panel) && !disposed) dispose();
      });
      observer.observe(root, { childList: true, subtree: true });
      button.onclick = async () => {
        if (!enabled || disposed || busy || submitted) return;
        busy = true;
        button.disabled = true;
        const current = ++epoch;
        message.textContent = "Preparing secure hosted payment…";
        try {
          if (!(await checkAccess())) {
            dispose();
            return;
          }
          const result = await createSession();
          if (disposed || current !== epoch) return;
          if (
            result?.status !== "tokenized" ||
            result.environment !== "sandbox" ||
            result.gateway_id !== gateway_id ||
            result.form_url !== URL ||
            !Number.isInteger(result.expires_in_seconds) ||
            result.expires_in_seconds < 1 ||
            result.expires_in_seconds > 900 ||
            typeof result.form_token !== "string" ||
            !/^[a-zA-Z0-9+/=_-]{20,4096}$/.test(result.form_token)
          )
            throw Error("held");
          if (!(await checkAccess())) {
            dispose();
            return;
          }
          if (disposed || current !== epoch) return;
          form = document.createElement("form");
          form.method = "post";
          form.action = URL;
          form.hidden = true;
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "token";
          input.value = result.form_token;
          form.append(input);
          panel.append(form);
          submitted = true;
          message.textContent =
            "Opening Authorize.Net sandbox. Return to checkout for verified status; provider navigation alone is not payment confirmation.";
          if (handoff) await handoff(form);
          else form.submit();
          clear();
        } catch {
          if (disposed || current !== epoch) return;
          clear();
          message.textContent =
            "Hosted payment is unavailable or requires review. Do not retry an unknown transaction.";
          submitted = true;
        } finally {
          busy = false;
          button.disabled = disposed || submitted || !enabled;
        }
      };
      window.addEventListener("focus", refresh);
      return Object.freeze({ dispose, recheck: refresh });
    },
  });
})();
