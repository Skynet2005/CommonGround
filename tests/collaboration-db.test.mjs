import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";

const files=["0001_core","0002_domains","0003_account_bootstrap","0004_auth_privileges","0005_case_room"];
const owner=randomUUID(),guest=randomUUID(),outsider=randomUUID(),caseId=randomUUID();
async function seeded(){
 const db=new PGlite();
 for(const name of files)await db.exec(await readFile(new URL("../migrations/"+name+".sql",import.meta.url),"utf8"));
 await db.exec("CREATE ROLE commonground_runtime");
 await db.exec(await readFile(new URL("../ops/runtime-grants.sql",import.meta.url),"utf8"));
 for(const [id,email] of [[owner,"owner@example.test"],[guest,"guest@example.test"],[outsider,"outsider@example.test"]])
  await db.query("INSERT INTO app.accounts(id,email,email_verified_at) VALUES($1,$2,now())",[id,email]);
 await db.query("INSERT INTO app.cases(id,created_by,title,category) VALUES($1,$2,$3,$4)",
   [caseId,owner,"Shared case access test","Architectural"]);
 return db;
}
async function as(db,actor,sql,args=[]){
 await db.exec("BEGIN");
 try{
  await db.exec("SET LOCAL ROLE commonground_runtime");
  await db.query("SELECT set_config('app.actor_id',$1,true)",[actor]);
  const result=await db.query(sql,args);
  await db.exec("COMMIT");return result;
 }catch(e){await db.exec("ROLLBACK").catch(()=>{});throw e}
}
const token="a".repeat(64),fingerprint="b".repeat(64);
test("invitation accepts only verified intended mailbox once, never elevates HOA role",async()=>{
 const db=await seeded();
 try{
  await assert.rejects(as(db,outsider,"SELECT app.case_issue_invite($1,$2,$3,$4)",[caseId,"guest@example.test",token,fingerprint]),/Only the active case creator/);
  const sent=await as(db,owner,"SELECT app.case_issue_invite($1,$2,$3,$4) AS id",[caseId,"guest@example.test",token,fingerprint]);
  assert.ok(sent.rows[0].id);
  const pending=await as(db,owner,"SELECT * FROM app.case_pending_invites($1)",[caseId]);
  assert.equal(pending.rows.length,1);
  await assert.rejects(as(db,guest,"SELECT * FROM app.case_invites"),/permission denied/i);
  const impostor=await as(db,outsider,"SELECT * FROM app.case_accept_invite($1)",[token]);
  assert.equal(impostor.rows.length,0);
  const accepted=await as(db,guest,"SELECT * FROM app.case_accept_invite($1)",[token]);
  assert.equal(accepted.rows.length,1);
  assert.equal(accepted.rows[0].accepted_role,"observer");
  const replay=await as(db,guest,"SELECT * FROM app.case_accept_invite($1)",[token]);
  assert.equal(replay.rows.length,0);
  const members=await as(db,guest,"SELECT * FROM app.case_room_members($1)",[caseId]);
  assert.equal(members.rows.length,2);
  assert.deepEqual(members.rows.map(x=>x.member_email).sort(),["guest@example.test","owner@example.test"]);
  const update=await as(db,guest,"UPDATE app.cases SET title='Changed' WHERE id=$1 RETURNING id",[caseId]); assert.equal(update.rows.length,0);
 }finally{await db.close()}
});

test("notes isolate case membership, private authors and receipts; revocation closes access",async()=>{
 const db=await seeded();
 try{
  const invite=await as(db,owner,"SELECT app.case_issue_invite($1,$2,$3,$4) AS id",[caseId,"guest@example.test",token,fingerprint]);
  await as(db,guest,"SELECT * FROM app.case_accept_invite($1)",[token]);
  const privateId=(await as(db,owner,"INSERT INTO app.case_room_notes(case_id,author_id,visibility,statement) VALUES($1,$2,'private','Privileged author-only draft, not shared') RETURNING id",[caseId,owner])).rows[0].id;
  const sharedId=(await as(db,owner,"INSERT INTO app.case_room_notes(case_id,author_id,visibility,statement) VALUES($1,$2,'shared','Shared factual account for review') RETURNING id",[caseId,owner])).rows[0].id;
  const seenGuest=await as(db,guest,"SELECT id FROM app.case_room_notes WHERE case_id=$1",[caseId]);
  assert.deepEqual(seenGuest.rows.map(x=>x.id),[sharedId]);
  assert.equal((await as(db,outsider,"SELECT id FROM app.case_room_notes WHERE case_id=$1",[caseId])).rows.length,0);
  await assert.rejects(as(db,outsider,"INSERT INTO app.case_room_notes(case_id,author_id,visibility,statement) VALUES($1,$2,'shared','Unauthorized note')",[caseId,outsider]),/policy|permission denied/i);
  await assert.rejects(as(db,guest,"INSERT INTO app.case_room_notes(case_id,author_id,visibility,statement) VALUES($1,$2,'private','Spoof someone private')",[caseId,owner]),/policy/i);
  await as(db,guest,"INSERT INTO app.case_room_receipts(note_id,case_id,acknowledged_by) VALUES($1,$2,$3)",[sharedId,caseId,guest]);
  await assert.rejects(as(db,guest,"INSERT INTO app.case_room_receipts(note_id,case_id,acknowledged_by) VALUES($1,$2,$3)",[privateId,caseId,guest]),/policy|permission denied/i);
  await assert.rejects(as(db,owner,"UPDATE app.case_room_notes SET statement='Hidden edit' WHERE id=$1",[sharedId]),/permission denied|immutable|mutation/i);
  const revoked=await as(db,owner,"SELECT app.case_revoke_participant($1,$2) AS ok",[caseId,guest]);
  assert.equal(revoked.rows[0].ok,true);
  assert.equal((await as(db,guest,"SELECT id FROM app.case_room_notes WHERE case_id=$1",[caseId])).rows.length,0);
  assert.equal((await as(db,guest,"SELECT * FROM app.case_room_members($1)",[caseId])).rows.length,0);
  const oldInvite=await as(db,guest,"SELECT * FROM app.case_accept_invite($1)",[token]);
  assert.equal(oldInvite.rows.length,0);
 }finally{await db.close()}
});
