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
  ids,
  paymentsFixtureSQL as fixtureSQL,
  checkout,
} from "./payments-fixture.mjs";
const run = promisify(execFile),
  bin = process.env.TEST_POSTGRES_BIN || "/opt/homebrew/opt/postgresql@17/bin",
  exe = (x) => join(bin, x),
  root = mkdtempSync(join(tmpdir(), "payment-ops-giv3d-pg-")),
  data = join(root, "data"),
  socket = join(root, "socket");
mkdirSync(socket);
const existing = process.env.TEST_POSTGRES_EXISTING === "1",
  dbName = "giving_giv1_" + uid().replaceAll("-", ""),
  port = "55516",
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
  sql(
    fixtureSQL +
      `insert into organization_staff_permissions(organization_id,user_id,permission)select '${f.org}',u,k from unnest(array['${f.admin}','${f.reader}']::uuid[])u cross join unnest(private.payment_ops_permissions())k on conflict do nothing;`,
  );
  sql(`create table public.giving_test_barrier(run uuid,worker int,pid int,primary key(run,worker));create policy local_barrier on public.giving_test_barrier for all to authenticated,service_role using(true)with check(true);grant select,insert on giving_test_barrier to authenticated,service_role;
create function public.giving_test_race(run uuid,n int,service boolean,action text,p jsonb)returns jsonb language plpgsql security invoker as $$declare began numeric;answer jsonb;code text;deadline timestamptz:=clock_timestamp()+interval '20 seconds';begin while(select count(*)from giving_test_barrier b where b.run=giving_test_race.run)<n loop if clock_timestamp()>deadline then raise exception 'Barrier timeout';end if;perform pg_sleep(.01);end loop;began:=extract(epoch from clock_timestamp());begin if service then answer:=payment_operations_service(action,'${f.org}',p);else answer:=payment_operations(action,'${f.org}',p);end if;exception when unique_violation or check_violation or serialization_failure or raise_exception or sqlstate 'PT409' then get stacked diagnostics code=returned_sqlstate;answer:=jsonb_build_object('safe_conflict',code);end;return jsonb_build_object('pid',pg_backend_pid(),'start',began,'end',extract(epoch from clock_timestamp()),'answer',answer);end$$;grant execute on function giving_test_race(uuid,int,boolean,text,jsonb)to authenticated,service_role;`);
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
    });
  const coord = Number(await ask("select pg_backend_pid();"));
  const staff = (a, p = {}) =>
    JSON.parse(
      sql(
        `set request.jwt.claim.sub='${f.admin}';set role authenticated;select payment_operations(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`,
      ),
    );
  const service = (a, p) =>
    JSON.parse(
      sql(
        `set role service_role;select payment_operations_service(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`,
      ),
    );
  async function race(label, items) {
    const key = uid(),
      n = items.length;
    await ask(
      `begin;select pg_advisory_xact_lock(hashtextextended('giving:${f.org}',0));select 'locked';`,
    );
    const jobs = items.map(([service, action, p, user], i) =>
      run(
        exe("psql"),
        args.concat([
          "-c",
          `set request.jwt.claim.sub='${service ? "" : user || f.admin}';set role ${service ? "service_role" : "authenticated"};insert into giving_test_barrier values('${key}',${i},pg_backend_pid());`,
          "-c",
          `select giving_test_race('${key}',${n},${service},${lit(action)},${lit(JSON.stringify(p))});`,
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
      await ask(`select count(*)from giving_test_barrier where run='${key}';`),
    );
    await ask("commit;select 'released';");
    const rows = await Promise.all(jobs);
    assert.equal(active, n, label + " simultaneous lock wait");
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
          successes: rows.filter((r) => !r.answer.safe_conflict).length,
          safe_conflicts: rows.filter((r) => r.answer.safe_conflict).length,
        }),
    );
    return rows;
  }
  const repeat = (s, a, p) => Array.from({ length: 8 }, () => [s, a, p]),
    count = (s) => Number(sql(s));
  try {
    const prepared = JSON.parse(
      sql(
        `set request.jwt.claim.sub='${f.admin}';set role authenticated;select payments_workspace('checkout_prepare','${f.org}',${lit(JSON.stringify(checkout(uid())))});`,
      ),
    );
    const session = prepared.id;
    const leg = JSON.parse(
      sql(
        `select json_agg(id)from giving_transaction_legs where session_id='${session}'`,
      ),
    )[0];
    sql(
      `update giving_transaction_legs set status='captured'where session_id='${session}';`,
    );
    service("observe", {
      request_key: uid(),
      source_key: "synthetic-race-unknown",
      leg_id: leg,
      result: "unknown",
      failure_category: "unknown",
    });
    let issues = staff("queue").issues;
    const issue = issues.find((x) => x.issue_type === "payment_unknown");
    const a = await race(
      "A SAME ISSUE TWO STAFF",
      Array.from({ length: 8 }, (_, i) => [
        false,
        "claim",
        { request_key: uid(), id: issue.id, revision: 1 },
        i % 2 ? f.reader : f.admin,
      ]),
    );
    assert.equal(a.filter((x) => x.answer.claimed).length, 1);
    const refund = staff("refund_request", {
      request_key: uid(),
      leg_id: leg,
      amount_minor: "100",
      reason: "Synthetic race refund request",
    });
    const b = await race(
      "B REFUND APPROVAL",
      Array.from({ length: 8 }, () => [
        false,
        "refund_approve",
        {
          request_key: uid(),
          id: refund.id,
          reason: "Independent race review",
        },
        f.reader,
      ]),
    );
    assert.equal(b.filter((x) => x.answer.status === "approved").length, 1);
    const payload = {
      request_key: uid(),
      leg_id: leg,
      amount_minor: "100",
      reason: "Duplicate request race",
    };
    const c = await race(
      "C REFUND REQUEST",
      repeat(false, "refund_request", payload),
    );
    assert.equal(new Set(c.map((x) => x.answer.id)).size, 1);
    service("observe", {
      request_key: uid(),
      source_key: "synthetic-race-not-found",
      leg_id: leg,
      result: "not_found",
    });
    const d = await race(
      "D RETRY REQUEST",
      repeat(false, "retry", { request_key: uid(), id: issue.id }),
    );
    assert.equal(new Set(d.map((x) => x.answer.id)).size, 1);
    service("observe", {
      request_key: uid(),
      source_key: "synthetic-race-settlement",
      leg_id: leg,
      result: "settlement_mismatch",
      exception_type: "amount_mismatch",
    });
    const recon = staff("queue").issues.find(
      (x) => x.issue_type === "settlement_mismatch",
    );
    const e = await race(
      "E RECONCILIATION RESOLUTION",
      Array.from({ length: 8 }, () => [
        false,
        "reconcile",
        {
          request_key: uid(),
          id: recon.id,
          revision: 1,
          resolution_type: "resolved",
          reason: "Reviewed canonical settlement exception",
        },
      ]),
    );
    assert.equal(e.filter((x) => x.answer.resolution === "resolved").length, 1);
    const ri = JSON.parse(
      sql(
        `set request.jwt.claim.sub='${f.admin}';set role authenticated;select giving_workspace('recurring_create','${f.org}',${lit(JSON.stringify({ request_key: uid(), person_id: f.person, currency: "USD", frequency: "monthly", starts_on: "2026-10-01", next_run_at: "2026-11-01T10:00:00Z", lines: [{ fund_id: f.mainFund, amount_minor: 1000 }] }))});`,
      ),
    );
    staff("recurring_list");
    service("recurring_failure", {
      request_key: uid(),
      id: ri.id,
      failure_category: "declined",
    });
    const recur = staff("recurring_list").recurring.find((x) => x.id === ri.id);
    staff("recurring_retry", {
      request_key: uid(),
      id: ri.id,
      revision: recur.revision,
    });
    const job = sql(
      `select id from private.payment_ops_jobs where instruction_id='${ri.id}'`,
    );
    const fRace = await race(
      "F RECURRING RETRY LEASE",
      Array.from({ length: 8 }, () => [
        true,
        "claim",
        { request_key: uid(), id: job },
      ]),
    );
    assert.equal(fRace.filter((x) => x.answer.claimed).length, 1);
    assert.equal(
      count(
        `select count(*)from private.payment_ops_resolutions where issue_id='${recon.id}'`,
      ),
      1,
    );
    assert.equal(count("select count(*)from giving_ledger"), 0);
    console.log(
      "PASS SIX GIV-3D RACES; eight independent overlapping workers plus coordinator; one canonical transition; ZERO provider calls/financial posting.",
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
