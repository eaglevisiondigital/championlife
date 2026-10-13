import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import {
  f,
  formsFixtureSQL,
  definition,
  createPayload,
  paymentDefinition,
} from "./forms-fixture.mjs";
const db = new PGlite(),
  q = (s, p = []) => db.query(s, p);
let n = 0;
const ok = (v, m) => {
    assert.ok(v, m);
    n++;
    console.log("PASS " + m);
  },
  deny = async (fn, m) => {
    await assert.rejects(fn);
    ok(true, m);
  };
const owner = () => db.exec("reset role"),
  as = async (user = f.admin, role = "authenticated") => {
    await owner();
    await q("select set_config('request.jwt.claim.sub',$1,false)", [
      user || "",
    ]);
    await db.exec("set role " + role);
  };
const rpc = (a, p = {}, o = f.org) =>
    q("select forms_workspace($1,$2,$3)v", [a, o, p]).then((r) => r.rows[0].v),
  pub = (slug, o = f.org) =>
    q("select forms_public($1,$2)v", [o, slug]).then((r) => r.rows[0].v),
  submit = (slug, p, a = "submit", o = f.org) =>
    q("select forms_gateway($1,$2,$3,$4,$5)v", [
      a,
      o,
      slug,
      p,
      "a".repeat(64),
    ]).then((r) => r.rows[0].v);
const count = async (sql) => {
  await owner();
  return Number((await q(sql)).rows[0].n);
};
try {
  await db.exec(
    readFileSync(
      new URL("fixtures/supabase-test-bootstrap.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../../supabase/bootstrap/automatic-rls.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const file of migrationOrder)
    await db.exec(
      readFileSync(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(formsFixtureSQL);
  await as();
  ok(
    (await rpc("context")).organizations.length === 1,
    "Forms context isolated current grants",
  );
  const created = await rpc("create", createPayload()),
    id = created.form.id;
  ok(
    created.version.version === 1 && created.version.revision === 1,
    "blank canonical version/revision",
  );
  await as(null, "anon");
  ok(
    (await pub("synthetic-form")).available === false,
    "draft invisible anonymously",
  );
  await deny(() => rpc("list"), "anonymous admin listing denied");
  await deny(
    () => submit("synthetic-form", {}),
    "anonymous direct submit denied",
  );
  await as();
  const published = await rpc("publish", {
    id,
    version_id: created.version.id,
    revision: 1,
  });
  ok(
    published.version.state === "published",
    "publication freezes canonical version",
  );
  ok(
    (await rpc("publish", { id, version_id: created.version.id, revision: 1 }))
      .version.id === published.version.id,
    "publish retry canonical",
  );
  await owner();
  await deny(
    () =>
      q("update platform_form_versions set definition='{}'where id=$1", [
        published.version.id,
      ]),
    "published immutable even privileged update",
  );
  await deny(
    () =>
      q("delete from platform_form_fields where version_id=$1", [
        published.version.id,
      ]),
    "published fields immutable",
  );
  await as(null, "anon");
  const publicConfig = await pub("synthetic-form");
  ok(
    publicConfig.available &&
      !JSON.stringify(publicConfig).includes("processor"),
    "anonymous configuration safe immutable version",
  );
  const body = {
    request_key: uid(),
    version_id: published.version.id,
    answers: {
      name: "=Synthetic Name",
      email: "synthetic@example.test",
      children: false,
      signature: "Synthetic Signer",
      consent: false,
    },
  };
  await as(null, "service_role");
  const first = await submit("synthetic-form", body);
  ok(
    first.accepted && first.payment_status === "none",
    "server conditional hidden section not required",
  );
  ok(
    (await submit("synthetic-form", body)).reference === first.reference,
    "public retry one canonical submission",
  );
  await deny(
    () =>
      submit("synthetic-form", {
        ...body,
        answers: { ...body.answers, name: "Changed" },
      }),
    "changed retry rejected",
  );
  for (const [change, label] of [
    [{ email: "bad" }, "email"],
    [{ name: "" }, "required name"],
    [{ children: true }, "conditionally required child count"],
    [{ child_count: 3 }, "hidden answer"],
    [{ unknown: "x" }, "unknown field"],
    [{ children: "true" }, "typed boolean"],
    [{ children: true, child_count: 21 }, "numeric max"],
    [{ children: true, child_count: 0 }, "numeric min"],
  ])
    await deny(
      () =>
        submit("synthetic-form", {
          ...body,
          request_key: uid(),
          answers: { ...body.answers, ...change },
        }),
      "authoritative " + label + " validation",
    );
  ok(
    (await count(
      `select count(*)n from platform_form_submissions where form_id='${id}'`,
    )) === 1,
    "failed answers roll back all submissions",
  );
  await as();
  const detail = (await rpc("submissions", { id })).submissions[0];
  const answer = await rpc("detail", { id, submission_id: detail.id });
  ok(
    answer.answers.some(
      (a) =>
        a.field_key === "name" &&
        a.text_value === "=Synthetic Name" &&
        a.label_snapshot === "Your name",
    ),
    "typed answer + exact label snapshot",
  );
  ok(
    answer.agreements.length === 2 &&
      answer.agreements.find((a) => a.kind === "consent").checked === false,
    "purpose consent/signature version context retained",
  );
  ok(
    answer.submission.link_status === "unmatched" &&
      answer.submission.person_id === null,
    "no silent Person merge",
  );
  await deny(
    () =>
      rpc("link", {
        id,
        submission_id: detail.id,
        revision: 1,
        person_id: f.person,
        reviewed: false,
      }),
    "unreviewed linkage denied",
  );
  await deny(
    () =>
      rpc("link", {
        id,
        submission_id: detail.id,
        revision: 1,
        person_id: f.foreignPerson,
        reviewed: true,
      }),
    "foreign Person linkage denied",
  );
  await rpc("review_match", {
    id,
    submission_id: detail.id,
    revision: 1,
    person_id: f.person,
    household_id: f.household,
    reviewed: true,
  });
  ok(
    (await rpc("detail", { id, submission_id: detail.id })).submission
      .link_status === "reviewed_match",
    "reviewed match is distinct from final linkage",
  );
  await rpc("link", {
    id,
    submission_id: detail.id,
    revision: 2,
    person_id: f.person,
    household_id: f.household,
    reviewed: true,
  });
  ok(
    (await rpc("detail", { id, submission_id: detail.id })).submission
      .link_status === "linked",
    "explicit reviewed canonical Person/Household link",
  );
  const d2 = await rpc("draft", { id });
  ok(
    d2.version.version === 2 && d2.version.state === "draft",
    "editing published creates new draft",
  );
  const next = definition();
  next.sections[0].fields[0].label = "Updated name";
  const saved = await rpc("save", { id, revision: 1, definition: next });
  ok(saved.version.revision === 2, "optimistic save revision increments");
  await deny(
    () => rpc("save", { id, revision: 1, definition: next }),
    "stale save rejects overwrite",
  );
  await deny(
    () => rpc("save", { id, definition: next }),
    "missing revision rejects overwrite",
  );
  await deny(
    () => rpc("publish", { id, version_id: saved.version.id, revision: 1 }),
    "stale publish rejects",
  );
  for (const [mut, label] of [
    [
      (d) => d.sections[0].fields.push({ ...d.sections[0].fields[0] }),
      "duplicate keys",
    ],
    [(d) => (d.conditions[0].source = "missing"), "broken conditions"],
    [
      (d) =>
        d.conditions.push({
          source: "child_count",
          operator: "is_not_empty",
          action: "show",
          target: "children",
        }),
      "cycles through sections",
    ],
    [(d) => (d.settings.redirect = "https://evil.example"), "open redirect"],
    [
      (d) => (d.sections[0].fields[0].validation = { pattern: ".*" }),
      "arbitrary pattern",
    ],
    [
      (d) => (d.conditions[0].operator = "greater_than"),
      "operator type mismatch",
    ],
  ]) {
    const d = definition();
    mut(d);
    await deny(
      () => rpc("save", { id, revision: 2, definition: d }),
      "reject " + label,
    );
  }
  const copy = await rpc("duplicate", { id });
  ok(
    copy.form.id !== id &&
      copy.version.definition.settings.public_available === false,
    "duplicate draft has independent identity/history",
  );
  await rpc("publish", { id, version_id: saved.version.id, revision: 2 });
  ok(
    (await rpc("detail", { id, submission_id: detail.id })).answers.find(
      (a) => a.field_key === "name",
    ).label_snapshot === "Your name",
    "new labels do not rewrite history",
  );
  await rpc("pause", { id });
  await as(null, "service_role");
  ok(
    !(await submit("synthetic-form", { ...body, request_key: uid() })).accepted,
    "paused form rejects new requests",
  );
  await as();
  await rpc("resume", { id });
  await rpc("archive", { id });
  ok(
    !(await rpc("list")).forms.some((f) => f.id === id),
    "archive absent active list",
  );
  ok(
    (await rpc("submissions", { id })).submissions.length === 1,
    "archive preserves submissions",
  );
  const pay = await rpc(
    "create",
    createPayload("synthetic-payment", paymentDefinition()),
  );
  await rpc("publish", {
    id: pay.form.id,
    version_id: pay.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  const pb = {
    request_key: uid(),
    version_id: pay.version.id,
    answers: { ...body.answers, fund: f.mainFund, amount: "2500" },
  };
  const payment = await submit("synthetic-payment", pb);
  ok(
    payment.accepted && payment.payment_status === "provider_not_configured",
    "payment submission held/no checkout",
  );
  ok(
    (await submit("synthetic-payment", pb)).reference === payment.reference,
    "payment retry one reference",
  );
  ok(
    (await count(
      `select count(*)n from giving_sessions where source='platform_form'`,
    )) === 1,
    "one canonical Giving Session",
  );
  ok(
    (await count(
      `select count(*)n from giving_ledger where source='platform_form'`,
    )) === 0,
    "no fabricated ledger money",
  );
  await as(null, "service_role");
  await deny(
    () =>
      submit("synthetic-payment", {
        ...pb,
        request_key: uid(),
        answers: { ...pb.answers, amount: "25.50" },
      }),
    "fractional minor units rejected",
  );
  await deny(
    () =>
      submit("synthetic-payment", {
        ...pb,
        request_key: uid(),
        answers: { ...pb.answers, fund: f.foreignPerson },
      }),
    "foreign fund rejected",
  );
  await as();
  const fee = await rpc(
    "create",
    createPayload("synthetic-fee", paymentDefinition("event_fee")),
  );
  await rpc("publish", {
    id: fee.form.id,
    version_id: fee.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  await submit("synthetic-fee", {
    ...pb,
    request_key: uid(),
    version_id: fee.version.id,
  });
  await owner();
  ok(
    (
      await q(
        "select bool_and(not tax_eligible)v from giving_session_lines l join giving_sessions s on s.id=l.session_id where s.guest_reference=$1",
        ["form:" + fee.form.id],
      )
    ).rows[0].v,
    "event fee never tax eligible despite contribution fund",
  );
  await as();
  const cap = definition();
  cap.settings.max_submissions = 1;
  const limited = await rpc("create", createPayload("synthetic-limit", cap));
  await rpc("publish", {
    id: limited.form.id,
    version_id: limited.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  const cb = { ...body, request_key: uid(), version_id: limited.version.id };
  ok(
    (await submit("synthetic-limit", cb)).accepted,
    "final submission slot admitted",
  );
  ok(
    !(await submit("synthetic-limit", { ...cb, request_key: uid() })).accepted,
    "capacity enforced server side",
  );
  ok(
    (await submit("synthetic-limit", cb)).accepted,
    "idempotent retry after full capacity",
  );
  await as(f.reader);
  await deny(
    () =>
      rpc("publish", {
        id: pay.form.id,
        version_id: pay.version.id,
        revision: 1,
      }),
    "editor is not publisher",
  );
  const editor = await rpc("draft", { id: pay.form.id });
  const changePay = structuredClone(editor.version.definition);
  changePay.payment.fixed_minor = "100";
  await deny(
    () => rpc("save", { id: pay.form.id, revision: 1, definition: changePay }),
    "editor cannot alter payment configuration",
  );
  await deny(
    () => rpc("submissions", { id: pay.form.id }),
    "editor cannot view submissions",
  );
  await deny(
    () => rpc("get", { id: pay.form.id }, f.other),
    "foreign direct ID denied",
  );
  await as(f.ordinary);
  await deny(
    () => rpc("get", { id: pay.form.id }),
    "ordinary staff builder denied",
  );
  await owner();
  const raw = (
    await q(
      "select tablename from pg_tables where schemaname='public'and tablename like 'platform_form%'",
    )
  ).rows;
  await as();
  for (const t of raw)
    await deny(
      () => q("select * from " + t.tablename),
      "raw " + t.tablename + " denied",
    );
  await owner();
  await q(
    "update organization_staff_permissions set revoked_at=now() where organization_id=$1 and user_id=$2 and permission like 'forms.%'",
    [f.org, f.admin],
  );
  await as();
  await deny(
    () => rpc("get", { id: pay.form.id }),
    "same-session Forms revocation",
  );
  await deny(
    () =>
      rpc("publish", {
        id: pay.form.id,
        version_id: pay.version.id,
        revision: 1,
      }),
    "same-session publish revocation",
  );
  await owner();
  await q(
    "update organization_staff_permissions set revoked_at=null where organization_id=$1 and user_id=$2 and permission like 'forms.%'",
    [f.org, f.admin],
  );
  await as();
  // File metadata, immutable upload policy, and scoped authority; no remote Storage is contacted.
  const fd = definition();
  fd.sections[0].fields.push({
    key: "attachment",
    type: "file",
    label: "Private document",
    required: true,
    file: {
      types: ["application/pdf"],
      max_bytes: 1000,
      visibility: "private",
    },
  });
  const fileForm = await rpc("create", createPayload("synthetic-files", fd));
  await rpc("publish", {
    id: fileForm.form.id,
    version_id: fileForm.version.id,
    revision: 1,
  });
  const fileBody = { request_key: uid(), version_id: fileForm.version.id };
  await as(null, "service_role");
  await deny(
    () =>
      submit(
        "synthetic-files",
        {
          ...fileBody,
          field_key: "attachment",
          filename: "bad.html",
          mime: "text/html",
          size_bytes: 10,
        },
        "reserve_file",
      ),
    "upload mime policy",
  );
  await deny(
    () =>
      submit(
        "synthetic-files",
        {
          ...fileBody,
          field_key: "attachment",
          filename: "big.pdf",
          mime: "application/pdf",
          size_bytes: 1001,
        },
        "reserve_file",
      ),
    "upload size policy",
  );
  const reserved = await submit(
    "synthetic-files",
    {
      ...fileBody,
      field_key: "attachment",
      filename: "synthetic.pdf",
      mime: "application/pdf",
      size_bytes: 42,
    },
    "reserve_file",
  );
  ok(
    reserved.accepted && reserved.bucket === "platform-form-files",
    "private upload reservation bound version/request/field",
  );
  await deny(
    () =>
      submit("synthetic-files", {
        ...fileBody,
        answers: { ...body.answers, attachment: reserved.id },
      }),
    "missing stored object rejected",
  );
  await owner();
  await q(
    "insert into storage.objects(bucket_id,name,metadata)values('platform-form-files',$1,$2)",
    [reserved.path, { size: 42, mimetype: "application/pdf" }],
  );
  await as(null, "service_role");
  const fileResult = await submit("synthetic-files", {
    ...fileBody,
    answers: { ...body.answers, attachment: reserved.id },
  });
  ok(fileResult.accepted, "authorized uploaded file attached exactly once");
  await as();
  const files = (await rpc("submissions", { id: fileForm.form.id }))
      .submissions[0],
    fileDetail = await rpc("detail", {
      id: fileForm.form.id,
      submission_id: files.id,
    });
  ok(fileDetail.files.length === 1, "file metadata only in guarded detail");
  ok(
    (
      await rpc("file_authorize", {
        id: fileForm.form.id,
        submission_id: files.id,
        file_id: reserved.id,
      })
    ).path === reserved.path,
    "current reader authorization exact path",
  );
  await as(null, "anon");
  await deny(
    () =>
      q("select forms_public_file($1,$2,$3)", [
        f.org,
        "synthetic-files",
        reserved.id,
      ]),
    "private upload cannot become anonymous download",
  );
  ok(
    (
      await q(
        "select * from storage.objects where bucket_id='platform-form-files'",
      )
    ).rows.length === 0,
    "private bucket has no anonymous object policy",
  );
  await owner();
  await q(
    "insert into private.platform_form_grants(organization_id,user_id,form_id,permissions)values($1,$2,$3,$4)",
    [
      f.org,
      f.ordinary,
      fileForm.form.id,
      ["forms.read", "forms.submissions.read"],
    ],
  );
  await as(f.ordinary);
  ok(
    (await rpc("context")).organizations[0].scoped_forms.length === 1,
    "explicit scoped Forms grant discovered",
  );
  ok(
    (await rpc("get", { id: fileForm.form.id })).form.id === fileForm.form.id,
    "scope grants exact form only",
  );
  await deny(
    () => rpc("get", { id: pay.form.id }),
    "scoped reader cannot guess another form",
  );
  await deny(
    () => rpc("save", { id: fileForm.form.id, revision: 1, definition: fd }),
    "scope does not imply edit",
  );
  await owner();
  await q(
    "update private.platform_form_grants set active=false where user_id=$1",
    [f.ordinary],
  );
  await as(f.ordinary);
  await deny(
    () => rpc("detail", { id: fileForm.form.id, submission_id: files.id }),
    "same-session scoped revocation",
  );
  await as();
  const multi = paymentDefinition();
  multi.sections[0].fields.find((x) => x.key === "fund").multiple = true;
  multi.sections[0].fields = multi.sections[0].fields.filter(
    (x) => x.key !== "amount",
  );
  delete multi.payment.amount_key;
  delete multi.payment.fund_key;
  multi.payment.lines_key = "fund";
  multi.payment.multiple_lines = true;
  const mf = await rpc("create", createPayload("synthetic-multi", multi));
  await rpc("publish", {
    id: mf.form.id,
    version_id: mf.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  ok(
    (
      await submit("synthetic-multi", {
        request_key: uid(),
        version_id: mf.version.id,
        answers: {
          ...body.answers,
          fund: [
            { fund_id: f.mainFund, amount_minor: "2000" },
            { fund_id: f.youthFund, amount_minor: "500" },
          ],
        },
      })
    ).accepted,
    "multi-fund uses one canonical session",
  );
  ok(
    (await count(
      `select count(*)n from giving_session_lines l join giving_sessions s on s.id=l.session_id where s.guest_reference='form:${mf.form.id}'`,
    )) === 2,
    "canonical multi-fund lines preserve designations",
  );
  await as();
  const pd = paymentDefinition();
  pd.sections[0].fields.push(
    { key: "pledge_amount", type: "currency", label: "Pledge amount" },
    {
      key: "frequency",
      type: "dropdown",
      label: "Frequency",
      options: [{ value: "monthly", label: "Monthly", active: true }],
    },
  );
  pd.payment.pledge_key = "pledge_amount";
  pd.payment.recurring_key = "frequency";
  pd.payment.frequencies = ["monthly"];
  const pf = await rpc("create", createPayload("synthetic-pledge", pd));
  await rpc("publish", {
    id: pf.form.id,
    version_id: pf.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  await submit("synthetic-pledge", {
    request_key: uid(),
    version_id: pf.version.id,
    answers: {
      ...body.answers,
      fund: f.mainFund,
      amount: "2500",
      pledge_amount: "10000",
      frequency: "monthly",
    },
  });
  await as();
  const ps = (await rpc("submissions", { id: pf.form.id })).submissions[0];
  await deny(
    () =>
      rpc("pledge", {
        id: pf.form.id,
        submission_id: ps.id,
        request_key: uid(),
      }),
    "unmatched submission cannot create pledge",
  );
  await rpc("link", {
    id: pf.form.id,
    submission_id: ps.id,
    revision: 1,
    person_id: f.person,
    reviewed: true,
  });
  const pl = await rpc("pledge", {
    id: pf.form.id,
    submission_id: ps.id,
    request_key: uid(),
  });
  ok(
    pl.id &&
      (
        await rpc("pledge", {
          id: pf.form.id,
          submission_id: ps.id,
          request_key: uid(),
        })
      ).id === pl.id,
    "reviewed canonical pledge linkage is idempotent",
  );
  const rec = await rpc("recurring", {
    id: pf.form.id,
    submission_id: ps.id,
    request_key: uid(),
  });
  await owner();
  ok(
    (
      await q(
        "select status,payment_profile_id from giving_recurring_instructions where id=$1",
        [rec.id],
      )
    ).rows[0].status === "draft",
    "reviewed recurring canonical draft stays held",
  );
  ok(
    (
      await q(
        "select count(*)n from platform_form_events where delivery_state<>'held'",
      )
    ).rows[0].n === 0,
    "all Forms communications held",
  );
  ok(
    (
      await q(
        "select public from storage.buckets where id='platform-form-files'",
      )
    ).rows[0].public === false,
    "bucket remains private",
  );
  await as();
  const defaults = definition();
  defaults.sections[0].fields.push(
    {
      key: "controlled",
      type: "short_text",
      label: "Read-only context",
      readonly: true,
      default: "canonical",
    },
    {
      key: "hidden_context",
      type: "hidden",
      label: "Hidden context",
      default: "canonical",
    },
  );
  defaults.conditions.push({
    source: "children",
    operator: "equals",
    value: true,
    action: "disable",
    target: "controlled",
  });
  const df = await rpc("create", createPayload("synthetic-defaults", defaults));
  await rpc("publish", {
    id: df.form.id,
    version_id: df.version.id,
    revision: 1,
  });
  await as(null, "service_role");
  for (const key of ["controlled", "hidden_context"])
    await deny(
      () =>
        submit("synthetic-defaults", {
          request_key: uid(),
          version_id: df.version.id,
          answers: { ...body.answers, [key]: "spoofed" },
        }),
      "canonical " + key + " cannot be overridden by condition",
    );
  ok(
    (
      await submit("synthetic-defaults", {
        request_key: uid(),
        version_id: df.version.id,
        answers: body.answers,
      })
    ).accepted,
    "server-owned defaults accepted without client values",
  );
  let quota;
  for (let i = 0; i < 121; i++)
    quota = await submit("synthetic-defaults", {}, "rate");
  ok(
    quota.accepted === false && quota.reason === "rate",
    "independent committed network quota caps requests",
  );
  await as();
  const exported = await rpc("export", { id: df.form.id });
  ok(
    exported.submissions[0].answers.some(
      (a) => a.field_key === "hidden_context" && a.text_value === "canonical",
    ),
    "version-aware export includes canonical answer rows",
  );
  await as(f.reader);
  await deny(
    () => rpc("export", { id: df.form.id }),
    "editor cannot export submission data",
  );
  await as();
  const publicFd = definition();
  publicFd.sections[0].fields.push({
    key: "public_attachment",
    type: "file",
    label: "Explicit public attachment",
    file: { types: ["text/plain"], max_bytes: 100, visibility: "public" },
  });
  const pu = await rpc(
    "create",
    createPayload("synthetic-public-file", publicFd),
  );
  await rpc("publish", {
    id: pu.form.id,
    version_id: pu.version.id,
    revision: 1,
  });
  const pk = uid();
  await as(null, "service_role");
  const pr = await submit(
    "synthetic-public-file",
    {
      request_key: pk,
      version_id: pu.version.id,
      field_key: "public_attachment",
      filename: "synthetic.txt",
      mime: "text/plain",
      size_bytes: 10,
    },
    "reserve_file",
  );
  await owner();
  await q(
    "insert into storage.objects(bucket_id,name,metadata)values('platform-form-files',$1,$2)",
    [pr.path, { size: 10, mimetype: "text/plain" }],
  );
  await as(null, "service_role");
  await submit("synthetic-public-file", {
    request_key: pk,
    version_id: pu.version.id,
    answers: { ...body.answers, public_attachment: pr.id },
  });
  await as(null, "anon");
  ok(
    (
      await q("select forms_public_file($1,$2,$3)v", [
        f.org,
        "synthetic-public-file",
        pr.id,
      ])
    ).rows[0].v.path === pr.path,
    "explicit public file policy authorizes only published bound object",
  );
  await deny(
    () =>
      q("select forms_public_file($1,$2,$3)v", [
        f.other,
        "synthetic-public-file",
        pr.id,
      ]),
    "public file foreign tenant denied",
  );
  await as();
  await rpc("pause", { id: pu.form.id });
  await as(null, "anon");
  await deny(
    () =>
      q("select forms_public_file($1,$2,$3)v", [
        f.org,
        "synthetic-public-file",
        pr.id,
      ]),
    "paused public file signing denied",
  );
  await owner();
  ok(
    (
      await q(
        "select bool_and(relrowsecurity)v from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('public','private')and c.relname like 'platform_form%'",
      )
    ).rows[0].v,
    "all Forms tables RLS enabled",
  );
  ok(
    (
      await q(
        "select count(*)n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'forms_%'and has_function_privilege('anon',p.oid,'execute')",
      )
    ).rows[0].n === 0,
    "anonymous cannot execute any private Forms helper",
  );
  ok(
    new Date(
      (
        await q(
          "select private.forms_instant('2026-11-01T09:00','America/Chicago')v",
        )
      ).rows[0].v,
    ).toISOString() === "2026-11-01T15:00:00.000Z",
    "availability uses configured timezone after DST boundary",
  );
  await as();
  const frozenName = (await pub("synthetic-payment")).name;
  const named = await rpc("draft", { id: pay.form.id });
  await rpc("save", {
    id: pay.form.id,
    revision: named.version.revision,
    definition: named.version.definition,
    name: "New draft name",
  });
  ok(
    (await pub("synthetic-payment")).name === frozenName,
    "draft header edit cannot mutate published presentation",
  );
  await owner();
  await deny(
    () =>
      q("update platform_form_submissions set version_id=$1 where id=$2", [
        pay.version.id,
        files.id,
      ]),
    "exact submission version identity immutable",
  );
  await owner();
  await q("update giving_funds set is_public=false where id=$1", [f.parent]);
  await as(null, "anon");
  const maskedFunds = await pub("synthetic-payment");
  ok(
    maskedFunds.funds.every((x) => x.parent_id !== f.parent && !x.parent_name),
    "private parent identity/label absent from public fund projection",
  );
  await as();
  for (const type of ["consent", "signature"]) {
    const dd = definition();
    dd.sections[0].fields.find((x) => x.type === type).default =
      type === "consent" ? true : "Pre-signed";
    await deny(
      () => rpc("create", createPayload("invalid-default-" + type, dd)),
      "no pre-affirmed " + type + " defaults",
    );
  }
  await as();
  const conflictForm = await rpc("create", createPayload("http-conflict-regression"));
  await assert.rejects(() => rpc("save", {
    id: conflictForm.form.id, revision: 0, definition: conflictForm.version.definition,
  }), (error) => error.code === "PT409");
  ok(true, "stale Forms revision uses non-retryable HTTP409 conflict code");
  await owner();
  ok((await q("select revision from platform_form_versions where id=$1", [conflictForm.version.id])).rows[0].revision === 1,
    "HTTP409 conflict preserves canonical draft revision");

  console.log(n + " Forms database/security checks passed");
} finally {
  await db.close();
}
