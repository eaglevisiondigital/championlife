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
import {seed,form,cap,network} from "./nmi-execution-fixture.mjs";
const run = promisify(execFile),
  bin = process.env.TEST_POSTGRES_BIN || "/opt/homebrew/opt/postgresql@17/bin",
  exe = (x) => join(bin, x),
  root = mkdtempSync(join(tmpdir(), "nmi-execution-pg-")),
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
  sql(fixtureSQL);sql(seed);
  sql(`create table public.giving_test_barrier(run uuid,worker int,pid int,primary key(run,worker));create policy local_barrier on public.giving_test_barrier for all to authenticated,service_role using(true)with check(true);grant select,insert on giving_test_barrier to authenticated,service_role;
create function public.giving_test_race(run uuid,n int,service boolean,action text,p jsonb)returns jsonb language plpgsql security invoker as $$declare began numeric;answer jsonb;code text;deadline timestamptz:=clock_timestamp()+interval '20 seconds';begin while(select count(*)from giving_test_barrier b where b.run=giving_test_race.run)<n loop if clock_timestamp()>deadline then raise exception 'Barrier timeout';end if;perform pg_sleep(.01);end loop;began:=extract(epoch from clock_timestamp());begin if service then answer:=nmi_giving_service(action,'${f.org}',p);else answer:=nmi_giving_service(action,'${f.org}',p);end if;exception when unique_violation or check_violation or serialization_failure or raise_exception or sqlstate 'PT409' then get stacked diagnostics code=returned_sqlstate;answer:=jsonb_build_object('safe_conflict',code);end;return jsonb_build_object('pid',pg_backend_pid(),'start',began,'end',extract(epoch from clock_timestamp()),'answer',answer);end$$;grant execute on function giving_test_race(uuid,int,boolean,text,jsonb)to authenticated,service_role;`);
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
        `set role service_role;select nmi_giving_service(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`,
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
    const payload={form_id:form,request_key:uid(),capability_hash:cap,network_hash:network,receipt_email:'synthetic-race@example.test',donor_name:'Synthetic race',frequency:'once',lines:[{fund_id:f.mainFund,amount_minor:'2500'}]};
    const made=await race('EXECUTION ANONYMOUS CREATE',repeat(true,'create',payload));assert.equal(new Set(made.map(x=>x.answer.session_id)).size,1);
    const session=made[0].answer,session_id=session.session_id,leg_id=session.legs[0].id;
    const intent={session_id,leg_id,operation:'sale',request_key:uid(),capability_hash:cap};
    const prepared=await race('EXECUTION IDEMPOTENT PREPARE',repeat(true,'prepare',intent));assert.equal(new Set(prepared.map(x=>x.answer.id)).size,1);const id=prepared[0].answer.id;
    const claimed=await race('EXECUTION CLAIM ONCE',repeat(true,'claim',{session_id,id}));assert.equal(claimed.filter(x=>x.answer.claimed).length,1);const lease=claimed.find(x=>x.answer.claimed).answer.lease;
    const handoff=await race('EXECUTION HANDOFF ONCE',repeat(true,'handoff',{session_id,id,lease}));assert.equal(handoff.filter(x=>x.answer.claimed).length,1);
    const outcome={session_id,id,lease,status:'settled',authoritative:true,provider_reference:'synthetic-native-execution',amount_minor:'2500',currency:'USD',processor_id:'synthetic-main'};
    const completed=await race('EXECUTION LEDGER + RECEIPT ONCE',repeat(true,'complete',outcome));assert.equal(completed.filter(x=>!x.answer.safe_conflict).length,1);
    assert.equal(count(`select count(*)from giving_ledger where session_id='${session_id}'`),1);assert.equal(count(`select count(*)from private.nmi_giving_receipt_outbox`),1);
    const duplicate=await race('EXECUTION DISTINCT KEY CANNOT RECHARGE',Array.from({length:8},()=>[true,'prepare',{...intent,request_key:uid()}]));assert.equal(duplicate.filter(x=>x.answer.safe_conflict).length,8);
    const event={gateway_id:f.nmi,event_id:'synthetic-native-webhook',digest:'c'.repeat(64),merchant_reference:'synthetic-merchant',processor_id:'synthetic-main',provider_reference:'synthetic-native-execution',kind:'transaction',status:'captured'};
    const replay=await race('EXECUTION WEBHOOK DEDUPE',repeat(true,'webhook',event));assert.equal(replay.filter(x=>x.answer.lookup_id).length,1);assert.equal(count('select count(*)from private.nmi_giving_events'),1);
    const second=service('create',{...payload,request_key:uid(),receipt_email:'synthetic-different-key@example.test'});
    const competing=await race('EXECUTION DIFFERENT REQUEST KEYS ONE INTENT',Array.from({length:8},()=>[true,'prepare',{session_id:second.session_id,leg_id:second.legs[0].id,operation:'sale',request_key:uid(),capability_hash:cap}]));assert.equal(competing.filter(x=>!x.answer.safe_conflict).length,1);
    sql(`insert into organization_staff_permissions(organization_id,user_id,permission)values('${f.org}','${f.reader}','payments.refund.approve')on conflict do nothing`);
    const finance=(a,p,u=f.admin)=>JSON.parse(sql(`set request.jwt.claim.sub='${u}';set role authenticated;select payment_operations(${lit(a)},'${f.org}',${lit(JSON.stringify(p))});`));
    const adjustment=finance('refund_request',{request_key:uid(),leg_id,amount_minor:'500',reason:'SYNTHETIC native race refund'});finance('refund_approve',{request_key:uid(),id:adjustment.id,reason:'SYNTHETIC second reviewer'},f.reader);
    const refundIntent={session_id,leg_id,actor_id:f.admin,refund_id:adjustment.id,operation:'refund',request_key:uid()};
    const refundPrepared=await race('EXECUTION REFUND PREPARE ONCE',repeat(true,'prepare',refundIntent));assert(refundPrepared.every(x=>x.answer.id));assert.equal(new Set(refundPrepared.map(x=>x.answer.id)).size,1);
    const refundOp=refundPrepared[0].answer,refundClaim=service('claim',{session_id,id:refundOp.id});service('handoff',{session_id,id:refundOp.id,lease:refundClaim.lease});
    const refundDone=await race('EXECUTION REFUND PRINCIPAL ONCE',repeat(true,'complete',{session_id,id:refundOp.id,lease:refundClaim.lease,status:'refunded',authoritative:true,provider_reference:'synthetic-race-refund',amount_minor:'500',currency:'USD',processor_id:'synthetic-main'}));
    assert.equal(refundDone.filter(x=>!x.answer.safe_conflict).length,1);assert.equal(count(`select sum(amount_minor)from giving_ledger where leg_id='${leg_id}'`),2000);assert.equal(count(`select count(*)from giving_refund_outcomes where refund_id='${adjustment.id}'`),1);
    sql(`update private.nmi_giving_checkouts set created_at=now()-interval '1 day'where session_id='${second.session_id}'`);
    const aged=await race('EXECUTION AGED UNKNOWN CROSS-SESSION DENIAL',Array.from({length:8},()=>[true,'create',{...payload,request_key:uid(),receipt_email:'synthetic-different-key@example.test'}]));assert.equal(aged.filter(x=>x.answer.safe_conflict).length,8);
    console.log('11 dedicated NMI execution native races passed; eight overlapping workers + coordinator each; one canonical gift/receipt; zero real provider calls');

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
