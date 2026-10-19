
export const OFFICIAL="https://www.flsenate.gov/Laws/Statutes/2026/";
export const GUIDE_DATE="2026 Florida Statutes (retrieved October 19, 2026)";
export const GUIDES=[
 {id:"architectural",title:"Architectural or fence dispute",tag:"Property & improvements",law:["720.3035","720.311","720.305"],intro:"The governing declaration and authorized published standards matter. A setback or architectural standard alone is not proof of a right to enter or alter someone's property.",steps:[
  {name:"Locate the recorded declaration",detail:"Identify the current governing declaration, recorded amendments, any authorized guidelines and the applicable version.",source:"720.3035"},
  {name:"Separate the disputed facts",detail:"Identify the survey, easement, property line, installation approvals and the claimed authority for a requested change. Do not assume a setback is an easement or a right of physical entry.",source:"720.3035"},
  {name:"Check consistency",detail:"Compare the actual published standard and comparable decisions without disclosing other owners' private records.",source:"720.3035"},
  {name:"Invite a documented response",detail:"Present the homeowner's and association's positions separately. Record contested measurements and any qualified independent inspection.",source:"720.305"},
  {name:"Assess the correct dispute path",detail:"Many parcel-use, changes and covenant-enforcement disputes fall under §720.311 presuit mediation. Urgent relief, exceptions and other legal rights require individualized review.",source:"720.311"}
 ]},
 {id:"fine",title:"Proposed fine or suspension",tag:"Enforcement & due process",law:["720.305"],intro:"Do not mistake a general violation notice for the notice and independent committee process required to impose certain fines or suspensions under §720.305(2).",steps:[
  {name:"Verify legal and documentary authority",detail:"Identify the allegedly violated rule and whether the proposal is a fine, use-right suspension, assessment collection, or something else. Different provisions can apply.",source:"720.305"},
  {name:"Record written hearing-right notice",detail:"For §720.305(2) fines or suspensions, review whether at least 14 days' written notice of the right to a hearing was provided, including required notice details.",source:"720.305"},
  {name:"Verify committee hearing procedure",detail:"For §720.305(2) hearings, the statute addresses a hearing within 90 days of notice before a committee of at least three members who meet conflict restrictions.",source:"720.305"},
  {name:"Record committee findings and cure",detail:"The statute addresses majority approval, cure protections, and written notice of findings within 7 days after the hearing.",source:"720.305"},
  {name:"Check payment and appeal consequences",detail:"For approved unpaid fines in the specified circumstances, the payment date must be at least 30 days after delivery of the findings notice. Review all applicable restrictions before demanding payment or fees.",source:"720.305"}
 ]},
 {id:"records",title:"Official records access",tag:"Transparency",law:["720.303","720.311"],intro:"Members have statutory inspection rights, subject to specific exemptions and procedures. Do not assume all association records must be publicly published.",steps:[
  {name:"Define the records requested",detail:"Identify the member, the association, the specific records and the delivery/receipt evidence for the request.",source:"720.303"},
  {name:"Identify the access rule",detail:"Section 720.303(5) generally requires access within 10 business days after receipt of a proper request, subject to specific statutory provisions.",source:"720.303"},
  {name:"Respect restricted records",detail:"Redact or withhold confidential records as required. Broad publication is not equivalent to lawful member access.",source:"720.303"},
  {name:"Record what was provided",detail:"Track dates, copies, redactions and any stated basis for withholding.",source:"720.303"},
  {name:"Review escalation channel",detail:"Official-records disputes are among the specified categories subject to presuit mediation under §720.311.",source:"720.311"}
 ]},
 {id:"elections",title:"Election or recall dispute",tag:"Governance",law:["720.306","720.3065","720.311","720.317"],intro:"Association elections, voting and recalls require special treatment. Election and recall disputes are excluded from ordinary §720.311 presuit mediation.",steps:[
  {name:"Identify the actual election issue",detail:"Distinguish director election, recall, amendment vote, or other member action.",source:"720.306"},
  {name:"Preserve notices and ballots securely",detail:"Maintain relevant notices, eligibility rules, tally records, consent records and appropriately protected ballot secrecy.",source:"720.317"},
  {name:"Identify the correct legal forum",detail:"Section 720.311 distinguishes election/recall disputes from the disputes subject to statutory presuit mediation.",source:"720.311"},
  {name:"Get neutral legal review",detail:"Do not have a platform automatically void an election or disclose secret ballot data.",source:"720.311"}
 ]},
 {id:"assessments",title:"Assessments or collections",tag:"Finances & property rights",law:["720.303","720.3085","720.311"],intro:"Assessment payment, lien and collection disputes can implicate property rights. These are not interchangeable with ordinary covenant-enforcement mediation.",steps:[
  {name:"Identify the charge",detail:"Separate regular assessments, special assessments, fines, interest and costs.",source:"720.3085"},
  {name:"Preserve approvals and financial records",detail:"Collect applicable budgets, meeting notices, ledger entries and communications.",source:"720.303"},
  {name:"Review statutory collection requirements",detail:"Do not infer that a general notice or a disputed fine automatically authorizes a lien, foreclosure or attorney fees.",source:"720.3085"},
  {name:"Avoid the wrong presuit workflow",detail:"Section 720.311(2) excludes collection of assessments, fines and other financial obligations from its specified presuit mediation disputes.",source:"720.311"},
  {name:"Require legal review before serious action",detail:"Liens, foreclosures and property title interests must remain outside autonomous software authority.",source:"720.3085"}
 ]}
];
export function lawURL(section){return OFFICIAL+section}
export function guideForCategory(category){
 if(category==="Architectural")return "architectural";
 if(category==="Enforcement")return "fine";
 if(category==="Records")return "records";
 if(category==="Elections")return "elections";
 if(category==="Financial")return "assessments";
 return "architectural";
}
export function docketMarkdown(c,checks){
 const val=x=>String(x||"Not supplied").replace(/[\u0000-\u001f]/g," ").trim();
 const rows=(c.events||[]).map(e=>"- "+val(e.when)+" | "+val(e.type)+" | "+val(e.by)+" | "+val(e.note)+" | Hash: "+val(e.hash||"not hashed")).join("\n");
 return [
 "# CommonGround case brief",
 "**Prepared:** "+new Date().toISOString(),
 "**Status:** Draft compiled from a single unverified browser workspace. Not submitted, served, legally reviewed, or independently authenticated.",
 "",
 "## Case", "- ID: "+val(c.id),"- Title: "+val(c.title),"- Community: "+val(c.community),"- Category: "+val(c.category),"- Status (self-reported): "+val(c.status),"- Created: "+val(c.createdAt),
 "", "## Allegations and factual summary",val(c.description),"", "## Cited authority (user-supplied)",val(c.rule),"", "## Evidence narrative (user-supplied)",val(c.evidence),"",
 "## Suggested resolution (user-supplied)",val(c.resolution),"",
 "## Procedural documentation checklist",...checks.map(x=>"- ["+(x.passed?"x":" ")+"] "+x.name+" — "+x.details),
 "", "## Local activity history",rows||"None.",
 "", "## Legal limitations",
 "This brief is a privately prepared summary of inputs. It does not determine the truth of disputed claims, legal compliance, jurisdiction, notice service, or the existence of property rights. Local SHA-256 hash links detect some alterations but do not provide independently controlled evidence custody.",
 "Relevant source: "+OFFICIAL.replace(/\/$/,"")+"/Chapter720"
 ].join("\n");
}
