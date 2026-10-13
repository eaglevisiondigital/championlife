(function (global) {
  "use strict";
  const types = Object.freeze({
    heading: "Heading",
    paragraph: "Paragraph / Rich Text",
    divider: "Divider",
    spacer: "Spacer",
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    short_text: "Short Text",
    long_text: "Long Text",
    number: "Number",
    currency: "Currency",
    date: "Date",
    time: "Time",
    dropdown: "Dropdown",
    multiple_choice: "Multiple Choice",
    checkbox: "Checkbox",
    checkbox_group: "Checkbox Group",
    radio_group: "Radio Group",
    yes_no: "Yes / No",
    file: "File Upload",
    signature: "Signature",
    hidden: "Hidden Field",
    section: "Section",
    fund: "Fund Selector",
    gift_amount: "Gift Amount",
    payment: "Payment",
    submit: "Submit Button",
    consent: "Purpose-specific Consent",
  });
  const operators = [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "is_empty",
    "is_not_empty",
    "greater_than",
    "less_than",
  ];
  const display = new Set([
    "heading",
    "paragraph",
    "divider",
    "spacer",
    "payment",
    "submit",
  ]);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function key(base, used = []) {
    const stem =
      String(base)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/^[^a-z]+/, "field_")
        .slice(0, 50) || "field";
    let result = stem,
      i = 1;
    while (used.includes(result)) result = stem + "_" + i++;
    return result;
  }
  const blank = () => ({
    sections: [
      {
        key: "main",
        title: "Your information",
        description: "",
        columns: 1,
        fields: [],
      },
    ],
    conditions: [],
    settings: {
      branding: "champion-life",
      public_available: false,
      timezone: "America/Chicago",
      success_message: "Thank you. Your response has been received.",
    },
    payment: {},
  });
  function field(type, used = []) {
    const f = {
      key: key(type, used),
      type,
      label: types[type] || "Field",
      width: "full",
      required: false,
    };
    if (
      ["dropdown", "multiple_choice", "checkbox_group", "radio_group"].includes(
        type,
      )
    )
      f.options = [
        { label: "First option", value: "first", active: true },
        { label: "Second option", value: "second", active: true },
      ];
    if (type === "file")
      f.file = {
        types: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
        max_bytes: 10485760,
        visibility: "private",
      };
    if (["signature", "consent"].includes(type))
      f.agreement = { text: "", version: "1", purpose: "" };
    if (type === "gift_amount")
      f.amount = {
        suggested: ["2500", "5000", "10000", "25000"],
        minimum_minor: "100",
        default_minor: "2500",
      };
    if (type === "hidden") f.default = "";
    return f;
  }
  const allFields = (d) => d.sections.flatMap((s) => s.fields);
  function match(op, v, w) {
    const empty =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && !v.length);
    switch (op) {
      case "equals":
        return JSON.stringify(v) === JSON.stringify(w);
      case "not_equals":
        return JSON.stringify(v) !== JSON.stringify(w);
      case "is_empty":
        return empty;
      case "is_not_empty":
        return !empty;
      case "contains":
        return Array.isArray(v)
          ? v.includes(w)
          : String(v ?? "").includes(String(w ?? ""));
      case "not_contains":
        return !match("contains", v, w);
      case "greater_than":
        return !empty && Number(v) > Number(w);
      case "less_than":
        return !empty && Number(v) < Number(w);
      default:
        return false;
    }
  }
  function state(d, answers) {
    const base = {};
    for (const s of d.sections) {
      base[s.key] = { hidden: !!s.hidden, disabled: false, required: false };
      for (const f of s.fields)
        base[f.key] = {
          hidden: !!f.hidden || f.type === "hidden",
          disabled: !!f.readonly,
          required: !!f.required,
        };
    }
    let current = clone(base);
    for (let i = 0; i <= allFields(d).length + 1; i++) {
      const next = clone(base);
      for (const c of d.conditions || []) {
        if (!next[c.target]) continue;
        const source = current[c.source];
        const v =
          source?.hidden || source?.disabled ? undefined : answers[c.source];
        const test = match(c.operator, v, c.value);
        const prop = ["show", "hide"].includes(c.action)
          ? "hidden"
          : c.action === "require"
            ? "required"
            : "disabled";
        next[c.target][prop] = c.action === "show" ? !test : test;
      }
      for (const s of d.sections)
        for (const f of s.fields) {
          if (next[s.key].hidden) next[f.key].hidden = true;
          if (next[s.key].disabled) next[f.key].disabled = true;
          if (next[s.key].required) next[f.key].required = true;
          if (f.readonly) next[f.key].disabled = true;
          if (f.type === "hidden") next[f.key].hidden = true;
        }
      if (JSON.stringify(current) === JSON.stringify(next)) return next;
      current = next;
    }
    return current;
  }
  function validate(d) {
    const errors = [],
      fields = allFields(d),
      keys = [...d.sections.map((s) => s.key), ...fields.map((f) => f.key)];
    if (new Set(keys).size !== keys.length)
      errors.push("Field and section keys must be unique.");
    for (const f of fields) {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(f.key))
        errors.push("Invalid key: " + f.key);
      if (!["divider", "spacer", "hidden"].includes(f.type) && !f.label?.trim())
        errors.push("Label required: " + f.key);
    }
    const edges = new Map(keys.map((k) => [k, []]));
    for (const s of d.sections)
      for (const f of s.fields) edges.get(s.key)?.push(f.key);
    for (const c of d.conditions || []) {
      if (!fields.some((f) => f.key === c.source) || !keys.includes(c.target))
        errors.push("Condition references an unavailable element.");
      else edges.get(c.source).push(c.target);
    }
    const visiting = new Set(),
      done = new Set();
    function visit(k) {
      if (visiting.has(k)) {
        errors.push("Conditional cycle detected.");
        return;
      }
      if (done.has(k)) return;
      visiting.add(k);
      for (const t of edges.get(k) || []) visit(t);
      visiting.delete(k);
      done.add(k);
    }
    for (const k of keys) visit(k);
    return [...new Set(errors)];
  }
  function minor(value, scale = 2) {
    if (!/^\d+(\.\d+)?$/.test(String(value)))
      throw Error("Enter a positive amount.");
    const [a, b = ""] = String(value).split(".");
    if (b.length > scale) throw Error("Too many decimal places.");
    return (
      BigInt(a) * 10n ** BigInt(scale) +
      BigInt(b.padEnd(scale, "0") || 0)
    ).toString();
  }
  function major(value, scale = 2) {
    const n = BigInt(value || 0),
      factor = 10n ** BigInt(scale);
    return (
      String(n / factor) +
      (scale ? "." + String(n % factor).padStart(scale, "0") : "")
    );
  }
  function demo(type, funds = []) {
    const d = blank(),
      s = d.sections[0];
    s.title = type === "giving" ? "Your gift" : "Registration";
    s.fields = ["name", "email", "phone"].map((t) => ({
      ...field(t),
      key: t,
      label: t === "name" ? "Your name" : types[t],
      required: t !== "phone",
    }));
    if (type === "giving")
      s.fields.push(
        { ...field("fund"), key: "fund", label: "Giving fund" },
        {
          ...field("gift_amount"),
          key: "amount",
          label: "Gift amount",
          required: true,
        },
        {
          ...field("dropdown"),
          key: "recurring",
          label: "Frequency",
          options: ["one_time", "weekly", "biweekly", "monthly"].map((v) => ({
            label: v.replaceAll("_", " "),
            value: v,
            active: true,
          })),
        },
        {
          ...field("checkbox"),
          key: "anonymous",
          label: "Keep my name anonymous publicly",
        },
      );
    else
      s.fields.push(
        {
          ...field("number"),
          key: "attendee_count",
          label: "Attendee count",
          required: true,
          validation: { min: 1, max: 20 },
        },
        {
          ...field("short_text"),
          key: "custom_question",
          label: "What should our team know?",
        },
        {
          ...field("signature"),
          key: "waiver",
          label: "Typed acknowledgment",
          agreement: {
            text: "Synthetic demonstration only. No real legal agreement.",
            version: "synthetic-v1",
            purpose: "synthetic_event_acknowledgment",
          },
        },
      );
    s.fields.push(
      {
        ...field("yes_no"),
        key: "children",
        label: "Are you bringing children?",
      },
      {
        ...field("short_text"),
        key: "designation",
        label: "Mission designation",
      },
      {
        ...field("yes_no"),
        key: "payment_plan",
        label: "Request a payment plan?",
      },
      { ...field("dropdown"), key: "schedule", label: "Preferred schedule" },
    );
    d.sections.push({
      key: "children_section",
      title: "Children",
      columns: 1,
      fields: [
        {
          ...field("number"),
          key: "children_count",
          label: "Number of children",
          validation: { min: 1, max: 20 },
        },
      ],
    });
    d.conditions = [
      {
        source: "children",
        operator: "equals",
        value: true,
        action: "show",
        target: "children_section",
      },
      {
        source: type === "giving" ? "fund" : "attendee_count",
        operator: type === "giving" ? "equals" : "greater_than",
        value: type === "giving" ? funds[0]?.id || "" : 1,
        action: "show",
        target: "designation",
      },
      {
        source: "payment_plan",
        operator: "equals",
        value: true,
        action: "show",
        target: "schedule",
      },
    ];
    if (funds.length) {
      s.fields.push({ ...field("payment"), key: "payment", label: "Payment" });
      d.payment = {
        enabled: true,
        required: true,
        classification: type === "giving" ? "donation" : "event_fee",
        currency: "USD",
        allowed_funds: funds.map((f) => f.id),
        default_fund: funds[0].id,
        minimum_minor: "100",
        ...(type === "giving"
          ? {
              amount_key: "amount",
              fund_key: "fund",
              recurring_key: "recurring",
              anonymous_key: "anonymous",
              frequencies: ["weekly", "biweekly", "monthly"],
            }
          : { fixed_minor: "2500" }),
      };
    }
    s.fields.push({
      ...field("submit"),
      key: "submit",
      label: "Submit response",
    });
    return d;
  }
  global.FormsModel = {
    types,
    operators,
    display,
    clone,
    key,
    blank,
    field,
    allFields,
    match,
    state,
    validate,
    minor,
    major,
    demo,
  };
})(window);
