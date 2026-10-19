import test from "node:test";
import assert from "node:assert/strict";
import {STARTER_CASES} from "../src/engine.js";
import {normalizeReference,reviewFlags,reviewSummary,comparableCases,comparisonQuestions} from "../src/review-engine.js";

test("process review highlights missing authority without declaring a violation",()=>{
 const flags=reviewFlags(STARTER_CASES[0]);
 assert.ok(flags.some(x=>x.id==="authority"));
 assert.ok(flags.every(x=>!x.message.includes("illegal")));
});
test("case similarity requires same rule, community and category",()=>{
 const base={...STARTER_CASES[0],id:"a",rule:"Declaration Article VII",community:"Harbor Estates",category:"Architectural"};
 const same={...base,id:"b",status:"Resolved"};
 const another={...same,id:"c",community:"Another HOA"};
 const different={...same,id:"d",category:"Financial"};
 const list=comparableCases(base,[base,same,another,different]);
 assert.deepEqual(list.map(x=>x.id),["b"]);
 const comments=comparisonQuestions(base,list);
 assert.ok(comments.some(x=>x.includes("do not prove")||x.includes("does not prove")));
});
test("no cited rule means no meaningful cross-case comparison",()=>{
 const base={...STARTER_CASES[0],rule:""};
 const list=comparableCases(base,[base,{...base,id:"different"}]);
 assert.equal(list.length,0);
});
test("review totals distinguish filled checklists from factual verification",()=>{
 const all=reviewSummary(STARTER_CASES);
 assert.equal(all.total,2);
 assert.ok(all.flagCounts.authority>=1);
 assert.equal(normalizeReference(" Article  VII "),"article vii");
});
