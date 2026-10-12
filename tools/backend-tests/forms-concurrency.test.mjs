// Local PostgreSQL only: separate backends, committed barrier, observed lock wait and server intervals.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import {
  f,
  formsFixtureSQL,
  definition,
  createPayload,
  paymentDefinition,
} from "./forms-fixture.mjs";
const run = promisify(execFile),
  bin = process.env.TEST_POSTGRES_BIN || "/opt/homebrew/opt/postgresql@17/bin",
  exe = (x) => join(bin, x),
  root = mkdtempSync(join(tmpdir(), "forms-giv2c-pg-")),
  data = join(root, "data"),
  socket = join(root, "socket");
mkdirSync(socket);
const existing = process.env.TEST_POSTGRES_EXISTING === "1",
  dbName = "giving_giv1_" + uid().replaceAll("-", ""),
  port = "55514",
  args = [
    "-X",
    "-q",
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    socket,
    "-p",
    port,
    "-U",
    "postgres",
    "postgres",
  ],
  sql = (s) =>
    execFileSync(exe("psql"), args, {
      input: s,
      encoding: "utf8",
      maxBuffer: 5e6,
    }).trim(),
  lit = (s) => "'" + String(s).replaceAll("'", "''") + "'";
let started = false,
  created = false;
if (existing)
  args.splice(
    0,
    args.length,
    "-X",
    "-q",
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "-d",
    dbName,
  );
function overlap(rows) {
  let active = 0,
    max = 0;
  for (const [, delta] of rows
    .flatMap((r) => [
      [Number(r.start), 1],
      [Number(r.end), -1],
    ])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    active += delta;
    max = Math.max(active, max);
  }
  return max;
}
try {
  if (existing) {
    execFileSync(exe("createdb"), [dbName]);
    created = true;
  } else {
    execFileSync(
      exe("initdb"),
      [
        "-D",
        data,
        "--auth=trust",
        "-U",
        "postgres",
        "--locale=C",
        "--encoding=UTF8",
      ],
      { stdio: "inherit", env: { ...process.env, LC_ALL: "C", LANG: "C" } },
    );
    execFileSync(
      exe("pg_ctl"),
      [
        "-D",
        data,
        "-l",
        join(root, "pg.log"),
        "-o",
        `-k ${socket} -p ${port} -c listen_addresses=''`,
        "-w",
        "start",
      ],
      { stdio: "ignore" },
    );
    started = true;
  }
  let bootstrap = readFileSync(
    new URL("fixtures/supabase-test-bootstrap.sql", import.meta.url),
    "utf8",
  );
  if (existing) {
    assert.equal(
      execFileSync(
        exe("psql"),
        [
          "-X",
          "-A",
          "-t",
          "-d",
          "postgres",
          "-c",
          "select count(*) from pg_roles where rolname in('anon','authenticated','service_role')",
        ],
        { encoding: "utf8" },
      ).trim(),
      "3",
      "Existing test roles required; never modify cluster roles",
    );
    bootstrap = bootstrap.replace(
      "create role anon; create role authenticated; create role service_role bypassrls;",
      "",
    );
  }
  sql(bootstrap);
  // All remaining objects are isolated to this disposable database.
  let autoRls = readFileSync(
    new URL("../../supabase/bootstrap/automatic-rls.sql", import.meta.url),
    "utf8",
  );
  if (existing) {
    const localOwner = sql(
      "select current_user where exists(select 1 from pg_roles where rolname=current_user and rolsuper)",
    );
    assert.match(localOwner, /^[a-zA-Z0-9_]+$/);
    autoRls = autoRls.replaceAll("'postgres'", lit(localOwner));
  }
  sql(autoRls);
  for (const file of migrationOrder)
    sql(
      readFileSync(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  sql(formsFixtureSQL);
  sql(`insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','forms.publish');
create table public.forms_test_barrier(run uuid,worker int,pid int,primary key(run,worker));create policy local_barrier on forms_test_barrier for all to authenticated,service_role using(true)with check(true);grant select,insert on forms_test_barrier to authenticated,service_role;
create function public.forms_test_race(run uuid,n int,service boolean,action text,slug text,p jsonb)returns jsonb language plpgsql security invoker as $$declare began numeric;answer jsonb;code text;deadline timestamptz:=clock_timestamp()+interval '20 seconds';begin
 while(select count(*)from forms_test_barrier b where b.run=forms_test_race.run)<n loop if clock_timestamp()>deadline then raise exception 'Barrier timeout';end if;perform pg_sleep(.01);end loop;began:=extract(epoch from clock_timestamp());
 begin if service then answer:=forms_gateway(action,'${f.org}',slug,p,repeat('a',64));else answer:=forms_workspace(action,'${f.org}',p);end if;exception when unique_violation or check_violation or serialization_failure or raise_exception then get stacked diagnostics code=returned_sqlstate;answer:=jsonb_build_object('safe_conflict',code);end;
 return jsonb_build_object('pid',pg_backend_pid(),'start',began,'end',extract(epoch from clock_timestamp()),'answer',answer);end$$;grant execute on function forms_test_race(uuid,int,boolean,text,text,jsonb)to authenticated,service_role;`);
  const coordinator = execFile(exe("psql"), args, { maxBuffer: 2e6 }),
    pending = [];
  let buffer = "";
  coordinator.stdout.on("data", (s) => {
    buffer += s;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line && pending.length) pending.shift()(line);
    }
  });
  const ask = (s) =>
      new Promise((resolve) => {
        pending.push(resolve);
        coordinator.stdin.write(s + "\n");
      }),
    coord = Number(await ask("select pg_backend_pid();"));
  const staff = (a, p) =>
    JSON.parse(
      sql(
        `set request.jwt.claim.sub='${f.admin}';set role authenticated;select forms_workspace(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`,
      ),
    );
  async function race(label, items) {
    const key = uid(),
      n = items.length;
    await ask(
      `begin;select pg_advisory_xact_lock(hashtextextended('forms:${f.org}',0));select 'locked';`,
    );
    const jobs = items.map(([service, action, slug, p], i) =>
      run(
        exe("psql"),
        args.concat([
          "-c",
          `set request.jwt.claim.sub='${service ? "" : i % 2 ? f.reader : f.admin}';set role ${service ? "service_role" : "authenticated"};insert into forms_test_barrier values('${key}',${i},pg_backend_pid());`,
          "-c",
          `select forms_test_race('${key}',${n},${service},${lit(action)},${lit(slug)},${lit(JSON.stringify(p))});`,
        ]),
        { maxBuffer: 1e6 },
      ).then((r) => JSON.parse(r.stdout.trim())),
    );
    const until = Date.now() + 20000;
    let active = 0;
    while (Date.now() < until) {
      active = Number(
        await ask(
          `select pg_stat_clear_snapshot();select count(*)from pg_stat_activity where pid<>pg_backend_pid()and query like '%${key}%'and state='active'and wait_event_type='Lock';`,
        ),
      );
      if (active === n) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const ready = Number(
      await ask(`select count(*)from forms_test_barrier where run='${key}';`),
    );
    await ask("commit;select 'released';");
    const rows = await Promise.all(jobs);
    assert.equal(active, n, label + " simultaneous blocked calls");
    assert.equal(ready, n);
    assert.equal(new Set(rows.map((r) => r.pid)).size, n);
    assert(rows.every((r) => r.pid !== coord));
    assert.equal(overlap(rows), n);
    console.log(
      "PASS " +
        label +
        " " +
        JSON.stringify({
          workers: n,
          distinct_backends: n,
          coordinator_separate: true,
          server_barrier_ready: ready,
          peak_active_queries: active,
          max_overlapping_intervals: overlap(rows),
          successes: rows.filter(
            (r) => !r.answer.safe_conflict && r.answer.accepted !== false,
          ).length,
          safe_conflicts: rows.filter(
            (r) => r.answer.safe_conflict || r.answer.accepted === false,
          ).length,
        }),
    );
    return rows;
  }
  const repeat = (service, a, slug, p) =>
      Array.from({ length: 8 }, () => [service, a, slug, p]),
    count = (s) => Number(sql(s)),
    answers = {
      name: "Synthetic Name",
      email: "synthetic@example.test",
      children: false,
    };
  try {
    const a = staff("create", createPayload("publish-race")),
      ap = { id: a.form.id, version_id: a.version.id, revision: 1 };
    const ar = await race(
      "A PUBLISH SAME DRAFT",
      repeat(false, "publish", "", ap),
    );
    assert.equal(new Set(ar.map((r) => r.answer.version.id)).size, 1);
    assert.equal(
      count(
        `select count(*)from platform_form_versions where form_id='${a.form.id}'and state='published'`,
      ),
      1,
    );
    const b = staff("draft", { id: a.form.id }),
      bp = { id: a.form.id, revision: 1, definition: b.version.definition };
    const br = await race(
      "B SAME EDITOR REVISION",
      repeat(false, "save", "", bp),
    );
    assert.equal(br.filter((r) => !r.answer.safe_conflict).length, 1);
    assert.equal(
      br.filter((r) => r.answer.safe_conflict === "40001").length,
      7,
    );
    const cp = { request_key: uid(), version_id: a.version.id, answers };
    const cr = await race(
      "C DUPLICATE PUBLIC SUBMISSION",
      repeat(true, "submit", "publish-race", cp),
    );
    assert.equal(new Set(cr.map((r) => r.answer.reference)).size, 1);
    assert.equal(
      count(
        `select count(*)from platform_form_submissions where form_id='${a.form.id}'`,
      ),
      1,
    );
    const d = staff(
      "create",
      createPayload("payment-race", paymentDefinition()),
    );
    staff("publish", { id: d.form.id, version_id: d.version.id, revision: 1 });
    const dp = {
      request_key: uid(),
      version_id: d.version.id,
      answers: { ...answers, fund: f.mainFund, amount: "2500" },
    };
    await race(
      "D PAYMENT SESSION IDEMPOTENCY",
      repeat(true, "submit", "payment-race", dp),
    );
    assert.equal(
      count(
        `select count(*)from platform_form_submissions where form_id='${d.form.id}'`,
      ),
      1,
    );
    assert.equal(
      count(
        `select count(*)from giving_sessions where guest_reference='form:${d.form.id}'`,
      ),
      1,
    );
    assert.equal(
      count(`select count(*)from giving_ledger where source='platform_form'`),
      0,
    );
    const limit = definition();
    limit.settings.max_submissions = 1;
    const e = staff("create", createPayload("capacity-race", limit));
    staff("publish", { id: e.form.id, version_id: e.version.id, revision: 1 });
    const er = await race(
      "E FINAL CAPACITY SLOT",
      Array.from({ length: 8 }, () => [
        true,
        "submit",
        "capacity-race",
        { request_key: uid(), version_id: e.version.id, answers },
      ]),
    );
    assert.equal(er.filter((r) => r.answer.accepted === true).length, 1);
    assert.equal(
      count(
        `select count(*)from platform_form_submissions where form_id='${e.form.id}'`,
      ),
      1,
    );
    const field = staff("create", createPayload("field-key-race")),
      fd = field.version.definition;
    fd.sections[0].fields.push({
      key: "shared_key",
      type: "short_text",
      label: "Concurrent field",
    });
    const fr = await race(
      "F DUPLICATE FIELD KEY CREATION",
      repeat(false, "save", "", {
        id: field.form.id,
        revision: 1,
        definition: fd,
      }),
    );
    assert.equal(fr.filter((r) => !r.answer.safe_conflict).length, 1);
    assert.equal(
      count(
        `select count(*)from platform_form_fields where version_id='${field.version.id}'and field_key='shared_key'`,
      ),
      1,
    );
    console.log(
      "PASS six real PostgreSQL Forms races, eight independent overlapping backends + separate coordinator, local synthetic database only",
    );
  } finally {
    coordinator.stdin.end();
    await new Promise((r) => coordinator.once("exit", r));
  }
} finally {
  if (created) execFileSync(exe("dropdb"), ["--force", dbName]);
  if (started)
    execFileSync(exe("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], {
      stdio: "ignore",
    });
  rmSync(root, { recursive: true, force: true });
}
