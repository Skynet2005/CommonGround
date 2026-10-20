import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
test("private database authentication functions are permissioned and replay-safe",async()=>{
 const db=new PGlite();
 try{
  for(const p of ["0001_core","0002_domains","0003_account_bootstrap","0004_auth_privileges","0005_case_room"])
   await db.exec(await readFile(new URL("../migrations/"+p+".sql",import.meta.url),"utf8"));
  await db.exec("CREATE ROLE commonground_runtime");
  await db.exec(await readFile(new URL("../ops/runtime-grants.sql",import.meta.url),"utf8"));
  await db.exec("SET ROLE commonground_runtime");
  await assert.rejects(db.query("SELECT * FROM app.login_tokens"),/permission denied/i);
  await assert.rejects(db.query("SELECT app.upsert_verified_account($1)",["unauthorized@example.org"]),/permission denied/i);
  const token="a".repeat(64),session="b".repeat(64);
  const created=await db.query("SELECT app.auth_issue_link($1,$2,$3) AS id",["pilot@example.org",token,"c".repeat(64)]);
  assert.ok(created.rows[0].id);
  const first=await db.query("SELECT * FROM app.auth_accept_link($1,$2)",[token,session]);
  assert.equal(first.rows.length,1);
  const again=await db.query("SELECT * FROM app.auth_accept_link($1,$2)",[token,"d".repeat(64)]);
  assert.equal(again.rows.length,0);
  const active=await db.query("SELECT app.auth_session_account($1) AS id",[session]);
  assert.equal(active.rows[0].id,first.rows[0].account_id);
  await db.query("SELECT app.auth_revoke_session($1)",[session]);
  const ended=await db.query("SELECT app.auth_session_account($1) AS id",[session]);
  assert.equal(ended.rows[0].id,null);
 }finally{await db.close()}
});
