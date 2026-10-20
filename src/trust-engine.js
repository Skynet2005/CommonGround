// CommonGround Trust Center - encrypted local working records, NEVER legal findings.
// Actor names, source quotes and reviewer credentials here are user-entered and unverified.
// No sharing, service of notice, independent signature or official record certification.
import {appendAudit,digestRecord} from "./operations-store.js";
export const TRUST_COLLECTIONS=["rules","passports","positions","neutralReviews"];
export const TRUST_NOTICE="Encrypted on this device only. Every source, identity, notice and review is user-entered and unverified. No messages are sent and no legal decisions are made.";
const TYPES=["Declaration","Recorded amendment","Plat or easement","Architectural guideline","Bylaws","Statute","Other"];
const CATEGORIES=["Architectural","Enforcement","Records","Financial","Elections","Maintenance","Governance","Other"];
const SIDES=["Homeowner position","Association position","Independent observation"];
const REVIEW_STATES=["Requested locally","Disclosure captured","Draft opinion","Review closed"];
const PASSPORT_STATES=["Draft","Information requested","Response documented","Ready for human review","Reported resolved","Archived"];
const trim=(v,max=300)=>typeof v==="string"?v.trim().slice(0,max):"";
function required(value,label,min=3,max=1200){const v=trim(value,max);if(v.length<min)throw Error(label+" must contain at least "+min+" characters.");return v}
function choice(value,options,label){if(!options.includes(value))throw Error("Invalid "+label);return value}
function date(value){if(!value)return "";if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error("Invalid date");const d=new Date(value+"T00:00:00Z");if(Number.isNaN(+d)||d.toISOString().slice(0,10)!==value)throw Error("Invalid date");return value}
const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID();
const rows=(state,key)=>Array.isArray(state[key])?state[key]:[];
const find=(state,key,id)=>rows(state,key).find(x=>x.id===id)||null;
function base(state){return {...state,...Object.fromEntries(TRUST_COLLECTIONS.map(k=>[k,rows(state,k)]))};}
async function write(state,kind,record,event,description){
 const data=base(state);
 const next={...data,[kind]:[record,...data[kind]]};
 return appendAudit(next,{action:event,kind,itemId:record.id,details:description});
}
export async function trustOperation(state,action){
 if(!state||!Array.isArray(state.events))throw Error("Invalid encrypted workspace");
 const v=action?.data||{};
 if(action.type==="createRule"){
  const title=required(v.title,"Source title",5,170),section=required(v.section,"Exact section",2,180);
  const excerpt=required(v.excerpt,"Source excerpt",20,5000);
  const documentReference=required(v.documentReference,"Document or legal source reference",4,400);
  const kind=choice(v.kind||"Other",TYPES,"document type");
  const sourceUrl=trim(v.sourceUrl,900);
  if(sourceUrl){let u;try{u=new URL(sourceUrl)}catch{throw Error("Enter a valid source URL")};if(!["https:","http:"].includes(u.protocol))throw Error("Source URL must be HTTP(S)")}
  const supersedes=trim(v.supersedes,80);
  if(supersedes&&!find(state,"rules",supersedes))throw Error("Superseded source version not found");
  const record={id:id(),title,kind,documentReference,section,excerpt,sourceUrl,effectiveDate:date(v.effectiveDate),supersedes,enteredBy:trim(v.enteredBy,150),notes:trim(v.notes,1000),createdAt:now(),verification:"User-supplied, not independently authenticated"};
  record.digest=await digestRecord(record);
  return write(state,"rules",record,"Source version captured",title+" · "+section);
 }
 if(action.type==="createPassport"){
  const rule=find(state,"rules",v.ruleId);
  if(!rule)throw Error("Select an existing source version");
  const title=required(v.title,"Decision title",5,170);
  const category=choice(v.category,CATEGORIES,"case category");
  const record={id:id(),title,category,ruleId:rule.id,ruleDigest:rule.digest,ruleSection:rule.section,ruleDocument:rule.documentReference,ruleExcerpt:rule.excerpt,community:trim(state.community,200),claimedActor:trim(v.claimedActor,150),claimedAuthority:trim(v.claimedAuthority,500),factSummary:required(v.factSummary,"Contested facts",15,2500),requestedOutcome:required(v.requestedOutcome,"Proposed remedy",8,1700),reasoning:trim(v.reasoning,2500),noticeDraft:trim(v.noticeDraft,2000),noticeProof:trim(v.noticeProof,1000),responseSummary:trim(v.responseSummary,2000),status:"Draft",createdAt:now(),updatedAt:now(),verification:"Locally prepared, not authenticated or served"};
  return write(state,"passports",record,"Decision passport opened",title);
 }
 if(action.type==="updatePassport"){
  const old=find(state,"passports",action.id);if(!old)throw Error("Decision passport not found");
  if(old.status==="Archived")throw Error("Archived passports cannot be edited");
  const fields=["factSummary","requestedOutcome","reasoning","noticeDraft","noticeProof","responseSummary","claimedActor","claimedAuthority"];
  const change={};
  for(const field of fields)if(v[field]!==undefined){
   const next=trim(v[field],["factSummary","reasoning","noticeDraft","responseSummary"].includes(field)?2500:1700);
   if(next!==old[field])change[field]=next;
  }
  if(v.status!==undefined)change.status=choice(v.status,PASSPORT_STATES,"passport status");
  if(!Object.keys(change).length)return state;
  const data=base(state);
  const updated={...old,...change,updatedAt:now(),revision:(old.revision||1)+1};
  return appendAudit({...data,passports:data.passports.map(x=>x.id===old.id?updated:x)},
   {action:"Decision record revised",kind:"passports",itemId:old.id,details:"Revised fields: "+Object.keys(change).join(", ")});
 }
 if(action.type==="addPosition"){
  const passport=find(state,"passports",v.passportId);if(!passport)throw Error("Decision passport not found");
  if(passport.status==="Archived")throw Error("Archived passport is closed");
  const side=choice(v.side,SIDES,"position category");
  const record={id:id(),passportId:passport.id,side,author:trim(v.author,150),statement:required(v.statement,"Factual position",15,3000),evidenceReference:trim(v.evidenceReference,1000),shared:false,createdAt:now(),verification:"Entered locally, not delivered to the other party"};
  return write(state,"positions",record,"Perspective recorded",passport.title+" · "+side);
 }
 if(action.type==="requestReview"){
  const passport=find(state,"passports",v.passportId);if(!passport)throw Error("Decision passport not found");
  const reviewer=required(v.reviewer,"Proposed reviewer",3,150),scope=required(v.scope,"Review scope",12,1500);
  const conflictDisclosure=required(v.conflictDisclosure,"Potential conflicts or no known conflicts",12,1500);
  const record={id:id(),passportId:passport.id,reviewer,organization:trim(v.organization,150),scope,conflictDisclosure,recommendation:trim(v.recommendation,2500),status:"Requested locally",createdAt:now(),verified:false,verification:"Local request record only. No invitation sent or qualification verified"};
  return write(state,"neutralReviews",record,"Neutral review proposed",passport.title+" · "+reviewer);
 }
 if(action.type==="updateReview"){
  const review=find(state,"neutralReviews",action.id);if(!review)throw Error("Review not found");
  if(review.status==="Review closed")throw Error("Closed reviewer record cannot be overwritten");
  const status=choice(v.status,REVIEW_STATES,"review status");
  const recommendation=v.recommendation!==undefined?trim(v.recommendation,2500):review.recommendation;
  const updated={...review,status,recommendation,updatedAt:now()};
  const data=base(state);
  return appendAudit({...data,neutralReviews:data.neutralReviews.map(x=>x.id===review.id?updated:x)},
   {action:"Review tracking updated",kind:"neutralReviews",itemId:review.id,details:status});
 }
 throw Error("Unknown Trust Center operation");
}
export function passportChecks(state,passport){
 const rule=find(state,"rules",passport.ruleId);
 const pos=rows(state,"positions").filter(x=>x.passportId===passport.id);
 const reviews=rows(state,"neutralReviews").filter(x=>x.passportId===passport.id);
 return [
  {label:"Exact governing source captured",complete:!!rule&&rule.digest===passport.ruleDigest,detail:"Uploaded or transcribed source is not automatically authenticated"},
  {label:"Claims and evidence described",complete:passport.factSummary.length>=15&&pos.some(x=>x.evidenceReference.length>=4),detail:"Independently confirm the evidence"},
  {label:"Opportunity to respond documented",complete:!!passport.responseSummary.trim()&&pos.some(x=>x.side==="Homeowner position")&&pos.some(x=>x.side==="Association position"),detail:"Local notes do not prove actual delivery or participation"},
  {label:"Notice proof documented",complete:passport.noticeProof.trim().length>=12,detail:"A typed description is not proof of statutory service"},
  {label:"Reasoned proposed resolution",complete:passport.reasoning.trim().length>=15&&passport.requestedOutcome.length>=8,detail:"Human authority and applicable rules still need checking"},
  {label:"Independent review considered",complete:reviews.some(x=>x.conflictDisclosure.length>=12),detail:"Self-entered disclosure does not verify neutrality"}
 ];
}
export function comparePassports(state,passport){
 return rows(state,"passports").filter(p=>p.id!==passport.id&&p.category===passport.category&&p.ruleDigest===passport.ruleDigest&&p.community===passport.community);
}
export function passportExport(state,passportId){
 const passport=find(state,"passports",passportId);if(!passport)throw Error("Decision passport not found");
 const rule=find(state,"rules",passport.ruleId);
 return {format:"commonground-decision-passport-v1",exportedAt:now(),warning:"Unverified locally prepared record. Hash links are not signatures or independent custody. No notice was sent.",passport,rule,positions:rows(state,"positions").filter(x=>x.passportId===passportId),reviews:rows(state,"neutralReviews").filter(x=>x.passportId===passportId),checks:passportChecks(state,passport),linkedAudit:state.events.filter(e=>["rules","passports","positions","neutralReviews"].includes(e.kind)&&[passportId,passport.ruleId,...rows(state,"positions").filter(x=>x.passportId===passportId).map(x=>x.id),...rows(state,"neutralReviews").filter(x=>x.passportId===passportId).map(x=>x.id)].includes(e.itemId))};
}
export const TRUST_TYPES=TYPES,TRUST_CATEGORIES=CATEGORIES,TRUST_SIDES=SIDES,PASSPORT_STATUSES=PASSPORT_STATES,REVIEW_STATUSES=REVIEW_STATES;
