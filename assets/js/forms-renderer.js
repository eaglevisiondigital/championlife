(function (global) {
  "use strict";
  const M = global.FormsModel;
  function el(tag, text, attrs = {}) {
    const n = document.createElement(tag);
    if (text !== null && text !== undefined) n.textContent = text;
    for (const [k, v] of Object.entries(attrs))
      if (v !== undefined) n.setAttribute(k, String(v));
    return n;
  }
  function render(
    root,
    d,
    {
      funds = [],
      preview = false,
      onSubmit = () => {},
      onFile = async () => {
        throw Error("File service unavailable.");
      },
      initial = {},
      minorScale = 2,
    } = {},
  ) {
    const form = el("form", null, {
        class: "kp-form",
        "aria-label": "Form response",
      }),
      error = el("p", "", {
        role: "alert",
        tabindex: "-1",
        class: "forms-error",
        id: "form-errors",
      }),
      answers = Object.assign(Object.create(null), M.clone(initial)),
      nodes = new Map();
    form.noValidate = true;
    form.append(error);
    const defaults = M.allFields(d).filter((f) => Object.hasOwn(f, "default"));
    for (const f of defaults)
      if (!Object.hasOwn(answers, f.key)) answers[f.key] = M.clone(f.default);
    const inputs = [];
    function input(f, type = "text", label = f.label, key = f.key) {
      const n = el("input", null, {
        id: "form-" + key,
        name: key,
        type,
        placeholder: f.placeholder || "",
        autocomplete:
          f.type === "name"
            ? "name"
            : f.type === "email"
              ? "email"
              : f.type === "phone"
                ? "tel"
                : "off",
      });
      if (f.type === "number") n.step = "any";
      n.value = answers[f.key] ?? f.default ?? "";
      const l = el("label", label, { for: n.id });
      return { n, l };
    }
    function changed(f, value) {
      answers[f.key] = value;
      for (const [field, n] of inputs)
        if (field.key === f.key) n.removeAttribute("aria-invalid");
      refresh();
    }
    for (const s of d.sections) {
      const section = el("section", null, {
        class: "form-section",
        "data-section": s.key,
        "data-grouping": s.grouping || "card",
      });
      if (s.title) section.append(el("h2", s.title));
      if (s.description) section.append(el("p", s.description));
      const grid = el("div", null, {
        class: "form-grid",
        "data-columns": s.columns || 1,
      });
      section.append(grid);
      nodes.set(s.key, section);
      for (const f of s.fields) {
        const wrap = el("div", null, {
          class: "form-field width-" + (f.width || "full"),
          "data-field": f.key,
        });
        nodes.set(f.key, wrap);
        grid.append(wrap);
        if (M.display.has(f.type)) {
          if (f.type === "heading") wrap.append(el("h3", f.label));
          else if (f.type === "paragraph") {
            const text = f.description || f.label;
            if (f.format === "bullet_list") {
              const ul = el("ul");
              for (const line of text.split("\n").filter(Boolean))
                ul.append(el("li", line));
              wrap.append(ul);
            } else {
              const p = el("p");
              p.append(
                el(
                  f.format === "bold"
                    ? "strong"
                    : f.format === "italic"
                      ? "em"
                      : "span",
                  text,
                ),
              );
              wrap.append(p);
            }
          } else if (f.type === "divider") wrap.append(el("hr"));
          else if (f.type === "spacer") wrap.classList.add("form-spacer");
          else if (f.type === "payment")
            wrap.append(
              el(
                "div",
                "Payment processing is not yet enabled. Payment provider not configured. No card or bank information is collected.",
                { class: "form-payment", role: "note" },
              ),
            );
          else if (f.type === "submit")
            wrap.append(
              el(
                "button",
                preview ? "Preview — no submission" : f.label || "Submit",
                { type: "submit", class: "forms-gold" },
              ),
            );
          continue;
        }
        if (f.type === "hidden") continue;
        const help = el("p", f.help || f.description || "", {
          id: "help-" + f.key,
          class: "form-help",
        });
        let control;
        if (["checkbox", "yes_no", "consent"].includes(f.type)) {
          const group = el("fieldset"),
            legend = el("legend", f.label);
          group.append(legend);
          if (f.type === "yes_no") {
            for (const [value, label] of [
              [true, "Yes"],
              [false, "No"],
            ]) {
              const n = el("input", null, {
                id: "form-" + f.key + "-" + value,
                type: "radio",
                name: f.key,
                value,
              });
              n.checked = answers[f.key] === value;
              n.onchange = () => changed(f, value);
              const l = el("label", label, { for: n.id });
              l.prepend(n);
              group.append(l);
              inputs.push([f, n]);
            }
            control = group;
          } else {
            const { n, l } = input(f, "checkbox", f.label);
            n.checked = answers[f.key] === true;
            n.onchange = () => changed(f, n.checked);
            l.prepend(n);
            control = n;
            group.append(l);
            inputs.push([f, n]);
            if (f.type === "consent")
              group.append(
                el(
                  "p",
                  f.agreement?.text ||
                    "Purpose-specific consent text must be configured.",
                ),
              );
          }
          wrap.append(group);
        } else if (
          [
            "dropdown",
            "multiple_choice",
            "radio_group",
            "checkbox_group",
            "fund",
          ].includes(f.type) &&
          !f.multiple
        ) {
          if (
            ["radio_group", "checkbox_group", "multiple_choice"].includes(
              f.type,
            )
          ) {
            const group = el("fieldset");
            group.append(el("legend", f.label));
            for (const opt of (f.options || []).filter(
              (o) => o.active !== false,
            )) {
              const n = el("input", null, {
                id: "form-" + f.key + "-" + M.key(opt.value),
                type: f.type === "checkbox_group" ? "checkbox" : "radio",
                name: f.key,
                value: opt.value,
              });
              n.checked =
                f.type === "checkbox_group"
                  ? (answers[f.key] || []).includes(opt.value)
                  : answers[f.key] === opt.value;
              n.onchange = () => {
                if (f.type === "checkbox_group") {
                  const choices = [
                    ...group.querySelectorAll("input:checked"),
                  ].map((n) => n.value);
                  changed(f, choices);
                } else changed(f, n.value);
              };
              const l = el("label", opt.label, { for: n.id });
              l.prepend(n);
              group.append(l);
              inputs.push([f, n]);
            }
            wrap.append(group);
            control = group;
          } else {
            const n = el("select", null, { id: "form-" + f.key, name: f.key });
            n.append(el("option", "Choose…", { value: "" }));
            if (f.type === "fund") {
              const permitted = funds.filter(
                (fund) =>
                  !d.payment?.allowed_funds?.length ||
                  d.payment.allowed_funds.includes(fund.id),
              );
              const groups = new Map();
              for (const fund of permitted) {
                let parent = n;
                if (fund.parent_id) {
                  if (!groups.has(fund.parent_id)) {
                    const g = el("optgroup", null, {
                      label:
                        funds.find((p) => p.id === fund.parent_id)?.name ||
                        fund.parent_name ||
                        "Funds",
                    });
                    groups.set(fund.parent_id, g);
                    n.append(g);
                  }
                  parent = groups.get(fund.parent_id);
                }
                parent.append(el("option", fund.name, { value: fund.id }));
              }
            } else
              for (const opt of (f.options || []).filter(
                (o) => o.active !== false,
              ))
                n.append(el("option", opt.label, { value: opt.value }));
            n.value =
              answers[f.key] ??
              f.default ??
              (f.type === "fund" ? d.payment?.default_fund : "") ??
              "";
            if (n.value) answers[f.key] = n.value;
            n.onchange = () => changed(f, n.value);
            wrap.append(el("label", f.label, { for: n.id }), n);
            control = n;
            inputs.push([f, n]);
          }
        } else if (f.type === "fund" && f.multiple) {
          const group = el("fieldset");
          group.append(el("legend", f.label));
          const rows = el("div"),
            add = el("button", "Add designation", { type: "button" });
          const lines = Array.isArray(answers[f.key]) ? answers[f.key] : [];
          function lineRow(
            line = { fund_id: funds[0]?.id || "", amount_minor: "0" },
          ) {
            lines.push(line);
            const row = el("div", null, { class: "form-fund-line" }),
              sel = el("select", null, { "aria-label": "Fund designation" }),
              amt = el("input", null, {
                type: "text",
                inputmode: "decimal",
                "aria-label": "Designation amount",
              });
            for (const fund of funds.filter(
              (x) =>
                !d.payment?.allowed_funds?.length ||
                d.payment.allowed_funds.includes(x.id),
            ))
              sel.append(el("option", fund.name, { value: fund.id }));
            sel.value = line.fund_id;
            amt.value = M.major(line.amount_minor, minorScale);
            sel.onchange = () => {
              line.fund_id = sel.value;
              changed(f, lines);
            };
            amt.oninput = () => {
              try {
                line.amount_minor = M.minor(amt.value, minorScale);
                amt.setCustomValidity("");
                changed(f, lines);
              } catch (e) {
                amt.setCustomValidity(e.message);
              }
            };
            const remove = el("button", "Remove designation", {
              type: "button",
            });
            remove.onclick = () => {
              lines.splice(lines.indexOf(line), 1);
              row.remove();
              changed(f, lines);
            };
            row.append(sel, amt, remove);
            rows.append(row);
            inputs.push([f, sel], [f, amt]);
          }
          const original = lines.splice(0);
          for (const line of original) lineRow(line);
          add.onclick = () => lineRow();
          group.append(rows, add);
          wrap.append(group);
          control = group;
        } else if (f.type === "address") {
          const group = el("fieldset");
          group.append(el("legend", f.label));
          const address = answers[f.key] || {};
          for (const [k, label] of Object.entries({
            line1: "Address line 1",
            line2: "Address line 2",
            city: "City",
            region: "State / region",
            postal_code: "Postal code",
            country: "Country",
          })) {
            const { n, l } = input(f, "text", label, f.key + "_" + k);
            n.value = address[k] || "";
            n.oninput = () => {
              address[k] = n.value;
              changed(f, address);
            };
            group.append(l, n);
            inputs.push([f, n]);
          }
          wrap.append(group);
          control = group;
        } else if (f.type === "long_text") {
          const n = el("textarea", answers[f.key] || f.default || "", {
            id: "form-" + f.key,
            name: f.key,
            rows: 4,
            placeholder: f.placeholder || "",
          });
          n.oninput = () => changed(f, n.value);
          wrap.append(el("label", f.label, { for: n.id }), n);
          control = n;
          inputs.push([f, n]);
        } else if (f.type === "file") {
          const { n, l } = input(f, "file");
          n.removeAttribute("value");
          n.accept = (f.file?.types || []).join(",");
          const status = el("p", "", { role: "status" });
          n.onchange = async () => {
            const file = n.files?.[0];
            if (!file) return;
            if (
              file.size > (f.file?.max_bytes || 10485760) ||
              !f.file?.types?.includes(file.type)
            ) {
              status.textContent = "File type or size is not allowed.";
              n.value = "";
              return;
            }
            if (preview) {
              status.textContent = "Preview only — file was not uploaded.";
              return;
            }
            n.disabled = true;
            status.textContent = "Uploading…";
            try {
              const id = await onFile(f, file);
              changed(f, id);
              status.textContent = "File uploaded privately.";
            } catch (e) {
              status.textContent = e.message || "Upload unavailable.";
            } finally {
              n.disabled = false;
            }
          };
          wrap.append(l, n, status);
          control = n;
          inputs.push([f, n]);
        } else {
          const kind =
            {
              email: "email",
              phone: "tel",
              number: "number",
              date: "date",
              time: "time",
            }[f.type] || "text";
          const { n, l } = input(f, kind);
          if (["currency", "gift_amount"].includes(f.type)) {
            n.inputMode = "decimal";
            n.value = M.major(
              answers[f.key] || f.amount?.default_minor || "0",
              minorScale,
            );
            if (f.amount?.default_minor && !answers[f.key])
              answers[f.key] = f.amount.default_minor;
            n.oninput = () => {
              try {
                changed(f, M.minor(n.value, minorScale));
                n.setCustomValidity("");
              } catch (e) {
                n.setCustomValidity(e.message);
              }
            };
            if (f.type === "gift_amount") {
              const suggestions = el("div", null, {
                class: "form-suggestions",
              });
              for (const value of f.amount?.suggested || []) {
                const b = el(
                  "button",
                  (d.payment?.currency === "USD" || !d.payment?.currency
                    ? "$"
                    : d.payment.currency + " ") + M.major(value, minorScale),
                  { type: "button" },
                );
                b.onclick = () => {
                  n.value = M.major(value, minorScale);
                  changed(f, String(value));
                };
                suggestions.append(b);
              }
              wrap.append(suggestions);
            }
          } else
            n.oninput = () =>
              changed(f, f.type === "number" ? n.value : n.value);
          if (f.type === "signature")
            wrap.append(
              el(
                "p",
                f.agreement?.text || "Agreement text must be configured.",
              ),
            );
          wrap.append(l, n);
          control = n;
          inputs.push([f, n]);
        }
        if (control && !["FIELDSET"].includes(control.tagName))
          control.setAttribute("aria-describedby", help.id);
        const caption = wrap.querySelector("legend") || wrap.querySelector("label");
        if (caption) {
          const words = caption.textContent.trim().split(/\s+/), last = words.pop() || "";
          caption.replaceChildren(document.createTextNode(words.length ? words.join(" ") + " " : ""));
          const tail = el("span", last, { class: "form-label-tail" });
          tail.append(el("span", " *", { class: "form-required", "aria-hidden": "true", hidden: true }));
          caption.append(tail);
        }
        wrap.append(help);
      }
      form.append(section);
    }
    if (!M.allFields(d).some((f) => f.type === "submit"))
      form.append(
        el("button", preview ? "Preview — no submission" : "Submit", {
          type: "submit",
          class: "forms-gold",
        }),
      );
    function refresh() {
      const states = M.state(d, answers);
      for (const [k, n] of nodes) {
        n.hidden = !!states[k]?.hidden;
        const marker = n.querySelector(".form-required");
        if (marker) marker.hidden = !states[k]?.required || !!states[k]?.disabled || !!states[k]?.hidden;
      }
      for (const [f, n] of inputs) {
        const st = states[f.key] || {};
        n.disabled = !!st.disabled || !!st.hidden;
        n.required = !!st.required && !st.hidden && !st.disabled;
        if (f.validation) {
          if (
            f.validation.min !== undefined &&
            ["number", "date", "time"].includes(f.type)
          )
            n.min = f.validation.min;
          if (
            f.validation.max !== undefined &&
            ["number", "date", "time"].includes(f.type)
          )
            n.max = f.validation.max;
          if (f.validation.max_length) n.maxLength = f.validation.max_length;
          if (f.validation.min_length) n.minLength = f.validation.min_length;
        }
      }
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      error.textContent = "";
      if (preview) {
        error.textContent = "Preview only. No response was submitted.";
        return;
      }
      const invalid = inputs.find(([, n]) => !n.disabled && !n.checkValidity());
      if (invalid) {
        error.textContent =
          "Check " + invalid[0].label + ". " + invalid[1].validationMessage;
        invalid[1].setAttribute("aria-invalid", "true");
        invalid[1].focus();
        return;
      }
      const states = M.state(d, answers),
        safe = Object.create(null);
      for (const f of M.allFields(d))
        if (
          !M.display.has(f.type) &&
          !states[f.key]?.hidden &&
          !states[f.key]?.disabled &&
          Object.hasOwn(answers, f.key)
        )
          safe[f.key] = answers[f.key];
      const buttons = [...form.querySelectorAll("button[type=submit]")];
      buttons.forEach((b) => (b.disabled = true));
      try {
        await onSubmit(safe);
      } catch (e) {
        error.textContent =
          e.message || "Could not submit. Check your response and try again.";
        error.focus();
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    };
    for (const [f, n] of inputs)
      n.setAttribute("aria-describedby", "help-" + f.key + " form-errors");
    root.replaceChildren(form);
    refresh();
    return { form, answers, refresh };
  }
  global.FormsRenderer = { render, el };
})(window);
