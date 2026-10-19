
import test from "node:test";
import assert from "node:assert/strict";
import {STARTER_CASES,caseChecks,scoreCase,safeImport,appendEvent,verifyCase,verifyEvents} from "../src/engine.js";
import {sealEvidence,openEvidence,MAX_FILE_BYTES,packEncryptedRecord,unpackEncryptedRecord} from "../src/vault.js";
import {GUIDES,guideForCategory,docketMarkdown,lawURL} from "../src/procedures.js";

test("five procedural checklist items are explicit and deterministic",()=>{
 const checks=caseChecks(STARTER_CASES[0]);
 assert.equal(checks.length,5);
 assert.equal(checks[0].id,"authority");
 assert.equal(scoreCase({...STARTER_CASES[0],rule:"Declaration §2",independent:true}),100);
 assert.ok(scoreCase({...STARTER_CASES[0],rule:"",evidence:"",responded:false,independent:false,resolution:""})<100);
});
test("import refuses oversized, invalid formats and arbitrary case fields",()=>{
 assert.equal(safeImport({cases:null}),null);
 assert.equal(safeImport({cases:Array(501).fill({})}),null);
 const x=safeImport({cases:[{id:"1",title:"Sample",secret:"do not accept"}]});
 assert.equal(x.length,1);assert.equal("secret" in x[0],false);
});
test("v2 audit events preserve edits and detect altered event data or current state",async()=>{
 const before={...STARTER_CASES[0],events:[]};
 const after=await appendEvent({...before,rule:"Declaration Article VII",status:"In review"},"Fields revised","Supporting authority supplied",before);
 assert.equal(after.events[0].version,2);
 assert.deepEqual(after.events[0].changes.rule,{from:"",to:"Declaration Article VII"});
 assert.equal((await verifyCase(after)).verified,true);
 assert.equal((await verifyCase({...after,rule:"silently changed"})).verified,false);
 assert.equal(await verifyEvents([{...after.events[0],note:"tampered"}]),false);
});
test("legacy demo histories are reported separately from v2 verification",async()=>{
 const check=await verifyCase(STARTER_CASES[0]);
 assert.equal(check.level,"legacy");
 assert.equal(check.verified,true);
});
test("strict imported v2 audit events preserve hash verification",async()=>{
 const before={...STARTER_CASES[0],events:[]};
 const after=await appendEvent({...before,rule:"§ 5"},"Rule supplied","Verifiable case revision",before);
 const [copy]=safeImport({cases:[after]});
 assert.equal((await verifyCase(copy)).verified,true);
});
test("local AES-256-GCM seals, verifies, and rejects wrong passphrases",async()=>{
 const source=new TextEncoder().encode("example redacted evidence only");
 const sealed=await sealEvidence(source,"photo.txt","text/plain","test-passphrase-with-length");
 const opened=await openEvidence(sealed,"test-passphrase-with-length");
 assert.equal(new TextDecoder().decode(opened.data),"example redacted evidence only");
 assert.equal(opened.filename,"photo.txt");
 await assert.rejects(openEvidence(sealed,"completely-wrong-secret"),/Unable to decrypt/);
});
test("ciphertext alteration is detected",async()=>{
 const sealed=await sealEvidence(new TextEncoder().encode("original evidence"),"e.txt","text/plain","another-long-passphrase");
 sealed.body[0]^=1;
 await assert.rejects(openEvidence(sealed,"another-long-passphrase"),/Unable to decrypt/);
});
test("file byte bounds and passphrase strength are enforced",async()=>{
 await assert.rejects(sealEvidence(new Uint8Array(0),"bad.txt","text/plain","passphrase-12345"),/between 1 byte/);
 await assert.rejects(sealEvidence(new Uint8Array(1),"x","text/plain","weak"),/at least 12/);
 assert.equal(MAX_FILE_BYTES,8*1024*1024);
});
test("statute navigator routes sensitive dispute types correctly",()=>{
 assert.equal(guideForCategory("Elections"),"elections");
 assert.equal(guideForCategory("Financial"),"assessments");
 assert.ok(GUIDES.find(x=>x.id==="elections").intro.includes("excluded"));
 assert.equal(lawURL("720.305"),"https://www.flsenate.gov/Laws/Statutes/2026/720.305");
});
test("case brief documents unverified nature and includes source info",()=>{
 const text=docketMarkdown(STARTER_CASES[0],caseChecks(STARTER_CASES[0]));
 assert.ok(text.includes("independently authenticated"));
 assert.ok(text.includes("Cypress Bay Estates"));
 assert.ok(text.includes("## Procedural documentation checklist"));
});

test("encrypted backup encoding round-trips without losing file integrity",async()=>{
 const sealed=await sealEvidence(new TextEncoder().encode("archive sample"),"original.txt","text/plain","backup-passphrase-123");
 const record={...sealed,id:"original-id",caseId:"test-case",createdAt:new Date().toISOString()};
 const restored=unpackEncryptedRecord(packEncryptedRecord(record));
 assert.notEqual(restored.id,record.id);
 const opened=await openEvidence(restored,"backup-passphrase-123");
 assert.equal(opened.filename,"original.txt");
 assert.equal(new TextDecoder().decode(opened.data),"archive sample");
});
