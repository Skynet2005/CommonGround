import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {emptyOperations,applyOperation,verifyOperationsAudit,saveOperations,readOperations,removeOperations} from "../src/operations-store.js";
import {trustOperation,passportChecks,passportExport,comparePassports} from "../src/trust-engine.js";

const source={title:"Recorded declaration, 2021 amendment",kind:"Recorded amendment",documentReference:"County instrument 2021-0000123",section:"Article VI §4",excerpt:"All proposed exterior alterations must be submitted in writing for architectural committee review before work begins. Exceptions and approvals must be recorded.",effectiveDate:"2021-03-12",sourceUrl:"https://example.org/recording/2021-0000123"};
const decision={title:"Exterior architectural variance proposal",category:"Architectural",factSummary:"Homeowner disputes the setback interpretation and requests independent measured verification.",requestedOutcome:"Obtain a professional measurement and review the cited recorded declaration."};
async function withRule(){const w=await trustOperation(emptyOperations(),{type:"createRule",data:source});return w}
test("RuleGraph records an immutable quoted source version and digest",async()=>{
 const s=await withRule(),r=s.rules[0];
 assert.equal(r.section,"Article VI §4");
 assert.equal(r.verification,"User-supplied, not independently authenticated");
 assert.match(r.digest,/^[0-9a-f]{64}$/);
 assert.equal(await verifyOperationsAudit(s),true);
 const tampered={...s,rules:[{...r,excerpt:"Not the same rule!"}]};
 assert.equal(await verifyOperationsAudit(tampered),false,"latest audit snapshot must detect source alteration");
});
test("bad sources fail closed rather than claiming authority",async()=>{
 await assert.rejects(trustOperation(emptyOperations(),{type:"createRule",data:{...source,sourceUrl:"javascript:alert(1)"}}),/HTTP/);
 await assert.rejects(trustOperation(emptyOperations(),{type:"createRule",data:{...source,excerpt:"too short"}}),/at least/);
 await assert.rejects(trustOperation(emptyOperations(),{type:"createRule",data:{...source,effectiveDate:"2026-02-30"}}),/Invalid date/);
});
test("Decision Passport binds an exact source snapshot and requires human process fields",async()=>{
 let s=await withRule();
 s=await trustOperation(s,{type:"createPassport",data:{...decision,ruleId:s.rules[0].id}});
 const p=s.passports[0];
 assert.equal(p.ruleDigest,s.rules[0].digest);
 assert.equal(p.ruleExcerpt,s.rules[0].excerpt);
 assert.equal(p.status,"Draft");
 assert.equal(passportChecks(s,p).length,6);
 assert.equal(passportChecks(s,p).filter(x=>x.complete).length,1);
 assert.equal(await verifyOperationsAudit(s),true);
});
test("Two-sided positions, notice references and neutral disclosures produce documented checks, not verified compliance",async()=>{
 let s=await withRule();
 s=await trustOperation(s,{type:"createPassport",data:{...decision,ruleId:s.rules[0].id}});
 const p=s.passports[0];
 s=await trustOperation(s,{type:"addPosition",data:{passportId:p.id,side:"Homeowner position",statement:"The fence panels were altered without prior authorization.",evidenceReference:"Photos A-D and contractor inspection summary"}});
 s=await trustOperation(s,{type:"addPosition",data:{passportId:p.id,side:"Association position",statement:"Architectural review is necessary for all affected parcels.",evidenceReference:"Recorded rule and notice"}});
 s=await trustOperation(s,{type:"requestReview",data:{passportId:p.id,reviewer:"Independent professional",scope:"Determine recorded easement and setback distances",conflictDisclosure:"No known business relationship, independently disclosed by proposed reviewer"}});
 s=await trustOperation(s,{type:"updatePassport",id:p.id,data:{reasoning:"Obtain measurement before determining if modification is justified.",responseSummary:"Both local perspectives recorded, no communication certified.",noticeProof:"Delivery receipt must still be independently confirmed",status:"Ready for human review"}});
 const next=s.passports[0],checks=passportChecks(s,next);
 assert.ok(checks.every(x=>x.complete));
 assert.equal(next.verification,"Locally prepared, not authenticated or served");
 assert.ok(s.neutralReviews.every(x=>x.verified===false));
 assert.equal(await verifyOperationsAudit(s),true);
 const pkg=passportExport(s,p.id);
 assert.equal(pkg.positions.length,2);
 assert.equal(pkg.reviews.length,1);
 assert.ok(pkg.warning.includes("Unverified"));
 assert.ok(pkg.linkedAudit.length>=4);
});
test("review tracking cannot be closed twice and identities remain unverified",async()=>{
 let s=await withRule();
 s=await trustOperation(s,{type:"createPassport",data:{...decision,ruleId:s.rules[0].id}});
 s=await trustOperation(s,{type:"requestReview",data:{passportId:s.passports[0].id,reviewer:"Neutral architect",scope:"Inspect the plan and the measured property boundary",conflictDisclosure:"Candidate states no conflicts, subject to independent verification"}});
 const id=s.neutralReviews[0].id;
 s=await trustOperation(s,{type:"updateReview",id,data:{status:"Review closed",recommendation:"Only an initial local note, no formal opinion"}});
 assert.equal(s.neutralReviews[0].status,"Review closed");
 await assert.rejects(trustOperation(s,{type:"updateReview",id,data:{status:"Draft opinion"}}),/cannot be overwritten/);
});
test("Fairness Twin requires the identical captured rule digest, category and community",async()=>{
 let s=await withRule();
 const ruleId=s.rules[0].id;
 s=await trustOperation(s,{type:"createPassport",data:{...decision,ruleId}});
 s=await trustOperation(s,{type:"createPassport",data:{...decision,title:"Neighboring parcel, same instrument",ruleId}});
 const first=s.passports[0],other=s.passports[1];
 assert.deepEqual(comparePassports(s,first).map(x=>x.id),[other.id]);
 s=await trustOperation(s,{type:"createRule",data:{...source,excerpt:source.excerpt+" This revision clarifies exceptions.",supersedes:ruleId}});
 s=await trustOperation(s,{type:"createPassport",data:{...decision,title:"Case under amended text",ruleId:s.rules[0].id}});
 assert.equal(comparePassports(s,s.passports[0]).length,0);
});
test("old encrypted operations records open and preserve their prior audit chain after Trust Center migration",async()=>{
 const pass="local-test-passphrase-strong-enough-123";
 let state=await applyOperation(emptyOperations(),{type:"add",kind:"requests",data:{title:"Streetlight issue",detail:"A broken lamp post needs inspection."}});
 const rev=await saveOperations(state,pass,0);
 assert.equal(rev,1);
 const saved=await readOperations(pass);
 assert.equal(saved.workspace.rules,undefined);
 state=await trustOperation(saved.workspace,{type:"createRule",data:source});
 const version=await saveOperations(state,pass,rev);
 assert.equal(version,2);
 const loaded=await readOperations(pass);
 assert.equal(loaded.workspace.rules.length,1);
 assert.equal(loaded.workspace.requests.length,1);
 assert.equal(loaded.workspace.events.length,2);
 assert.equal(await verifyOperationsAudit(loaded.workspace),true);
 await removeOperations(version);
});
