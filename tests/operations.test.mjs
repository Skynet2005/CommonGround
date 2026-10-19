import test from "node:test";
import assert from "node:assert/strict";
import {emptyOperations,isOperations,validateEntry,parseMoney,money,applyOperation,verifyOperationsAudit,financialReport} from "../src/operations-store.js";

test("new community workspace starts private and consistent",async()=>{
 const w=emptyOperations();
 assert.ok(isOperations(w));assert.equal(w.events.length,0);
 assert.equal(await verifyOperationsAudit(w),true);
 assert.equal(w.members.length,0);assert.equal(w.polls.length,0);
});
test("financial inputs accept exact cents and reject malformed or negative strings",()=>{
 assert.equal(parseMoney("125.50"),12550);
 assert.equal(parseMoney("0.01"),1);
 assert.equal(money(12550),"$125.50");
 for(const x of ["0","-1","1.234","1e9","NaN","$50","10000000000",""]) assert.throws(()=>parseMoney(x));
});
test("all nine operational records accept valid data and leave audit trails",async()=>{
 let w=emptyOperations();
 const examples=[
 ["members",{name:"Resident A",capacity:"Owner (self-reported)"}],
 ["meetings",{title:"October meeting",date:"2026-10-21"}],
 ["requests",{title:"Repair fixture",detail:"Street lighting needs inspection."}],
 ["bids",{vendor:"Example contractor",scope:"Lighting replacement",amountCents:25000}],
 ["budgets",{category:"Lighting",amountCents:200000}],
 ["expenses",{category:"Lighting",amountCents:25000}],
 ["notices",{title:"Document request",message:"Unsent procedural draft"}],
 ["documents",{title:"Meeting agenda",reference:"Draft v1"}],
 ["polls",{question:"Which day works?",choices:["Monday","Friday"]}]
 ];
 for(const [kind,data] of examples){
  w=await applyOperation(w,{type:"add",kind,data});
  assert.equal(w[kind].length,1,kind);
 }
 assert.equal(w.events.length,examples.length);
 assert.equal(await verifyOperationsAudit(w),true);
 assert.ok(w.expenses[0].ledger.length===2);
});
test("audit chain detects event note tampering",async()=>{
 let w=await applyOperation(emptyOperations(),{type:"add",kind:"requests",data:{title:"Streetlight",detail:"Inspect broken fixture"}});
 assert.equal(await verifyOperationsAudit(w),true);
 w.events[0].details="silently changed";
 assert.equal(await verifyOperationsAudit(w),false);
});
test("illustrative journal maintains double-entry balance and reversibility",async()=>{
 let w=emptyOperations();
 w=await applyOperation(w,{type:"add",kind:"budgets",data:{category:"Landscaping",amountCents:500000}});
 const budget=w.budgets[0];
 w=await applyOperation(w,{type:"status",kind:"budgets",id:budget.id,status:"Approved"});
 w=await applyOperation(w,{type:"add",kind:"expenses",data:{category:"Landscaping",amountCents:12500}});
 const expense=w.expenses[0];
 let report=financialReport(w);
 assert.equal(report.planned,500000);
 assert.equal(report.netExpense,12500);
 assert.equal(report.remaining,487500);
 assert.equal(report.balanced,true);
 w=await applyOperation(w,{type:"reverse",kind:"expenses",id:expense.id});
 report=financialReport(w);
 assert.equal(report.netExpense,0);
 assert.equal(report.remaining,500000);
 assert.equal(report.balanced,true);
 await assert.rejects(applyOperation(w,{type:"reverse",kind:"expenses",id:expense.id}),/once/);
});
test("informal poll is not an identity-verified election and closes properly",async()=>{
 let w=await applyOperation(emptyOperations(),{type:"add",kind:"polls",data:{question:"Preferred day?",choices:["Monday","Tuesday"]}});
 const id=w.polls[0].id;
 w=await applyOperation(w,{type:"respond",kind:"polls",id,choice:1});
 w=await applyOperation(w,{type:"respond",kind:"polls",id,choice:1});
 assert.deepEqual(w.polls[0].responses,[1,1]);
 w=await applyOperation(w,{type:"status",kind:"polls",id,status:"Closed"});
 await assert.rejects(applyOperation(w,{type:"respond",kind:"polls",id,choice:0}),/closed/);
});
test("invalid status and malformed meeting dates fail closed",async()=>{
 assert.throws(()=>validateEntry("meetings",{title:"Meeting",date:"2026-02-31"}),/valid meeting date/);
 assert.throws(()=>validateEntry("polls",{question:"Test",choices:["X","X"]}),/distinct/);
 const w=await applyOperation(emptyOperations(),{type:"add",kind:"bids",data:{vendor:"Example",scope:"Lighting"}});
 await assert.rejects(applyOperation(w,{type:"status",kind:"bids",id:w.bids[0].id,status:"Paid"}),/Invalid status/);
});
test("record titles and fields are bounded for offline use",()=>{
 const row=validateEntry("documents",{title:"x".repeat(999),reference:"y".repeat(1000)});
 assert.equal(row.title.length,500);
 assert.equal(row.reference.length,500);
 assert.equal(isOperations({...emptyOperations(),members:null}),false);
});
