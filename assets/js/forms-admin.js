(function () {
  "use strict";
  const auth = window.ChampionLifeAuth,
    M = window.FormsModel,
    R = window.FormsRenderer,
    el = R.el,
    root = document.getElementById("forms-app");
  if (!root) return;
  const query = new URLSearchParams(location.search),
    view = root.dataset.view,
    formId = query.get("form");
  let org = query.get("organization"),
    context = null,
    permissions = [],
    organizationTimezone = "UTC",
    form = null,
    version = null,
    draft = null,
    funds = [],
    destinations = [],
    minorScale = 2,
    selected = null,
    activePane = "canvas",
    mode = "desktop",
    history = [],
    future = [],
    saveTimer = null,
    saving = false,
    dirty = false,
    conflict = false,
    epoch = 0,
    readSequence = 0,
    drag = null,
    pointerCleanup = null,
    suppressClickUntil = 0,
    preview = false;
  const status = el("p", "", { class: "forms-status", role: "status" }),
    error = el("p", "", {
      class: "forms-error",
      role: "alert",
      tabindex: "-1",
    });
  const can = (k) => permissions.includes(k);
  function timestamp(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return el("span", "—");
    const instant = new Date(value), options = { timeZone: organizationTimezone };
    return el("time", instant.toLocaleDateString("en-US", { ...options, month: "short", day: "numeric", year: "numeric" }) + " · " +
      instant.toLocaleTimeString("en-US", { ...options, hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
      { datetime: value, title: value + " · " + organizationTimezone });
  }
  function button(text, fn, cls = "") {
    const b = el("button", text, { type: "button", class: cls });
    b.onclick = fn;
    return b;
  }
  function message(e) {
    error.textContent = e?.message || "Forms operation unavailable.";
    error.focus();
  }
  async function rpc(action, payload = {}) {
    const token = epoch,
      r = await auth.client.rpc("forms_workspace", {
        p_action: action,
        p_org: org,
        p_payload: payload,
      });
    if (token !== epoch) throw Error("Access changed.");
    if (r.error) {
      if (
        ["42501", "PGRST301", "PGRST302"].includes(r.error.code) ||
        [401, 403].includes(r.status)
      ) {
        deny();
        window.StaffWorkspace?.refresh();
        throw Error("Forms access is no longer available.");
      }
      const e = Error(
        ["40001", "PT409"].includes(r.error.code)
          ? "Another editor changed this draft. Reload before saving."
          : r.error.message || "Forms operation unavailable.",
      );
      e.code = r.error.code;
      throw e;
    }
    return r.data;
  }
  function deny() {
    pointerCleanup?.();
    epoch++;
    readSequence++;
    clearTimeout(saveTimer);
    draft = null;
    version = null;
    form = null;
    history = [];
    future = [];
    permissions = [];
    root.replaceChildren(
      el(
        "section",
        "Your Forms access is no longer available. Contact an administrator if needed.",
        { class: "staff-state", role: "status" },
      ),
      el("a", "Return to Staff Dashboard", {
        href: "staff-home.html",
        class: "forms-button",
      }),
    );
  }
  function fieldControl(
    container,
    label,
    value,
    change,
    { type = "text", options = null } = {},
  ) {
    const id =
        "setting-" +
        M.key(label) +
        "-" +
        Math.random().toString(36).slice(2, 7),
      n = options
        ? el("select", null, { id })
        : type === "textarea"
          ? el("textarea", value ?? "", { id, rows: 3 })
          : el("input", null, { id, type });
    if (options) {
      for (const o of options) {
        const [k, v] = Array.isArray(o) ? o : [o, o];
        n.append(el("option", v, { value: k }));
      }
      n.value = value ?? "";
    } else if (type === "checkbox") n.checked = !!value;
    else if (type !== "textarea") n.value = value ?? "";
    n.onchange = () => {
      try {
        change(type === "checkbox" ? n.checked : n.value);
      } catch (e) {
        message(e);
      }
    };
    const friendly = label
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase());
    const l = el("label", friendly, { for: id });
    if (type === "checkbox") {
      l.prepend(n);
      container.append(l);
    } else container.append(l, n);
    return n;
  }
  function heading(title) {
    root.replaceChildren(
      el("p", "KINGDOM PROPEL · FORMS", { class: "forms-eyebrow" }),
      el("h1", title),
      status,
      error,
    );
    error.textContent = "";
  }
  async function list() {
    heading("Forms");
    const toolbar = el("div", null, { class: "forms-toolbar" });
    if (context.organizations.length > 1)
      fieldControl(
        toolbar,
        "Organization",
        org,
        (v) => {
          org = v;
          start({ ...window.StaffWorkspace.context });
        },
        { options: context.organizations.map((o) => [o.id, o.name]) },
      );
    if (can("forms.create"))
      toolbar.append(button("Create form", () => createPanel(), "forms-gold"));
    toolbar.append(button("Show archived", () => listLoad("archived")));
    root.append(toolbar);
    await listLoad();
  }
  async function listLoad(state = "") {
    const token = ++readSequence;
    try {
      const data = await rpc("list", { status: state });
      if (token !== readSequence) return;
      root.querySelector(".forms-list")?.remove();
      const panel = el("section", null, { class: "forms-card forms-list" });
      if (!data.forms.length) {
        panel.append(
          el(
            "p",
            can("forms.create") ? "No forms yet. Create a blank form or a synthetic demonstration." : "No forms available to view.",
          ),
        );
        root.append(panel);
        return;
      }
      const scroll = el("div", null, { class: "forms-scroll" }),
        table = el("table", null, { class: "forms-table forms-list-table" }),
        head = el("thead"),
        tr = el("tr");
      for (const title of [
        "Name / type",
        "Status",
        "Published version",
        "Updated / published",
        "Submissions",
        "Payment",
        "Organization",
        "Actions",
      ])
        tr.append(el("th", title, { scope: "col" }));
      head.append(tr);
      table.append(head);
      const body = el("tbody");
      for (const f of data.forms) {
        const tr = el("tr"),
          actions = el("div", null, { class: "forms-actions" }),
          per = f.permissions || [],
          url = (page) =>
            "staff-form-" +
            page +
            ".html?organization=" +
            encodeURIComponent(org) +
            "&form=" +
            encodeURIComponent(f.id);
        const link = (label, href) =>
          el("a", label, { href, class: "forms-button" });
        if (per.includes("forms.edit"))
          actions.append(link("Edit", url("builder")));
        if (per.includes("forms.read"))
          actions.append(link(per.includes("forms.edit") ? "Preview" : "View form", url("builder") + "&preview=true"));
        if (per.includes("forms.submissions.read"))
          actions.append(link("Submissions", url("submissions")));
        if (per.includes("forms.create") && per.includes("forms.edit"))
          actions.append(
            button("Duplicate", async () => {
              try {
                await rpc("duplicate", { id: f.id });
                await listLoad(state);
              } catch (e) {
                message(e);
              }
            }),
          );
        if (per.includes("forms.publish")) {
          if (f.status === "published")
            actions.append(button("Pause", () => act("pause", f.id)));
          else if (f.status === "paused")
            actions.append(button("Resume", () => act("resume", f.id)));
          else actions.append(link("Review & publish", url("builder")));
        }
        if (per.includes("forms.archive") && f.status !== "archived")
          actions.append(button("Archive", () => act("archive", f.id)));
        const dates = el("div", null, { class: "forms-dates" });
        for (const [label, value] of [["Updated", f.updated_at], ["Published", f.last_published]]) {
          const line = el("div");
          line.append(el("span", label, { class: "forms-small" }), timestamp(value));
          dates.append(line);
        }
        for (const text of [
          f.name + " · " + f.type.replaceAll("_", " "),
          f.status,
          f.published_version || "—",
          dates,
          String(f.submission_count),
          f.payment_enabled ? "Held configuration" : "No",
          context?.organizations?.find((o) => o.id === org)?.name ||
            "Organization",
        ])
          { const cell = el("td"); cell.append(text instanceof Node ? text : document.createTextNode(String(text))); tr.append(cell); }
        const td = el("td");
        td.append(actions);
        tr.append(td);
        body.append(tr);
      }
      table.append(body);
      scroll.append(table);
      panel.append(scroll);
      root.append(panel);
    } catch (e) {
      message(e);
    }
  }
  async function act(a, id) {
    try {
      await rpc(a, { id });
      await list();
    } catch (e) {
      message(e);
    }
  }
  function createPanel() {
    root.querySelector(".forms-create")?.remove();
    const panel = el("section", null, { class: "forms-card forms-create" }),
      values = {
        name: "",
        type: "general",
        slug: "",
        description: "",
        start: "blank",
      };
    panel.append(
      el("h2", "Create form"),
      el(
        "p",
        "Organization: " +
          (context.organizations.find((o) => o.id === org)?.name || ""),
      ),
    );
    for (const key of ["name", "type", "slug", "description", "start"])
      fieldControl(
        panel,
        key,
        values[key],
        (v) => (values[key] = v),
        key === "type"
          ? {
              options: [
                "giving",
                "pledge",
                "event",
                "registration",
                "application",
                "survey",
                "outreach",
                "general",
                "custom",
              ],
            }
          : key === "start"
            ? {
                options: [
                  ["blank", "Blank form"],
                  ["giving", "Synthetic Giving demo"],
                  ["event", "Synthetic Event demo"],
                ],
              }
            : {},
      );
    panel.append(
      button(
        "Create draft",
        async () => {
          try {
            let definition = M.blank();
            if (values.start !== "blank") {
              const data = await rpc("funds");
              definition = M.demo(values.start, data.funds);
              if (definition.payment.enabled)
                definition.payment.currency = data.currency;
              const scale = data.minor_unit_scale || 2;
              for (const f of M.allFields(definition))
                if (f.amount) {
                  f.amount.suggested = f.amount.suggested.map((n) =>
                    M.minor(M.major(n), scale),
                  );
                  for (const k of ["minimum_minor", "default_minor"])
                    f.amount[k] = M.minor(M.major(f.amount[k]), scale);
                }
              if (!can("forms.payment.configure")) {
                definition.payment = {};
                definition.sections[0].fields =
                  definition.sections[0].fields.filter(
                    (f) => f.type !== "payment",
                  );
              }
            }
            const result = await rpc("create", {
              name: values.name,
              type: values.type,
              slug: values.slug || M.key(values.name).replaceAll("_", "-"),
              description: values.description,
              definition,
            });
            location.href =
              "staff-form-builder.html?organization=" +
              encodeURIComponent(org) +
              "&form=" +
              encodeURIComponent(result.form.id);
          } catch (e) {
            message(e);
          }
        },
        "forms-gold",
      ),
      button("Cancel", () => panel.remove()),
    );
    root.append(panel);
    panel.scrollIntoView({ block: "nearest" });
  }
  function snapshot() {
    return {
      definition: M.clone(draft),
      meta: { name: form.name, type: form.type, description: form.description },
    };
  }
  function restore(s) {
    draft = s.definition;
    Object.assign(form, s.meta);
  }
  function remember() {
    history.push(snapshot());
    if (history.length > 50) history.shift();
    future = [];
  }
  function change(fn, { redraw = true } = {}) {
    if (!can("forms.edit") || conflict) return;
    remember();
    fn();
    dirty = true;
    status.textContent = "Unsaved changes";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(), 800);
    if (redraw) builder();
  }
  async function save() {
    if (!dirty || saving || conflict || !draft) return;
    saving = true;
    clearTimeout(saveTimer);
    const sent = M.clone(draft),
      token = epoch,
      revision = version.revision;
    status.textContent = "Saving draft…";
    try {
      const data = await rpc("save", {
        id: form.id,
        revision,
        definition: sent,
        name: form.name,
        type: form.type,
        description: form.description,
      });
      if (token !== epoch) return;
      version = data.version;
      dirty = JSON.stringify(draft) !== JSON.stringify(sent);
      status.textContent = dirty
        ? "Changes pending…"
        : "Saved · revision " + version.revision;
      if (dirty) saveTimer = setTimeout(save, 800);
    } catch (e) {
      if (token !== epoch) return;
      if (["40001", "PT409"].includes(e.code)) {
        conflict = true;
        clearTimeout(saveTimer);
      }
      message(e);
      status.textContent = conflict
        ? "Conflict — reload required"
        : "Save failed — changes retained";
    } finally {
      saving = false;
    }
  }
  const keys = () => [
    ...draft.sections.map((s) => s.key),
    ...M.allFields(draft).map((f) => f.key),
  ];
  function add(type, target = draft.sections.at(-1).key, index) {
    activePane = "canvas";
    change(() => {
      if (type === "section") {
        const section = {
          key: M.key("section", keys()),
          title: "New section",
          columns: 1,
          fields: [],
        };
        draft.sections.push(section);
        selected = { kind: "section", key: section.key };
      } else {
        const s =
            draft.sections.find((s) => s.key === target) || draft.sections[0],
          f = M.field(type, keys());
        if (f.amount) {
          f.amount.suggested = f.amount.suggested.map((n) =>
            M.minor(M.major(n), minorScale),
          );
          for (const k of ["minimum_minor", "default_minor"])
            f.amount[k] = M.minor(M.major(f.amount[k]), minorScale);
        }
        s.fields.splice(index ?? s.fields.length, 0, f);
        selected = { kind: "field", key: f.key };
      }
    });
  }
  function move(key, direction) {
    change(() => {
      for (const s of draft.sections) {
        const i = s.fields.findIndex((f) => f.key === key);
        if (i >= 0) {
          const next = i + direction;
          if (next >= 0 && next < s.fields.length)
            [s.fields[i], s.fields[next]] = [s.fields[next], s.fields[i]];
          break;
        }
      }
    });
    document.querySelector('[data-key="' + key + '"]')?.focus();
  }
  function duplicate(key) {
    change(() => {
      const s = draft.sections.find((s) => s.key === key);
      if (s) {
        const copy = M.clone(s);
        copy.key = M.key(s.key + "_copy", keys());
        const used = keys().concat(copy.key);
        const mapping = {};
        copy.fields = copy.fields.map((f) => {
          const x = M.clone(f);
          x.key = M.key(f.key + "_copy", used);
          used.push(x.key);
          mapping[f.key] = x.key;
          return x;
        });
        draft.sections.splice(draft.sections.indexOf(s) + 1, 0, copy);
        for (const c of [...draft.conditions])
          if (mapping[c.target] || c.target === s.key)
            draft.conditions.push({
              ...c,
              source: mapping[c.source] || c.source,
              target: mapping[c.target] || copy.key,
            });
        selected = { kind: "section", key: copy.key };
      } else
        for (const s of draft.sections) {
          const i = s.fields.findIndex((f) => f.key === key);
          if (i >= 0) {
            const copy = M.clone(s.fields[i]);
            copy.key = M.key(key + "_copy", keys());
            s.fields.splice(i + 1, 0, copy);
            selected = { kind: "field", key: copy.key };
            break;
          }
        }
    });
  }
  function remove(key) {
    change(() => {
      const section = draft.sections.find((s) => s.key === key),
        removed = section ? [key, ...section.fields.map((f) => f.key)] : [key];
      if (section) {
        if (draft.sections.length === 1)
          throw Error("Keep at least one section.");
        draft.sections = draft.sections.filter((s) => s !== section);
      } else
        for (const s of draft.sections)
          s.fields = s.fields.filter((f) => f.key !== key);
      draft.conditions = draft.conditions.filter(
        (c) => !removed.includes(c.source) && !removed.includes(c.target),
      );
      selected = null;
    });
  }
  function reorderDrag(target, index) {
    if (!drag || !can("forms.edit")) return;
    if (drag.type) {
      add(drag.type, target, index);
      return;
    }
    change(() => {
      let item;
      for (const s of draft.sections) {
        const i = s.fields.findIndex((f) => f.key === drag.key);
        if (i >= 0) item = s.fields.splice(i, 1)[0];
      }
      if (item) {
        const s = draft.sections.find((s) => s.key === target);
        s.fields.splice(
          Math.min(index ?? s.fields.length, s.fields.length),
          0,
          item,
        );
      }
    });
    drag = null;
  }
  // Carry an editor descriptor, not an operating-system file/text move. Pointer capture
  // keeps mouse and touch gestures coherent; published definitions are never mutated.
  function bindPointerDrag(node, descriptor) {
    node.style.touchAction = "none";
    node.style.userSelect = "none";
    node.onpointerdown = (e) => {
      if (e.button !== 0 || !can("forms.edit") || conflict) return;
      pointerCleanup?.();
      const x = e.clientX,
        y = e.clientY,
        pointer = e.pointerId;
      let moving = false,
        ghost = null;
      const clear = () => {
        ghost?.remove();
        root
          .querySelectorAll(".is-drop-target")
          .forEach((n) => n.classList.remove("is-drop-target"));
        try {
          node.releasePointerCapture?.(pointer);
        } catch {
          /* Already released. */
        }
        node.onpointermove = node.onpointerup = node.onpointercancel = null;
        drag = null;
        pointerCleanup = null;
      };
      pointerCleanup = clear;
      try {
        node.setPointerCapture?.(pointer);
      } catch {
        /* Capture is optional in DOM tests. */
      }
      node.onpointermove = (move) => {
        if (!can("forms.edit")) {
          clear();
          return;
        }
        if (!moving && Math.hypot(move.clientX - x, move.clientY - y) < 6)
          return;
        moving = true;
        drag = descriptor;
        move.preventDefault();
        if (!ghost) {
          ghost = el(
            "div",
            descriptor.type ? M.types[descriptor.type] : "Move field",
            { class: "forms-drag-preview", "aria-hidden": "true" },
          );
          document.body.append(ghost);
        }
        ghost.style.left =
          Math.max(4, Math.min(move.clientX + 12, innerWidth - 210)) + "px";
        ghost.style.top =
          Math.max(4, Math.min(move.clientY + 12, innerHeight - 70)) + "px";
        const canvas = root.querySelector(".forms-canvas"),
          bounds = canvas?.getBoundingClientRect();
        if (
          bounds &&
          move.clientX >= bounds.left &&
          move.clientX <= bounds.right
        ) {
          if (move.clientY > Math.min(bounds.bottom, innerHeight) - 35)
            canvas.scrollTop += 16;
          else if (move.clientY < Math.max(bounds.top, 0) + 35)
            canvas.scrollTop -= 16;
        }
        root
          .querySelectorAll(".is-drop-target")
          .forEach((n) => n.classList.remove("is-drop-target"));
        document
          .elementFromPoint(move.clientX, move.clientY)
          ?.closest(".forms-canvas-section")
          ?.classList.add("is-drop-target");
      };
      node.onpointerup = (up) => {
        if (!moving) {
          clear();
          return;
        }
        up.preventDefault();
        suppressClickUntil = performance.now() + 400;
        const hit = document.elementFromPoint(up.clientX, up.clientY);
        const area = hit?.closest(".forms-canvas-section"),
          target = hit?.closest(".forms-canvas-field");
        const sectionKey = area?.getAttribute("data-section"),
          targetKey = target?.getAttribute("data-key");
        const index = targetKey
          ? draft?.sections
              .find((s) => s.key === sectionKey)
              ?.fields.findIndex((f) => f.key === targetKey)
          : undefined;
        const permitted =
          can("forms.edit") &&
          !conflict &&
          !!sectionKey &&
          descriptor.key !== targetKey;
        clear();
        if (permitted) {
          drag = descriptor;
          reorderDrag(sectionKey, index);
        }
      };
      node.onpointercancel = clear;
    };
  }
  function builder() {
    if (!draft) return;
    heading(form.name);
    const readOnly = !can("forms.edit");
    if (readOnly) preview = true;
    status.textContent = readOnly ? "Read-only form preview · version " + version.version : conflict
      ? "Conflict — reload required"
      : dirty
        ? "Unsaved changes"
        : "Saved · revision " + version.revision;
    const toolbar = el("div", null, { class: "forms-toolbar" });
    toolbar.append(
      el("a", "All forms", {
        href: "staff-forms.html?organization=" + encodeURIComponent(org),
        class: "forms-button",
      }),
    );
    toolbar.append(
      button("Desktop", () => {
        mode = "desktop";
        builder();
      }),
      button("Mobile", () => {
        mode = "mobile";
        builder();
      }),
    );
    if (!readOnly) toolbar.append(
      button(preview ? "Return to editor" : "Live preview", () => {
        preview = !preview;
        builder();
      }),
    );
    if (can("forms.edit"))
      toolbar.append(
        button("Save draft", save, "forms-gold"),
        button("Undo", () => {
          if (history.length) {
            future.push(snapshot());
            restore(history.pop());
            dirty = true;
            builder();
            clearTimeout(saveTimer);
            saveTimer = setTimeout(save, 800);
          }
        }),
        button("Redo", () => {
          if (future.length) {
            history.push(snapshot());
            restore(future.pop());
            dirty = true;
            builder();
            clearTimeout(saveTimer);
            saveTimer = setTimeout(save, 800);
          }
        }),
      );
    if (can("forms.publish"))
      toolbar.append(button("Publish version", publish, "forms-gold"));
    if (!readOnly) toolbar.append(
      button("Form settings", () => {
        selected = { kind: "settings" };
        activePane = "settings";
        builder();
      }),
      button("Conditions", () => {
        selected = { kind: "conditions" };
        activePane = "settings";
        builder();
      }),
    );
    if (conflict)
      toolbar.append(button("Reload saved draft", () => loadForm()));
    root.append(toolbar);
    if (preview) {
      const panel = el("section", null, {
        class:
          "forms-preview" + (mode === "mobile" ? " forms-preview-mobile" : ""),
        "aria-label": mode + " form preview",
      });
      root.append(panel);
      R.render(panel, draft, { funds, preview: true, minorScale });
      return;
    }
    const tabs = el("div", null, {
      class: "forms-tabs",
      role: "tablist",
      "aria-label": "Builder panels",
    });
    for (const [id, label] of [
      ["library", "Fields"],
      ["canvas", "Canvas"],
      ["settings", "Settings"],
    ]) {
      const b = button(label, () => {
        activePane = id;
        builder();
      });
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(activePane === id));
      tabs.append(b);
    }
    root.append(tabs);
    const panes = el("div", null, { class: "forms-builder" }),
      library = el("aside", null, {
        class: "forms-pane forms-library-pane",
        "data-active": activePane === "library",
        "aria-label": "Field library",
      }),
      canvas = el("section", null, {
        class: "forms-pane forms-canvas",
        "data-active": activePane === "canvas",
        "aria-label": "Form canvas",
      }),
      settings = el("aside", null, {
        class: "forms-pane forms-settings",
        "data-active": activePane === "settings",
        "aria-label": "Selected element settings",
      });
    library.append(el("h2", "Add fields"));
    const items = el("div", null, { class: "forms-library" });
    for (const [type, label] of Object.entries(M.types)) {
      const b = button(label, () => {
        if (performance.now() >= suppressClickUntil) add(type);
      });
      b.disabled = !can("forms.edit") || conflict;
      b.draggable = false;
      b.dataset.type = type;
      b.ondragstart = (e) => {
        drag = { type };
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", type);
      };
      bindPointerDrag(b, { type });
      items.append(b);
    }
    library.append(items);
    canvas.append(
      el("h2", mode === "mobile" ? "Mobile canvas" : "Desktop canvas"),
      el("p", "Select a field to edit. Drag or use Move up / Move down.", {
        class: "forms-small",
      }),
    );
    const sheet = el("div", null, {
      class: mode === "mobile" ? "forms-mode-mobile" : "",
    });
    for (const s of draft.sections) {
      const area = el("section", null, {
        class: "forms-canvas-section",
        "data-section": s.key,
      });
      const choose = button(s.title || "Untitled section", () => {
        selected = { kind: "section", key: s.key };
        activePane = "settings";
        builder();
      });
      area.append(choose);
      const grid = el("div", null, {
        class: "forms-canvas-grid",
        "data-columns": s.columns || 1,
      });
      for (const [f, i] of s.fields.map((f, i) => [f, i])) {
        const box = el("div", null, {
          class: "forms-canvas-field width-" + (f.width || "full"),
          tabindex: 0,
          role: "group",
          "aria-label": f.label || f.key,
          "aria-selected": selected?.key === f.key,
          "data-key": f.key,
        });
        box.append(
          el("strong", f.label || f.key),
          el(
            "small",
            (M.types[f.type] || f.type) +
              " · " +
              f.key +
              (f.required ? " · Required" : ""),
          ),
        );
        box.onclick = (e) => {
          if (performance.now() < suppressClickUntil) return;
          if (e.target.closest("button")) return;
          selected = { kind: "field", key: f.key };
          activePane = "settings";
          builder();
        };
        box.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selected = { kind: "field", key: f.key };
            activePane = "settings";
            builder();
            root
              .querySelector(".forms-settings input,.forms-settings select")
              ?.focus();
          }
          if (e.altKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            move(f.key, e.key === "ArrowUp" ? -1 : 1);
          }
        };
        box.ondragover = (e) => {
          if (drag?.key === f.key) {
            e.stopPropagation();
            e.dataTransfer.dropEffect = "none";
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = drag?.type ? "copy" : "move";
        };
        box.ondrop = (e) => {
          e.preventDefault();
          e.stopPropagation();
          reorderDrag(s.key, i);
        };
        const actions = el("div", null, { class: "forms-actions" });
        if (can("forms.edit")) {
          const handle = el("button", "Drag", {
            type: "button",
            draggable: "false",
            class: "forms-drag-handle",
            "aria-label": "Drag " + (f.label || f.key) + " to reorder",
          });
          handle.ondragstart = (e) => {
            drag = { key: f.key };
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", f.key);
          };
          bindPointerDrag(handle, { key: f.key });
          actions.append(handle);
          for (const [label, fn] of [
            [
              "Edit",
              () => {
                selected = { kind: "field", key: f.key };
                activePane = "settings";
                builder();
              },
            ],
            ["Move up", () => move(f.key, -1)],
            ["Move down", () => move(f.key, 1)],
            ["Duplicate", () => duplicate(f.key)],
            ["Delete", () => remove(f.key)],
          ])
            actions.append(button(label, fn));
        }
        box.append(actions);
        grid.append(box);
      }
      area.append(grid);
      area.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = drag?.type ? "copy" : "move";
        area.classList.add("is-drop-target");
      };
      area.ondragleave = () => area.classList.remove("is-drop-target");
      area.ondrop = (e) => {
        e.preventDefault();
        reorderDrag(s.key);
      };
      sheet.append(area);
    }
    canvas.append(sheet);
    renderSettings(settings);
    panes.append(library, canvas, settings);
    root.append(panes);
  }
  function renderSettings(panel) {
    panel.append(el("h2", "Settings"));
    if (!selected) {
      panel.append(el("p", "Select a field or section."));
      return;
    }
    if (selected.kind === "conditions") {
      conditionsPanel(panel);
      return;
    }
    if (selected.kind === "settings") {
      generalSettings(panel);
      return;
    }
    const section = draft.sections.find((s) => s.key === selected.key),
      field = M.allFields(draft).find((f) => f.key === selected.key),
      item = section || field;
    if (!item) return;
    const set = (key, value) => change(() => (item[key] = value));
    for (const key of section
      ? ["title", "description", "columns", "hidden", "grouping", "step"]
      : [
          "label",
          "key",
          "help",
          "placeholder",
          "description",
          "width",
          "hidden",
          "required",
          "readonly",
        ]) {
      const opts =
        key === "width"
          ? { options: ["full", "half", "third", "two_thirds"] }
          : key === "columns"
            ? { options: ["1", "2", "3"] }
            : ["hidden", "required", "readonly"].includes(key)
              ? { type: "checkbox" }
              : key === "description"
                ? { type: "textarea" }
                : {};
      fieldControl(
        panel,
        key === "key" ? "Stable internal key" : key,
        item[key],
        (value) => {
          if (key === "key") {
            if (
              !/^[a-z][a-z0-9_]{0,63}$/.test(value) ||
              keys()
                .filter((k) => k !== item.key)
                .includes(value)
            )
              throw Error("Use a unique lowercase field key.");
            change(() => {
              const prior = item.key;
              item.key = value;
              selected.key = value;
              for (const c of draft.conditions) {
                if (c.source === prior) c.source = value;
                if (c.target === prior) c.target = value;
              }
              for (const k of Object.keys(draft.payment))
                if (draft.payment[k] === prior) draft.payment[k] = value;
            });
          } else set(key, key === "columns" ? Number(value) : value);
        },
        opts,
      );
    }
    if (field) {
      if (field.type === "paragraph")
        fieldControl(
          panel,
          "Text formatting",
          field.format || "plain",
          (v) => set("format", v),
          { options: ["plain", "bold", "italic", "bullet_list"] },
        );
      fieldControl(
        panel,
        "Default value",
        typeof field.default === "object"
          ? JSON.stringify(field.default)
          : (field.default ?? ""),
        (value) =>
          set(
            "default",
            ["checkbox", "yes_no", "consent"].includes(field.type)
              ? value === "true"
              : value,
          ),
      );
      const validation = field.validation || {};
      for (const key of ["min", "max", "min_length", "max_length", "pattern"])
        fieldControl(
          panel,
          "Validation " + key,
          validation[key] ?? "",
          (v) =>
            change(() => {
              field.validation ||= {};
              if (v === "") delete field.validation[key];
              else
                field.validation[key] =
                  key === "pattern" || ["date", "time"].includes(field.type)
                    ? v
                    : Number(v);
            }),
          key === "pattern"
            ? { options: ["", "alphanumeric", "postal_code"] }
            : {
                type:
                  ["date", "time"].includes(field.type) &&
                  ["min", "max"].includes(key)
                    ? field.type
                    : "number",
              },
        );
      if (field.options) {
        panel.append(el("h3", "Choices"));
        field.options.forEach((o, i) => {
          const row = el("div", null, { class: "forms-options-row" });
          for (const key of ["label", "value", "active"])
            fieldControl(
              row,
              key,
              o[key],
              (value) => change(() => (o[key] = value)),
              key === "active" ? { type: "checkbox" } : {},
            );
          row.append(
            button("Move option up", () =>
              change(() => {
                if (i > 0)
                  [field.options[i - 1], field.options[i]] = [
                    field.options[i],
                    field.options[i - 1],
                  ];
              }),
            ),
            button("Remove option", () =>
              change(() => field.options.splice(i, 1)),
            ),
          );
          panel.append(row);
        });
        panel.append(
          button("Add choice", () =>
            change(() =>
              field.options.push({
                label: "New option",
                value: M.key(
                  "choice",
                  field.options.map((o) => o.value),
                ),
                active: true,
              }),
            ),
          ),
        );
      }
      if (field.type === "file") {
        for (const key of ["types", "max_bytes", "visibility"])
          fieldControl(
            panel,
            "File " + key,
            key === "types"
              ? (field.file?.types || []).join(",")
              : (field.file?.[key] ?? ""),
            (v) =>
              change(() => {
                field.file ||= {};
                field.file[key] =
                  key === "types"
                    ? v.split(",").map((x) => x.trim())
                    : key === "max_bytes"
                      ? Number(v)
                      : v;
              }),
            key === "visibility" ? { options: ["private", "public"] } : {},
          );
      }
      if (["signature", "consent"].includes(field.type))
        for (const key of ["text", "version", "purpose"])
          fieldControl(
            panel,
            "Agreement " + key,
            field.agreement?.[key] || "",
            (v) =>
              change(() => {
                field.agreement ||= {};
                field.agreement[key] = v;
              }),
            key === "text" ? { type: "textarea" } : {},
          );
      if (field.type === "gift_amount")
        for (const key of ["suggested", "minimum_minor", "default_minor"])
          fieldControl(
            panel,
            key === "suggested"
              ? "Suggested amounts"
              : key === "minimum_minor"
                ? "Minimum amount"
                : "Default amount",
            key === "suggested"
              ? (field.amount?.[key] || [])
                  .map((n) => M.major(n, minorScale))
                  .join(",")
              : M.major(field.amount?.[key] || "0", minorScale),
            (v) =>
              change(() => {
                field.amount ||= {};
                field.amount[key] =
                  key === "suggested"
                    ? v.split(",").map((x) => M.minor(x.trim(), minorScale))
                    : M.minor(v, minorScale);
              }),
          );
      if (field.type === "fund")
        fieldControl(
          panel,
          "Multiple fund lines",
          field.multiple,
          (v) => set("multiple", v),
          { type: "checkbox" },
        );
    }
    panel.append(
      button("Duplicate element", () => duplicate(item.key)),
      button("Delete element", () => remove(item.key)),
    );
    if (!can("forms.edit") || conflict)
      for (const n of panel.querySelectorAll("input,select,textarea,button"))
        n.disabled = true;
  }
  function conditionsPanel(panel) {
    panel.append(
      el(
        "p",
        "Conditions are checked on the server. Circular or broken references cannot be published.",
      ),
    );
    const fields = M.allFields(draft),
      targets = [...draft.sections, ...fields];
    draft.conditions.forEach((c, i) => {
      const card = el("div", null, { class: "forms-card" });
      for (const key of ["source", "operator", "value", "action", "target"])
        fieldControl(
          card,
          key,
          key === "value" ? JSON.stringify(c.value) : c[key],
          (v) =>
            change(() => {
              c[key] = key === "value" ? JSON.parse(v) : v;
            }),
          key === "source"
            ? { options: fields.map((f) => [f.key, f.label || f.key]) }
            : key === "target"
              ? {
                  options: targets.map((t) => [
                    t.key,
                    t.label || t.title || t.key,
                  ]),
                }
              : key === "operator"
                ? { options: M.operators }
                : key === "action"
                  ? { options: ["show", "hide", "require", "disable"] }
                  : {},
        );
      card.append(
        button("Remove condition", () =>
          change(() => draft.conditions.splice(i, 1)),
        ),
      );
      panel.append(card);
    });
    panel.append(
      button("Add condition", () =>
        change(() => {
          if (!fields.length) throw Error("Add fields first.");
          draft.conditions.push({
            source: fields[0].key,
            operator: "equals",
            value: "",
            action: "show",
            target: fields.at(-1).key,
          });
        }),
      ),
    );
  }
  function generalSettings(panel) {
    fieldControl(panel, "Form name", form.name, (v) =>
      change(() => (form.name = v)),
    );
    fieldControl(
      panel,
      "Form type",
      form.type,
      (v) => change(() => (form.type = v)),
      {
        options: [
          "giving",
          "pledge",
          "event",
          "registration",
          "application",
          "survey",
          "outreach",
          "general",
          "custom",
        ],
      },
    );
    fieldControl(
      panel,
      "Description",
      form.description,
      (v) => change(() => (form.description = v)),
      { type: "textarea" },
    );
    panel.append(
      el(
        "p",
        "Type: " +
          form.type +
          " · " +
          form.status +
          " · Version " +
          version.version,
      ),
    );
    for (const key of [
      "public_available",
      "timezone",
      "starts_at",
      "ends_at",
      "max_submissions",
      "success_message",
      "redirect",
      "next_link",
      "notification_hook",
    ])
      fieldControl(
        panel,
        key,
        draft.settings[key] ?? "",
        (v) =>
          change(() => {
            if (v === "") delete draft.settings[key];
            else
              draft.settings[key] = key === "max_submissions" ? Number(v) : v;
          }),
        key === "public_available"
          ? { type: "checkbox" }
          : key === "success_message"
            ? { type: "textarea" }
            : {},
      );
    panel.append(
      el("h3", "Payment configuration"),
      el("p", "Provider not configured. No real payment input or charging.", {
        class: "form-payment",
      }),
    );
    if (!can("forms.payment.configure")) {
      panel.append(
        el("p", "Payment configuration requires separate permission."),
      );
      return;
    }
    for (const key of [
      "enabled",
      "required",
      "classification",
      "currency",
      "fixed_minor",
      "minimum_minor",
      "amount_key",
      "fund_key",
      "lines_key",
      "default_fund",
      "multiple_lines",
      "recurring_key",
      "anonymous_key",
      "receipt_key",
      "fee_option",
      "destination_override",
      "pledge_key",
      "pledge_start_key",
      "pledge_end_key",
    ])
      fieldControl(
        panel,
        key === "fixed_minor"
          ? "Fixed amount"
          : key === "minimum_minor"
            ? "Minimum amount"
            : key,
        ["fixed_minor", "minimum_minor"].includes(key) && draft.payment[key]
          ? M.major(draft.payment[key], minorScale)
          : (draft.payment[key] ?? ""),
        (v) =>
          change(() => {
            if (v === "") delete draft.payment[key];
            else
              draft.payment[key] = ["fixed_minor", "minimum_minor"].includes(
                key,
              )
                ? M.minor(v, minorScale)
                : v;
          }),
        ["enabled", "required", "multiple_lines", "fee_option"].includes(key)
          ? { type: "checkbox" }
          : key === "classification"
            ? {
                options: [
                  "donation",
                  "event_fee",
                  "registration_fee",
                  "deposit",
                  "purchase",
                ],
              }
            : key === "default_fund"
              ? {
                  options: [
                    ["", "Choose default fund"],
                    ...funds.map((f) => [f.id, f.name]),
                  ],
                }
              : key === "destination_override"
                ? {
                    options: [
                      ["", "Use canonical fund routing"],
                      ...destinations.map((d) => [d.id, d.label]),
                    ],
                  }
                : key.endsWith("_key")
                  ? {
                      options: [
                        ["", "No field selected"],
                        ...M.allFields(draft)
                          .filter((f) => !M.display.has(f.type))
                          .map((f) => [f.key, f.label + " [" + f.key + "]"]),
                      ],
                    }
                  : {},
      );
    panel.append(el("h3", "Allowed giving funds"));
    for (const fund of funds)
      fieldControl(
        panel,
        fund.name,
        (draft.payment.allowed_funds || []).includes(fund.id),
        (checked) =>
          change(() => {
            const set = new Set(draft.payment.allowed_funds || []);
            if (checked) set.add(fund.id);
            else set.delete(fund.id);
            draft.payment.allowed_funds = [...set];
          }),
        { type: "checkbox" },
      );
    fieldControl(
      panel,
      "Recurring frequencies",
      (draft.payment.frequencies || []).join(","),
      (v) =>
        change(
          () =>
            (draft.payment.frequencies = v
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)),
        ),
    );
  }
  async function publish() {
    try {
      if (saving) throw Error("Wait for the current save to finish.");
      if (dirty) await save();
      if (dirty || conflict)
        throw Error("Save or resolve the draft conflict before publishing.");
      const errors = M.validate(draft);
      if (errors.length) throw Error(errors.join("\n"));
      const data = await rpc("publish", {
        id: form.id,
        version_id: version.id,
        revision: version.revision,
      });
      version = data.version;
      form = data.form;
      status.textContent =
        "Published immutable version " + version.version + ".";
      const link = el("a", "Open published form", {
        class: "forms-button",
        href:
          "form.html?organization=" +
          encodeURIComponent(org) +
          "&slug=" +
          encodeURIComponent(form.slug),
        target: "_blank",
        rel: "noopener noreferrer",
      });
      root.querySelector(".forms-toolbar")?.append(link);
    } catch (e) {
      message(e);
    }
  }
  async function loadForm() {
    const token = ++readSequence;
    clearTimeout(saveTimer);
    try {
      const data = await rpc(can("forms.edit") ? "draft" : "get", {
        id: formId,
      });
      if (token !== readSequence) return;
      form = data.form;
      version = data.version;
      draft = M.clone(version.definition);
      permissions = data.permissions || permissions;
      const catalog = await rpc("funds", { id: formId });
      funds = catalog.funds;
      destinations = catalog.destinations || [];
      minorScale = catalog.minor_unit_scale ?? 2;
      if (token !== readSequence) return;
      history = [];
      future = [];
      dirty = false;
      conflict = false;
      preview = query.get("preview") === "true";
      builder();
    } catch (e) {
      message(e);
    }
  }
  function csv(data) {
    const rows = [
      [
        "Reference",
        "Submitted",
        "Version",
        "Status",
        "Payment status",
        "Link status",
        "Field key",
        "Field label",
        "Answer",
      ],
    ];
    for (const s of data.submissions)
      for (const a of s.answers || [])
        rows.push([
          s.reference,
          s.submitted_at,
          s.version,
          s.status,
          s.payment_status,
          s.link_status,
          a.field_key,
          a.label_snapshot,
          typeof a.submitted_value === "string"
            ? a.submitted_value
            : JSON.stringify(a.submitted_value),
        ]);
    return rows
      .map((r) =>
        r
          .map((v) => {
            let text = String(v ?? "");
            if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n");
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = el("a", "Download ready: " + name, {
        href: url,
        download: name,
        class: "forms-button",
      });
    root.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 60000);
  }
  async function submissions() {
    heading("Form submissions");
    const filters = {},
      toolbar = el("div", null, { class: "forms-toolbar" });
    for (const key of [
      "from",
      "to",
      "status",
      "version_id",
      "payment",
      "link_status",
    ])
      fieldControl(
        toolbar,
        key,
        "",
        (v) => (filters[key] = v),
        key === "from" || key === "to" ? { type: "date" } : {},
      );
    const output = el("section", null, { class: "forms-card" });
    toolbar.append(button("Apply filters", load));
    if (can("forms.submissions.export"))
      toolbar.append(
        button("Export CSV", async () => {
          try {
            const data = await rpc("export", { id: formId, ...filters });
            download(
              new Blob([csv(data)], { type: "text/csv;charset=utf-8" }),
              "form-submissions.csv",
            );
          } catch (e) {
            message(e);
          }
        }),
      );
    root.append(toolbar, output);
    async function load() {
      const token = ++readSequence;
      try {
        const data = await rpc("submissions", { id: formId, ...filters });
        if (token !== readSequence) return;
        output.replaceChildren(
          el(
            "p",
            data.metrics.count +
              " submissions · Conversion rate unavailable (no view tracking).",
          ),
        );
        for (const [state, count] of Object.entries(data.metrics.status || {}))
          output.append(el("p", state + ": " + count));
        for (const day of data.metrics.trend || [])
          output.append(
            el("p", day.report_day + ": " + day.count + " responses", {
              class: "forms-small",
            }),
          );
        for (const total of data.metrics.collected_by_currency || [])
          output.append(
            el(
              "p",
              "Canonical posted amount: " +
                total.amount_minor +
                " minor units · " +
                total.currency,
            ),
          );
        if (
          (window.StaffWorkspace?.context?.giving?.organizations || []).some(
            (o) =>
              o.id === org && o.permissions.includes("finance.reports.read"),
          )
        )
          output.append(
            el("a", "Canonical payment reports", {
              href:
                "staff-giving-reports.html?organization=" +
                encodeURIComponent(org),
            }),
          );
        const scroll = el("div", null, { class: "forms-scroll" }),
          table = el("table", null, { class: "forms-table" }),
          head = el("tr");
        for (const text of [
          "Date",
          "Submitter",
          "Version",
          "Status",
          "Payment",
          "Person link",
          "Detail",
        ])
          head.append(el("th", text, { scope: "col" }));
        const thead = el("thead");
        thead.append(head);
        const body = el("tbody");
        for (const s of data.submissions) {
          const tr = el("tr");
          for (const value of [
            s.submitted_at,
            s.submitter || "Unmatched",
            s.version,
            s.status,
            s.payment_status,
            s.link_status,
          ])
            tr.append(el("td", value));
          const td = el("td");
          td.append(button("Open submission", () => detail(s.id)));
          tr.append(td);
          body.append(tr);
        }
        table.append(thead, body);
        scroll.append(table);
        output.append(scroll);
        status.textContent = data.submissions.length + " matching responses";
      } catch (e) {
        message(e);
      }
    }
    await load();
  }
  async function detail(id) {
    try {
      const data = await rpc("detail", { id: formId, submission_id: id }),
        s = data.submission;
      root.querySelector(".forms-detail")?.remove();
      const panel = el("section", null, { class: "forms-card forms-detail" });
      panel.append(
        el("h2", s.reference),
        el(
          "p",
          (data.form_name || "Form") +
            " · Published version " +
            (data.version || s.version_id) +
            " · " +
            s.link_status +
            " · " +
            s.payment_status,
        ),
      );
      const dl = el("dl");
      for (const a of data.answers || [])
        dl.append(
          el("dt", a.label_snapshot + " [" + a.field_key + "]"),
          el(
            "dd",
            typeof a.submitted_value === "string"
              ? a.submitted_value
              : JSON.stringify(a.submitted_value),
          ),
        );
      panel.append(dl);
      for (const a of data.agreements || [])
        panel.append(
          el(
            "p",
            a.kind +
              " · " +
              a.purpose +
              " · " +
              a.agreement_version +
              " · " +
              a.agreement_text +
              " · " +
              a.recorded_at,
          ),
        );
      for (const file of data.files || [])
        panel.append(
          button("Download " + file.filename, async () => {
            try {
              const response = await auth.client.functions.invoke(
                "forms-file-access",
                {
                  body: {
                    organization: org,
                    form: formId,
                    submission: id,
                    file: file.id,
                  },
                },
              );
              if (response.error || !response.data?.url)
                throw Error("File access unavailable.");
              const r = await fetch(response.data.url);
              if (!r.ok) throw Error("Download unavailable.");
              download(await r.blob(), file.filename);
            } catch (e) {
              message(e);
            }
          }),
        );
      if (can("forms.payment.configure") && s.link_status === "linked") {
        for (const action of ["pledge", "recurring"])
          panel.append(
            button("Create canonical held " + action, async () => {
              try {
                await rpc(action, {
                  id: formId,
                  submission_id: id,
                  request_key: crypto.randomUUID(),
                });
                await detail(id);
              } catch (e) {
                message(e);
              }
            }),
          );
      }
      if (
        s.giving_session_id &&
        window.StaffWorkspace?.context?.payments?.organizations?.some(
          (o) => o.id === org && o.permissions.includes("payments.view"),
        )
      ) {
        panel.append(button("Open held checkout summary", async () => {
          const token = epoch, owner = org, user = await auth.getUser();
          try {
            const r = await auth.client.rpc("payments_workspace", {
              p_action: "form_checkout", p_org: owner, p_payload: { submission_id: id },
            });
            if (token !== epoch || owner !== org || !user || (await auth.getUser())?.id !== user.id) return;
            if (r.error || !r.data?.session?.id) {
              if (r.error?.code === "42501") { deny(); window.StaffWorkspace?.refresh(); }
              throw Error("Checkout summary unavailable.");
            }
            location.assign("checkout.html?organization=" + encodeURIComponent(owner) + "&session=" + encodeURIComponent(r.data.session.id));
          } catch (e) { if (token === epoch) message(e); }
        }));
      }
      if (s.giving_session_id)
        panel.append(
          el("p", "Canonical Giving Session: " + s.giving_session_id),
        );
      for (const a of data.audit || [])
        panel.append(
          el("p", a.action + " · " + a.created_at, { class: "forms-small" }),
        );
      if (can("forms.edit")) {
        const link = { person_id: "", household_id: "", reviewed: false };
        for (const key of ["person_id", "household_id", "reviewed"])
          fieldControl(
            panel,
            "Reviewed " + key,
            link[key],
            (v) => (link[key] = v),
            key === "reviewed" ? { type: "checkbox" } : {},
          );
        for (const [action, label] of [
          ["review_match", "Save reviewed match"],
          ["link", "Link reviewed Person"],
        ])
          panel.append(
            button(label, async () => {
              try {
                await rpc(action, {
                  id: formId,
                  submission_id: id,
                  revision: s.revision,
                  ...link,
                  household_id: link.household_id || null,
                });
                await detail(id);
              } catch (e) {
                message(e);
              }
            }),
          );
      }
      panel.append(button("Close detail", () => panel.remove()));
      root.append(panel);
      panel.scrollIntoView({ block: "nearest" });
    } catch (e) {
      message(e);
    }
  }
  async function start(s) {
    const user = s?.user;
    if (!user) {
      deny();
      return;
    }
    const organizations = s.forms?.organizations || [],
      chosen =
        organizations.find((o) => o.id === org) ||
        (!org ? organizations[0] : null);
    if (!chosen) {
      deny();
      return;
    }
    org = chosen.id;
    organizationTimezone = chosen.timezone || s.giving?.organizations?.find((o) => o.id === org)?.timezone || "UTC";
    const per = [
      ...(chosen.permissions || []),
      ...(formId
        ? chosen.scoped_forms?.find((f) => f.id === formId)?.permissions || []
        : (chosen.scoped_forms || []).flatMap((f) => f.permissions || [])),
    ];
    const effective = JSON.stringify([user.id, org, [...new Set(per)].sort()]);
    if (context?.effective === effective) return;
    epoch++;
    clearTimeout(saveTimer);
    context = { ...s.forms, effective };
    permissions = [...new Set(per)];
    const needed =
      view === "builder"
        ? query.get("preview") === "true"
          ? "forms.read"
          : "forms.edit"
        : view === "submissions"
          ? "forms.submissions.read"
          : "forms.read";
    if (!permissions.includes(needed)) {
      deny();
      return;
    }
    try {
      if (view === "builder" && formId) await loadForm();
      else if (view === "submissions" && formId) await submissions();
      else await list();
    } catch (e) {
      message(e);
    }
  }
  window.addEventListener("staff-workspace-context", (e) => start(e.detail));
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  if (window.StaffWorkspace?.context) start(window.StaffWorkspace.context);
  window.FormsAdmin = {
    move,
    duplicate,
    remove,
    add,
    save,
    publish,
    get draft() {
      return draft;
    },
    csv,
  };
})();
