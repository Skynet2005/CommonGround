// Transparent, deterministic client-side review of redacted, browser-local cases.
// No conduct finding, legal-compliance determination, or inference about intent.
export const CHECK_KEYS=["authority","evidence","response","remedy","review"];
export function normalizeReference(value){
 if(typeof value!=="string")return "";
 return value.toLowerCase().normalize("NFKC").replace(/\s+/g," ").trim().slice(0,300);
}
export function comparableCases(target,cases){
 if(!target || !Array.isArray(cases))return [];
 const rule=normalizeReference(target.rule),community=normalizeReference(target.community);
 if(rule.length<4||community.length<3)return [];
 return cases.filter(other=>
  other.id!==target.id &&
  normalizeReference(other.rule)===rule &&
  normalizeReference(other.community)===community &&
  other.category===target.category
 );
}
export function reviewFlags(c){
 if(!c)return [];
 const result=[];
 if(!normalizeReference(c.rule))result.push({id:"authority",importance:"high",message:"A specific rule or governing authority has not been recorded.",action:"Identify the recorded source, amendment and relevant section."});
 if(String(c.evidence||"").trim().length<20)result.push({id:"evidence",importance:"high",message:"The evidence summary is insufficiently documented.",action:"Record what evidence exists, its source and what requires independent verification."});
 if(!c.responded)result.push({id:"response",importance:"medium",message:"The opportunity to respond has not been documented.",action:"Record the actual notice, response rights and reliable delivery evidence where applicable."});
 if(String(c.resolution||"").trim().length<15)result.push({id:"remedy",importance:"medium",message:"No clear proposed resolution is recorded.",action:"Describe an achievable outcome, or explain what remains contested."});
 if(!c.independent)result.push({id:"review",importance:"low",message:"Independent fact review has not been marked as considered.",action:"Consider whether a qualified neutral, surveyor or inspector could resolve the factual dispute."});
 return result;
}
export function reviewSummary(cases){
 const list=Array.isArray(cases)?cases:[];
 const countById=Object.fromEntries(CHECK_KEYS.map(id=>[id,0]));
 let unresolved=0,ready=0;
 for(const c of list){
  const flags=reviewFlags(c);
  for(const f of flags)countById[f.id]++;
  if(c.status!=="Resolved")unresolved++;
  if(!flags.length)ready++;
 }
 const comparableSets=new Set();
 for(const c of list){
  const r=normalizeReference(c.rule),community=normalizeReference(c.community);
  if(r.length>=4&&community.length>=3&&comparableCases(c,list).length){
   const pieces=[community,c.category,r].join("|");
   comparableSets.add(pieces);
  }
 }
 return {total:list.length,unresolved,checklistComplete:ready,flagCounts:countById,comparisonGroups:comparableSets.size};
}
export function comparisonQuestions(target,similar){
 if(!similar?.length)return ["No exact-rule comparable cases are available in this workspace. This does not establish consistency or inconsistency."];
 const statuses=new Set([target,...similar].map(c=>c.status));
 const outputs=["These cases share the same entered community, category, and normalized rule reference. That alone does not prove their underlying facts are comparable."];
 if(statuses.size>1)outputs.push("Recorded case statuses differ. Review relevant facts and procedural stages before interpreting the difference.");
 const summaries=new Set([target,...similar].map(c=>String(c.resolution||"").trim().toLowerCase()).filter(Boolean));
 if(summaries.size>1)outputs.push("Proposed resolution descriptions differ. Check the documented reason for each different approach.");
 outputs.push("Respect other homeowners' privacy and do not use confidential mediation communications in case comparisons.");
 return outputs;
}
