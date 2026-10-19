
import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import path from "node:path";
const root=new URL("../",import.meta.url);
async function schema(){
 const db=new PGlite();
 for(const file of ["0001_core.sql","0002_domains.sql","0003_account_bootstrap.sql"]){
  const sql=await readFile(new URL("./migrations/"+file,root),"utf8");
  await db.exec(sql);
 }
 return db;
}
test("all migrations execute on a clean PostgreSQL engine",async()=>{
 const db=await schema();
 try{
  const relations=await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='app'");
  assert.ok(relations.rows[0].n>=50,"at least 50 normalized app tables");
  const policies=await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='app'");
  assert.ok(policies.rows[0].n>=6,"core owner and case policies");
  const rls=await db.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='app' AND c.relkind='r' AND c.relrowsecurity");
  assert.ok(rls.rows[0].n>=45,"all domain entities default to RLS");
 }finally{await db.close()}
});
test("case-event history cannot be edited or deleted even as the migration owner",async()=>{
 const db=await schema();
 try{
  const account=await db.query("INSERT INTO app.accounts(email) VALUES('sample@example.org') RETURNING id");
  const id=account.rows[0].id;
  const c=await db.query("INSERT INTO app.cases(created_by,title,category) VALUES($1,'Sample case','Records') RETURNING id",[id]);
  const caseId=c.rows[0].id;
  await db.query("INSERT INTO app.case_events(case_id,actor_id,event_type,digest,case_version) VALUES($1,$2,'Case opened',$3,1)",[caseId,id,"a".repeat(64)]);
  await assert.rejects(db.query("DELETE FROM app.case_events WHERE case_id=$1",[caseId]),/append-only/);
  await assert.rejects(db.query("UPDATE app.case_events SET public_note='changed' WHERE case_id=$1",[caseId]),/append-only/);
 }finally{await db.close()}
});
test("independently owned actor cases are hidden from a non-owner runtime role",async()=>{
 const db=await schema();
 try{
  const a=await db.query("INSERT INTO app.accounts(email) VALUES('first@example.org') RETURNING id");
  const b=await db.query("INSERT INTO app.accounts(email) VALUES('second@example.org') RETURNING id");
  await db.query("INSERT INTO app.cases(created_by,title,category) VALUES($1,'Private disagreement','Architectural')",[a.rows[0].id]);
  await db.exec("CREATE ROLE test_runtime; GRANT USAGE ON SCHEMA app TO test_runtime; GRANT SELECT ON app.cases TO test_runtime; GRANT EXECUTE ON FUNCTION app.current_actor() TO test_runtime; GRANT EXECUTE ON FUNCTION app.can_access_case(uuid) TO test_runtime;");
  await db.exec("SET ROLE test_runtime");
  const noActor=await db.query("SELECT count(*)::int AS count FROM app.cases");
  assert.equal(noActor.rows[0].count,0);
  await db.query("SELECT set_config('app.actor_id',$1,false)",[b.rows[0].id]);
  const other=await db.query("SELECT count(*)::int AS count FROM app.cases");
  assert.equal(other.rows[0].count,0);
  await db.query("SELECT set_config('app.actor_id',$1,false)",[a.rows[0].id]);
  const owner=await db.query("SELECT count(*)::int AS count FROM app.cases");
  assert.equal(owner.rows[0].count,1);
  await db.exec("RESET ROLE");
 }finally{await db.close()}
});
test("financial and mediation tables default deny runtime reads even for a current case owner",async()=>{
 const db=await schema();
 try{
  await db.exec("CREATE ROLE limited_runtime; GRANT USAGE ON SCHEMA app TO limited_runtime; GRANT SELECT ON app.mediation_private_materials,app.ledger_accounts TO limited_runtime; SET ROLE limited_runtime;");
  const mediation=await db.query("SELECT count(*)::int AS count FROM app.mediation_private_materials");
  assert.equal(mediation.rows[0].count,0);
  const money=await db.query("SELECT count(*)::int AS count FROM app.ledger_accounts");
  assert.equal(money.rows[0].count,0);
  await db.exec("RESET ROLE");
 }finally{await db.close()}
});
