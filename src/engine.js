
export const STARTER_CASES = [{
 id:"demo-fence-001",title:"Fence setback clarification",community:"Cypress Bay Estates (sample)",category:"Architectural",status:"In review",createdAt:"2026-10-15T12:00:00.000Z",
 description:"A homeowner received a request to relocate a backyard fence. The recorded authority and the exact proposed corrective work have not yet been supplied.",
 rule:"",evidence:"Dated photograph and the written HOA request are described, but the property survey has not been independently reviewed.",
 resolution:"Provide recorded authority, verify the boundary with an independent survey, and agree on a written corrective scope.",
 independent:false,responded:true,
 events:[{id:"e1",when:"2026-10-15T12:00:00.000Z",by:"Sample homeowner",type:"Case opened",note:"Example scenario only — no actual homeowner information.",previousHash:null,hash:null}]
},{
 id:"demo-landscape-002",title:"Landscape guideline question",community:"Cypress Bay Estates (sample)",category:"Enforcement",status:"Open",createdAt:"2026-10-17T09:00:00.000Z",
 description:"A notice requests removal of an ornamental planter. The resident is trying to understand which published guideline applies.",
 rule:"Community guidelines §4.2 — illustrative reference only",evidence:"Photo and notice mentioned by reporting party.",resolution:"Confirm the applicable guideline and provide a reasonable opportunity to respond.",
 independent:false,responded:false,events:[{id:"e2",when:"2026-10-17T09:00:00.000Z",by:"Sample homeowner",type:"Case opened",note:"Sample case only.",previousHash:null,hash:null}]
}];

export const STATUTES = [
 {section:"720.303",name:"Association powers, records & meetings",area:"Transparency",note:"Governing association administration, official records and member access."},
 {section:"720.3035",name:"Architectural review & owner rights",area:"Architectural",note:"Relevant to architectural restrictions, standards and decisions."},
 {section:"720.305",name:"Fines, suspensions & enforcement",area:"Enforcement",note:"Notice, hearing and enforcement provisions; procedures vary by action."},
 {section:"720.3085",name:"Assessment collection & liens",area:"Financial",note:"Assessment and collection procedures, including lien and foreclosure rules."},
 {section:"720.311",name:"Dispute resolution",area:"Resolution",note:"Presuit mediation and specific arbitration procedures for HOA disputes."},
 {section:"720.317",name:"Electronic voting",area:"Governance",note:"Conditions and safeguards for association electronic voting."}
];

export const CHARTER = [
 {id:"evidence",title:"Evidence before enforcement",desc:"Provide written authority and dated evidence before issuing corrective demands."},
 {id:"notice",title:"Meaningful notice and response",desc:"Allow adequate time to understand, respond to, and challenge allegations."},
 {id:"equity",title:"Consistent application",desc:"Review comparable cases for possible departures from published standards."},
 {id:"privacy",title:"Privacy and proportional access",desc:"Make community decisions transparent without exposing confidential resident records."},
 {id:"review",title:"Independent procedural review",desc:"Offer a neutral review option for contested facts and procedures."},
 {id:"audit",title:"Correctable, traceable history",desc:"Keep a dated record of the evidence and reasoning behind decisions."}
];

export function caseChecks(c){
 return [
  {id:"authority",name:"Applicable authority identified",passed:!!(c.rule||"").trim(),details:"Identify the governing covenant, rule or exact statutory provision."},
  {id:"evidence",name:"Supporting evidence documented",passed:(c.evidence||"").trim().length>=20,details:"Describe dated evidence and missing verification."},
  {id:"response",name:"Opportunity to respond documented",passed:!!c.responded,details:"Record that a resident could respond; this does not prove statutory notice compliance."},
  {id:"remedy",name:"Proposed resolution documented",passed:(c.resolution||"").trim().length>=15,details:"Describe an achievable proposed remedy or outcome."},
  {id:"review",name:"Independent review considered",passed:!!c.independent,details:"Flag factual disputes for qualified independent review where appropriate."}
 ];
}
export function scoreCase(c){const checks=caseChecks(c);return Math.round(checks.filter(x=>x.passed).length / checks.length*100)}
export function formatDate(date){if(!date)return"—";const d=new Date(date);return isNaN(d.getTime())?"—":d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
export function id(){return typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(36).slice(2)}
export function load(key,fallback){try{const data=JSON.parse(localStorage.getItem(key)||"null");return data??fallback}catch{return fallback}}
export function save(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true}catch{return false}}
export async function sha256(text){const data=new TextEncoder().encode(text);const bytes=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("")}

const SNAPSHOT_FIELDS=["title","community","category","status","createdAt","description","rule","evidence","resolution","responded","independent"];
function snapshot(c){return Object.fromEntries(SNAPSHOT_FIELDS.map(k=>[k,c[k]??null]))}
export async function snapshotHash(c){return sha256(JSON.stringify(snapshot(c)))}
export async function appendEvent(current,type,note,previousCase=null){
 const previous=current.events.at(-1)?.hash||"GENESIS";
 const event={id:id(),when:new Date().toISOString(),by:"Local workspace user (unverified)",type,note,previousHash:previous,version:2};
 const changes={};
 if(previousCase)for(const key of SNAPSHOT_FIELDS)if(JSON.stringify(previousCase[key]??null)!==JSON.stringify(current[key]??null))changes[key]={from:previousCase[key]??null,to:current[key]??null};
 event.changes=changes;
 event.snapshotHash=await snapshotHash(current);
 event.hash=await sha256("v2|"+previous+"|"+event.id+"|"+event.when+"|"+event.by+"|"+event.type+"|"+event.note+"|"+JSON.stringify(event.changes)+"|"+event.snapshotHash);
 return {...current,events:[...current.events,event]};
}
export async function verifyEvents(events){
 let previous="GENESIS";
 let seenHashed=false;
 for(const e of events){
  if(!e.hash){
   if(seenHashed || e.previousHash||e.hash)return false;
   continue;
  }
  seenHashed=true;
  if(e.previousHash!==previous)return false;
  const actual=e.version===2?
   await sha256("v2|"+previous+"|"+e.id+"|"+e.when+"|"+e.by+"|"+e.type+"|"+e.note+"|"+JSON.stringify(e.changes||{})+"|"+e.snapshotHash):
   await sha256(previous+"|"+e.id+"|"+e.when+"|"+e.by+"|"+e.type+"|"+e.note);
  if(actual!==e.hash)return false;
  previous=e.hash;
 }
 return true;
}
export async function verifyCase(c){
 const valid=await verifyEvents(c.events||[]);
 if(!valid)return {verified:false,level:"mismatch"};
 const last=(c.events||[]).at(-1);
 if(last?.version===2)return {verified:await snapshotHash(c)===last.snapshotHash,level:"v2"};
 return {verified:true,level:"legacy"};
}
export function safeImport(raw){
 if(!raw || !Array.isArray(raw.cases) || raw.cases.length>500)return null;
 const text=x=>typeof x==="string"?x.slice(0,12000):"";
 const cases=raw.cases.map(c=>({
  id:text(c.id)||id(),title:text(c.title),community:text(c.community),category:text(c.category)||"Other",
  status:["Open","In review","In discussion","Resolved"].includes(c.status)?c.status:"Open",
  createdAt:text(c.createdAt)||new Date().toISOString(),description:text(c.description),
  rule:text(c.rule),evidence:text(c.evidence),resolution:text(c.resolution),
  independent:!!c.independent,responded:!!c.responded,
  events:Array.isArray(c.events)?c.events.slice(0,300).map(e=>({id:text(e.id),when:text(e.when),by:text(e.by),type:text(e.type),note:text(e.note),previousHash:e.previousHash===null?null:text(e.previousHash),hash:e.hash===null?null:text(e.hash),version:e.version===2?2:undefined,snapshotHash:text(e.snapshotHash),changes:e.changes&&typeof e.changes==="object"?Object.fromEntries(Object.entries(e.changes).filter(([key,v])=>["title","community","category","status","createdAt","description","rule","evidence","resolution","responded","independent"].includes(key)&&v&&typeof v==="object").map(([key,v])=>[key,{from:typeof v.from==="boolean"?v.from:typeof v.from==="string"?v.from.slice(0,12000):null,to:typeof v.to==="boolean"?v.to:typeof v.to==="string"?v.to.slice(0,12000):null}])):{}})):[]
 })).filter(c=>c.title);
 return cases;
}
