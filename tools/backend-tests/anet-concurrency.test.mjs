// Local PostgreSQL only: separate backends, committed barrier, observed lock wait and server intervals.
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID as uid } from "node:crypto";
import { migrationOrder } from "./migration-order.mjs";
import { f, ids, fixtureSQL, checkout } from "./anet-fixture.mjs";
const run = promisify(execFile),
  bin = process.env.TEST_POSTGRES_BIN || "/opt/homebrew/opt/postgresql@17/bin",
  exe = (x) => join(bin, x),
  root = mkdtempSync(join(tmpdir(), "payments-giv3c-pg-")),
  data = join(root, "data"),
  socket = join(root, "socket");
mkdirSync(socket);
const existing = process.env.TEST_POSTGRES_EXISTING === "1",
  dbName = "giving_giv1_" + uid().replaceAll("-", ""),
  port = "55515",
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
  sql(fixtureSQL);
  sql(`create table public.giving_test_barrier(run uuid,worker int,pid int,primary key(run,worker));create policy local_barrier on public.giving_test_barrier for all to authenticated,service_role using(true)with check(true);grant select,insert on giving_test_barrier to authenticated,service_role;
create function public.giving_test_race(run uuid,n int,service boolean,action text,p jsonb)returns jsonb language plpgsql security invoker as $$declare began numeric;answer jsonb;code text;deadline timestamptz:=clock_timestamp()+interval '20 seconds';begin while(select count(*)from giving_test_barrier b where b.run=giving_test_race.run)<n loop if clock_timestamp()>deadline then raise exception 'Barrier timeout';end if;perform pg_sleep(.01);end loop;began:=extract(epoch from clock_timestamp());begin if service then answer:=payments_service(action,'${f.org}',p);else answer:=payments_workspace(action,'${f.org}',p);end if;exception when unique_violation or check_violation or serialization_failure or raise_exception or sqlstate 'PT409' then get stacked diagnostics code=returned_sqlstate;answer:=jsonb_build_object('safe_conflict',code);end;return jsonb_build_object('pid',pg_backend_pid(),'start',began,'end',extract(epoch from clock_timestamp()),'answer',answer);end$$;grant execute on function giving_test_race(uuid,int,boolean,text,jsonb)to authenticated,service_role;`);
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
  const staff = (a, p) =>
    JSON.parse(
      sql(
        `set request.jwt.claim.sub='${f.admin}';set role authenticated;select payments_workspace(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`,
      ),
    );
  const service = (a, p) =>
    JSON.parse(
      sql(
        `set role service_role;select payments_service(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`,
      ),
    );
  async function race(label, items) {
    const key = uid(),
      n = items.length;
    await ask(
      `begin;select pg_advisory_xact_lock(hashtextextended('giving:${f.org}',0));select 'locked';`,
    );
    const jobs = items.map(([service, action, p], i) =>
      run(
        exe("psql"),
        args.concat([
          "-c",
          `set request.jwt.claim.sub='${service ? "" : f.admin}';set role ${service ? "service_role" : "authenticated"};insert into giving_test_barrier values('${key}',${i},pg_backend_pid());`,
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
    const a = await race(
      "A DUPLICATE CHECKOUT",
      repeat(false, "checkout_prepare", checkout(uid())),
    );
    assert.equal(new Set(a.map((r) => r.answer.id)).size, 1);
    const session = a[0].answer.id;
    assert.equal(
      count(`select count(*)from giving_sessions where id='${session}'`),
      1,
    );
    assert.equal(
      count(
        `select count(*)from giving_transaction_legs where session_id='${session}'`,
      ),
      3,
    );
    const legs = JSON.parse(
      sql(
        `select json_agg(row_to_json(l))from giving_transaction_legs l where session_id='${session}'`,
      ),
    );
    const leg = legs.find(
      (l) => l.route_snapshot.processor_route_id === ids.secondANRoute,
    );
    const op = service("operation_prepare", {
      request_key: uid(),
      leg_id: leg.id,
      operation: "sale",
      amount_minor: String(leg.amount_minor),
    });
    const b = await race(
      "B PROVIDER OPERATION LEASE",
      repeat(true, "operation_claim", { id: op.id }),
    );
    assert.equal(b.filter((r) => r.answer.claimed).length, 1);
    assert(b.every((r) => r.answer.execution === "held"));
    const wh = {
      gateway_id: ids.secondAN,
      route_id: ids.secondANRoute,
      leg_id: leg.id,
      event_reference: "synth:race-event",
      body_digest: "a".repeat(64),
      normalized_status: "captured",
      signature_verified: true,
    };
    const c = await race(
      "C WEBHOOK DEDUPLICATION",
      repeat(true, "synthetic_webhook", wh),
    );
    assert.equal(new Set(c.map((r) => r.answer.id)).size, 1);
    assert.equal(
      count(
        "select count(*)from private.payments_webhooks where event_reference='synth:race-event'",
      ),
      1,
    );
    assert.equal(count("select count(*)from giving_ledger"), 0);
    const voidLeg = legs.find(
      (l) => l.route_snapshot.gateway_id !== leg.route_snapshot.gateway_id,
    );
    sql(
      `update giving_transaction_legs set status='authorized'where id='${voidLeg.id}'`,
    );
    const voidRace = await race(
      "D VOID REQUEST",
      repeat(false, "void_request", {
        request_key: uid(),
        leg_id: voidLeg.id,
        amount_minor: String(voidLeg.amount_minor),
        reason: "Synthetic offline void foundation",
      }),
    );
    assert.equal(new Set(voidRace.map((r) => r.answer.id)).size, 1);
    assert.equal(
      count(
        `select count(*)from giving_refunds where leg_id='${voidLeg.id}'and kind='void'`,
      ),
      1,
    );
    const voidOp = service("operation_prepare", {
      request_key: uid(),
      leg_id: voidLeg.id,
      operation: "void",
      amount_minor: String(voidLeg.amount_minor),
      refund_id: voidRace[0].answer.id,
    });
    const voidClaims = await race(
      "D2 VOID PROVIDER LEASE",
      repeat(true, "operation_claim", { id: voidOp.id }),
    );
    assert.equal(voidClaims.filter((r) => r.answer.claimed).length, 1);
    sql(
      `update giving_transaction_legs set status='captured'where id='${leg.id}';`,
    );
    const e = await race(
      "E REFUND REQUEST",
      repeat(false, "refund_request", {
        request_key: uid(),
        leg_id: leg.id,
        amount_minor: "1000",
        reason: "Synthetic offline refund foundation",
      }),
    );
    assert.equal(new Set(e.map((r) => r.answer.id)).size, 1);
    assert.equal(
      count(`select count(*)from giving_refunds where leg_id='${leg.id}'`),
      1,
    );
    assert.equal(count("select count(*)from giving_ledger"), 0);
    const refundOp = service("operation_prepare", {
      request_key: uid(),
      leg_id: leg.id,
      operation: "refund",
      amount_minor: "1000",
      refund_id: e[0].answer.id,
    });
    const refundClaims = await race(
      "E2 REFUND PROVIDER LEASE",
      repeat(true, "operation_claim", { id: refundOp.id }),
    );
    assert.equal(refundClaims.filter((r) => r.answer.claimed).length, 1);
    const recurring = JSON.parse(
      sql(
        `set request.jwt.claim.sub='${f.admin}';set role authenticated;select giving_workspace('recurring_create','${f.org}',${lit(
          JSON.stringify({
            request_key: uid(),
            person_id: f.person,
            currency: "USD",
            frequency: "monthly",
            starts_on: "2026-01-01",
            next_run_at: "2026-10-14T00:00:00Z",
            lines: [
              { fund_id: f.youthFund, amount_minor: 1000 },
              { fund_id: ids.outreachFund, amount_minor: 2000 },
            ],
          }),
        )});`,
      ),
    );
    const fRace = await race(
      "F RECURRING EXECUTION LEASE",
      repeat(true, "recurring_claim", {
        id: recurring.id,
        scheduled_at: "2026-10-14T00:00:00Z",
      }),
    );
    assert.equal(fRace.filter((r) => r.answer.claimed).length, 1);
    assert.equal(
      count(
        `select count(*)from private.payments_recurring_jobs where instruction_id='${recurring.id}'`,
      ),
      1,
    );
    console.log(
      "PASS SIX REQUIRED GIV-3C CASES / EIGHT INDEPENDENT RACES; independent overlapping PostgreSQL sessions; no provider network calls or real payments.",
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
