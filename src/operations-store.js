
// CommonGround encrypted, local-first community operations.
// Nothing in this module authorizes an HOA decision, serves a legal notice,
// processes a payment or certifies a vote.
import {sealEvidence,openEvidence,packEncryptedRecord,unpackEncryptedRecord} from "./vault.js";
export const MODULES=["members","meetings","requests","bids","budgets","expenses","notices","documents","polls"];
const DB="cg-operations-v1", STORE="workspace", KEY="private";
const enc=new TextEncoder(),dec=new TextDecoder();
export const OPERATIONS_NOTICE="Private browser-only workspace. People and roles are self-entered, notices are drafts, entries are illustrative, and polls are informal. No legal notices, money, or ballots are sent.";
export function emptyOperations(){return {schemaVersion:1,community:"",members:[],meetings:[],requests:[],bids:[],budgets:[],expenses:[],notices:[],documents:[],polls:[],events:[]};}

function database(){
 if(typeof indexedDB==="undefined")throw Error("This browser does not support private local storage.");
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};
  r.onerror=()=>reject(r.error||Error("Local data store unavailable"));
  r.onsuccess=()=>resolve(r.result);
 });
}
async function withDb(mode,operate){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),os=tx.objectStore(STORE);
  let value;
  try{operate(os,tx,v=>{value=v})}catch(e){tx.abort();reject(e);return}
  tx.oncomplete=()=>resolve(value);
  tx.onabort=()=>reject(tx.error||Error("Storage transaction canceled"));
  tx.onerror=()=>reject(tx.error||Error("Storage transaction failed"));
 })}finally{db.close()}
}
export async function hasOperations(){return !!(await withDb("readonly",(store,_,done)=>{const r=store.get(KEY);r.onsuccess=()=>done(r.result)}));}
export async function readOperations(passphrase){
 const value=await withDb("readonly",(store,_,done)=>{const r=store.get(KEY);r.onsuccess=()=>done(r.result)});
 if(!value)return null;
 const plaintext=await openEvidence(value.encrypted,passphrase);
 let decoded;
 try{decoded=JSON.parse(dec.decode(plaintext.data))}catch{throw Error("The saved workspace is not readable.")}
 if(!isOperations(decoded))throw Error("Workspace format is not supported.");
 if(!(await verifyOperationsAudit(decoded)))throw Error("Workspace event chain is inconsistent; recovery requires a trustworthy backup.");
 return {workspace:decoded,revision:value.revision};
}
export function isOperations(s){
 return !!(s&&s.schemaVersion===1&&MODULES.every(k=>Array.isArray(s[k])&&s[k].length<=1000)&&["rules","passports","positions","neutralReviews"].every(k=>s[k]===undefined||(Array.isArray(s[k])&&s[k].length<=1000))&&Array.isArray(s.events)&&s.events.length<=10000&&typeof s.community==="string"&&s.community.length<=200);
}
export async function saveOperations(workspace,passphrase,expectedRevision){
 if(!isOperations(workspace))throw Error("Invalid operations workspace.");
 if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw Error("Invalid workspace revision.");
 if(!(await verifyOperationsAudit(workspace)))throw Error("Workspace audit verification failed.");
 const data=enc.encode(JSON.stringify(workspace));
 if(data.length>7*1024*1024)throw Error("Workspace reached its 7 MB limit. Export an archive.");
 const encrypted=await sealEvidence(data,"commonground-operations.json","application/json",passphrase);
 const next=expectedRevision+1;
 await withDb("readwrite",(store,tx,done)=>{
  const r=store.get(KEY);
  r.onsuccess=()=>{
   const current=r.result;
   if((current?.revision||0)!==expectedRevision){tx.abort();return}
   const put=store.put({revision:next,encrypted,updatedAt:new Date().toISOString()},KEY);
   put.onsuccess=()=>done(next);
  };
 });
 return next;
}
export async function removeOperations(expectedRevision){
 await withDb("readwrite",(store,tx,done)=>{
  const r=store.get(KEY);
  r.onsuccess=()=>{
   if((r.result?.revision||0)!==expectedRevision){tx.abort();return}
   const result=store.delete(KEY);result.onsuccess=()=>done(true);
  };
 });
}
function plain(value,max=500){return String(value??"").trim().slice(0,max)}
function uid(){return crypto.randomUUID()}
export function requireCents(value){
 if(typeof value==="number" && Number.isSafeInteger(value)&&value>0&&value<=100000000000)return value;
 throw Error("Enter a positive amount in whole cents within the allowed range.");
}
export function parseMoney(value){
 if(typeof value!=="string"||!/^\d{1,9}(?:\.\d{1,2})?$/.test(value.trim()))throw Error("Enter a nonnegative amount, such as 125.00.");
 const [a,b=""]=value.trim().split(".");
 const cents=Number(a)*100+Number(b.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000000)throw Error("Amount must be greater than zero and within the limit.");
 return cents;
}
export function money(cents){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((Number(cents)||0)/100)}
export async function digestRecord(value){
 const buffer=await crypto.subtle.digest("SHA-256",enc.encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(buffer)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function appendAudit(state,change){
 const prev=state.events.at(-1)?.digest||"GENESIS";
 const event={id:uid(),when:new Date().toISOString(),action:plain(change.action,60),kind:plain(change.kind,45),itemId:plain(change.itemId,70),details:plain(change.details,250),previous:prev};
 const {events:_events,...snapshot}=state;
 event.snapshotDigest=await digestRecord(snapshot);
 event.digest=await digestRecord(event);
 return {...state,events:[...state.events,event]};
}
export async function verifyOperationsAudit(state){
 if(!Array.isArray(state.events))return false;
 let prev="GENESIS";
 for(const e of state.events){
  if(e.previous!==prev||typeof e.digest!=="string")return false;
  const {digest,...source}=e;
  if(await digestRecord(source)!==digest)return false;
  prev=digest;
 }
 const latest=state.events.at(-1);
 if(latest?.snapshotDigest){const {events:_events,...snapshot}=state;if(await digestRecord(snapshot)!==latest.snapshotDigest)return false;}
 return true;
}
function cleanDate(d){if(typeof d!=="string"||!(/^\d{4}-\d{2}-\d{2}$/.test(d)))return "";const date=new Date(d+"T00:00:00Z");return Number.isNaN(+date)||date.toISOString().slice(0,10)!==d?"":d}
const spec={
 members:{required:["name","capacity"],statuses:["Proposed","Reviewed","Revoked"]},
 meetings:{required:["title","date"],statuses:["Planned","Held","Minutes drafted","Closed"]},
 requests:{required:["title","detail"],statuses:["Open","Triaged","Scheduled","Completed","Canceled"]},
 bids:{required:["vendor","scope"],statuses:["Received","Under review","Declined","Selected"]},
 budgets:{required:["category","amountCents"],statuses:["Draft","Proposed","Approved"]},
 expenses:{required:["category","amountCents"],statuses:["Recorded","Reversed"]},
 notices:{required:["title","message"],statuses:["Draft","Reviewed","Archived"]},
 documents:{required:["title"],statuses:["Draft","Reviewed","Archived"]},
 polls:{required:["question","choices"],statuses:["Open","Closed"]}
};
export function validateEntry(kind,form){
 if(!spec[kind])throw Error("Unknown record type.");
 const o={};
 for(const key of ["title","detail","name","capacity","date","startAt","location","notes","vendor","scope","category","message","reference","conflict","question","deadline","amountCents","choices","status","meetingId","requestId"]){
  if(form[key]===undefined)continue;
  if(key==="amountCents")o[key]=requireCents(form[key]);
  else if(key==="date"||key==="deadline")o[key]=cleanDate(form[key]);
  else if(key==="choices"){const choices=Array.isArray(form.choices)?form.choices.map(x=>plain(x,100)).filter(Boolean):[];if(choices.length<2||choices.length>8||new Set(choices.map(x=>x.toLowerCase())).size!==choices.length)throw Error("Provide 2–8 distinct choices.");o.choices=choices;}
  else o[key]=plain(form[key],key==="message"||key==="detail"?2400:500);
 }
 if(kind==="meetings"&&!o.date)throw Error("Select a valid meeting date.");
 for(const key of spec[kind].required)if(o[key]===undefined||o[key]===""||o[key]===0)throw Error("Missing required field: "+key);
 if(form.status && !spec[kind].statuses.includes(o.status))throw Error("Invalid status.");
 return o;
}
export async function applyOperation(state,action){
 if(!isOperations(state))throw Error("Invalid operations state");
 const kind=action.kind;
 if(!spec[kind])throw Error("Unknown module");
 if(action.type==="add"){
  if(state[kind].length>=1000)throw Error("Module limit reached");
  const item={id:uid(),...validateEntry(kind,action.data),status:spec[kind].statuses[0],createdAt:new Date().toISOString()};
  if(kind==="polls")item.responses=[];
  if(kind==="expenses"){item.ledger=[{account:"expense:"+item.category,debit:item.amountCents,credit:0},{account:"illustrative_cash",debit:0,credit:item.amountCents}];}
  const next={...state,[kind]:[item,...state[kind]]};
  return appendAudit(next,{action:"Created",kind,itemId:item.id,details:plain(item.title||item.vendor||item.category||item.question||item.name,150)});
 }
 if(action.type==="edit"){
  if(kind==="expenses")throw Error("Journal entries cannot be rewritten. Enter a reversal instead.");
  const item=state[kind].find(x=>x.id===action.id);
  if(!item)throw Error("Record not found");
  if(kind==="budgets"&&item.status==="Approved")throw Error("Approved allocations cannot be rewritten. Create a new draft.");
  if(kind==="polls"&&item.responses.length)throw Error("Polls with responses cannot be edited. Close the poll and open a new one.");
  const data=validateEntry(kind,{...item,...action.data});
  const changeKeys=Object.keys(data).filter(key=>key!=="status"&&JSON.stringify(data[key])!==JSON.stringify(item[key]));
  if(!changeKeys.length)return state;
  const modified={...item,...Object.fromEntries(changeKeys.map(key=>[key,data[key]])),updatedAt:new Date().toISOString()};
  const next={...state,[kind]:state[kind].map(x=>x.id===item.id?modified:x)};
  return appendAudit(next,{action:"Edited",kind,itemId:item.id,details:"Updated fields: "+changeKeys.join(", ")});
 }
 if(action.type==="archive"){
  if(kind==="expenses"||kind==="budgets")throw Error("Financial entries remain in the illustrative history.");
  const item=state[kind].find(x=>x.id===action.id);
  if(!item)throw Error("Record not found");
  if(item.archivedAt)return state;
  const next={...state,[kind]:state[kind].map(x=>x.id===item.id?{...x,archivedAt:new Date().toISOString()}:x)};
  return appendAudit(next,{action:"Archived",kind,itemId:item.id,details:"Archived record "+plain(item.title||item.name||item.vendor||item.question,150)});
 }
 if(action.type==="status"){
  const item=state[kind].find(x=>x.id===action.id);
  if(!item)throw Error("Record not found");
  if(kind==="expenses"||kind==="polls"&&action.status!=="Closed")throw Error("This record cannot change status directly");
  if(!spec[kind].statuses.includes(action.status))throw Error("Invalid status");
  if(item.status===action.status)return state;
  const next={...state,[kind]:state[kind].map(x=>x.id===item.id?{...x,status:action.status,updatedAt:new Date().toISOString()}:x)};
  return appendAudit(next,{action:"Status updated",kind,itemId:item.id,details:item.status+" → "+action.status});
 }
 if(action.type==="reverse"&&kind==="expenses"){
  const item=state.expenses.find(x=>x.id===action.id);
  if(!item||item.status!=="Recorded")throw Error("Only a recorded entry can be reversed once");
  const reverse={id:uid(),category:item.category,amountCents:item.amountCents,notes:"Reversal of "+item.id,status:"Reversed",createdAt:new Date().toISOString(),reverses:item.id,ledger:item.ledger.map(x=>({...x,debit:x.credit,credit:x.debit}))};
  const next={...state,expenses:[reverse,...state.expenses.map(x=>x.id===item.id?{...x,status:"Reversed",reversalId:reverse.id}:x)]};
  return appendAudit(next,{action:"Reversal entered",kind,itemId:item.id,details:money(item.amountCents)+" illustrative reversal"});
 }
 if(action.type==="respond"&&kind==="polls"){
  const item=state.polls.find(x=>x.id===action.id);
  if(!item||item.status!=="Open")throw Error("Poll is closed or missing");
  const choice=Number(action.choice);
  if(!Number.isInteger(choice)||choice<0||choice>=item.choices.length)throw Error("Invalid poll selection");
  if(item.responses.length>=1000)throw Error("Poll response limit reached");
  // Browser-only participation, no identity or voter eligibility claims.
  const update={...item,responses:[...item.responses,choice]};
  const next={...state,polls:state.polls.map(x=>x.id===item.id?update:x)};
  return appendAudit(next,{action:"Informal response",kind,itemId:item.id,details:"An unverified local response was recorded"});
 }
 throw Error("Unsupported operation");
}
export function financialReport(state){
 const categories=new Map();
 for(const b of state.budgets){if(b.status==="Approved")categories.set(b.category,(categories.get(b.category)||0)+b.amountCents);}
 for(const e of state.expenses){const entry=categories.get(e.category)||0;if(e.reverses){categories.set(e.category,entry+e.amountCents)}else categories.set(e.category,entry-e.amountCents)}
 const posted=state.expenses.filter(e=>!e.reverses).reduce((a,b)=>a+b.amountCents,0);
 const reversals=state.expenses.filter(e=>e.reverses).reduce((a,b)=>a+b.amountCents,0);
 const planned=state.budgets.filter(b=>b.status==="Approved").reduce((a,b)=>a+b.amountCents,0);
 const balanced=state.expenses.every(e=>Array.isArray(e.ledger)&&e.ledger.reduce((a,l)=>a+l.debit,0)===e.ledger.reduce((a,l)=>a+l.credit,0));
 return {planned,netExpense:posted-reversals,remaining:planned-(posted-reversals),balanced,categories:[...categories].map(([name,remaining])=>({name,remaining}))};
}
export function exportOperationsText(state){if(!isOperations(state))throw Error("Invalid export");return JSON.stringify({format:"commonground-unencrypted-operations-v1",exportedAt:new Date().toISOString(),...state},null,2)}
export async function encryptedBackupRecord(){
 const value=await withDb("readonly",(store,_,done)=>{const r=store.get(KEY);r.onsuccess=()=>done(r.result)});
 if(!value)throw Error("Nothing to back up");
 return JSON.stringify({format:"cg-operations-encrypted-backup-v1",exportedAt:new Date().toISOString(),revision:value.revision,sealed:packEncryptedRecord({...value.encrypted,id:KEY,caseId:"operations",createdAt:value.updatedAt})});
}
export async function restoreEncryptedOperations(json,passphrase,expectedRevision=0){
 const d=typeof json==="string"?JSON.parse(json):json;
 if(d?.format!=="cg-operations-encrypted-backup-v1"||!d.sealed)throw Error("Invalid encrypted workspace backup");
 const sealed=unpackEncryptedRecord(d.sealed), opened=await openEvidence(sealed,passphrase);
 const workspace=JSON.parse(dec.decode(opened.data));
 if(!isOperations(workspace)||!(await verifyOperationsAudit(workspace)))throw Error("Backup verification failed");
 // A new AEAD envelope is used rather than reusing a previous nonce/ciphertext.
 const revision=await saveOperations(workspace,passphrase,expectedRevision);
 return {workspace,revision};
}
