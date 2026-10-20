import React,{useMemo,useState} from "react";
import {BookOpen,FileCheck2,Scale,Users,ShieldCheck,Plus,Download,Info,AlertTriangle,CheckCircle2,FileText,Link2,ArrowRight,Search,LockKeyhole} from "lucide-react";
import {trustOperation,passportChecks,comparePassports,passportExport,TRUST_NOTICE,TRUST_TYPES,TRUST_CATEGORIES,TRUST_SIDES,PASSPORT_STATUSES,REVIEW_STATUSES} from "./trust-engine.js";
import "./trust-center.css";

const PANELS=[
 {id:"rules",title:"RuleGraph",icon:BookOpen,description:"Source versions and exact governing excerpts"},
 {id:"passports",title:"Decision Passports",icon:FileCheck2,description:"Authority, facts, notice and reasons"},
 {id:"positions",title:"Two-sided record",icon:Users,description:"Separate disputed claims and counterevidence"},
 {id:"reviews",title:"Independent review",icon:Scale,description:"Proposed neutrals, disclosures and scope"}
];
const FIELDS={
 rules:[
  ["title","Governing document title","text",true],
  ["kind","Document type","select",true,TRUST_TYPES],
  ["documentReference","Recorded instrument ID, edition or URL citation","text",true],
  ["section","Exact section reference","text",true],
  ["excerpt","Exact relevant source excerpt (paste, do not paraphrase)","textarea",true],
  ["effectiveDate","Effective date if independently known","date"],
  ["supersedes","Earlier version of this source, if amended","source"],
  ["sourceUrl","Official document URL if available","url"],
  ["enteredBy","Source transcribed by (self-reported)","text"],
  ["notes","Verification and applicability notes","textarea"]
 ],
 passports:[
  ["title","Decision or dispute title","text",true],
  ["category","Case category","select",true,TRUST_CATEGORIES],
  ["ruleId","Governing source version","source",true],
  ["claimedActor","Person proposing action (self-reported)","text"],
  ["claimedAuthority","Authority claimed by decision maker","text"],
  ["factSummary","Known facts, uncertainty and contested allegations","textarea",true],
  ["requestedOutcome","Proposed outcome or remedy","textarea",true]
 ],
 positions:[
  ["passportId","Related decision passport","passport",true],
  ["side","Perspective type","select",true,TRUST_SIDES],
  ["author","Contributor name (unverified)","text"],
  ["statement","Factual position or counterargument","textarea",true],
  ["evidenceReference","Evidence reference, filename or citation","text"]
 ],
 reviews:[
  ["passportId","Related decision passport","passport",true],
  ["reviewer","Proposed neutral reviewer","text",true],
  ["organization","Organization (unverified)","text"],
  ["scope","Question and specific material to review","textarea",true],
  ["conflictDisclosure","Affiliations, conflicts and recusal disclosures","textarea",true],
  ["recommendation","Proposed review notes (not a finding)","textarea"]
 ]
};
const FORM_ACTION={rules:"createRule",passports:"createPassport",positions:"addPosition",reviews:"requestReview"};
const el=(values)=>(values||[]);
function safeDate(s){return s?new Date(s).toLocaleDateString(): "Not supplied"}
function downloadPackage(pkg){
 const b=new Blob([JSON.stringify(pkg,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(b);const a=document.createElement("a");
 a.href=url;a.download="commonground-decision-"+pkg.passport.id+".json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1800);
}
function FormField({field,value,onChange,workspace}){
 const [key,label,type,required,options]=field;
 let control;
 if(type==="textarea")control=<textarea rows="3" required={!!required} maxLength={key==="excerpt"?5000:3000} value={value||""} onChange={e=>onChange(key,e.target.value)}/>;
 else if(type==="select"||type==="source"||type==="passport"){
  const opts=type==="source"?el(workspace.rules).map(r=>({id:r.id,label:r.title+" — "+r.section})):type==="passport"?el(workspace.passports).map(r=>({id:r.id,label:r.title})):options.map(o=>({id:o,label:o}));
  control=<select required={!!required} value={value||""} onChange={e=>onChange(key,e.target.value)}><option value="">Select…</option>{opts.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>;
 }else control=<input type={type} required={!!required} value={value||""} onChange={e=>onChange(key,e.target.value)} maxLength="950"/>;
 return <label className="trust-field"><span>{label}{required?" *":""}</span>{control}</label>;
}
export default function TrustCenter({workspace,commit,busy}){
 const [panel,setPanel]=useState("rules"),[showForm,setShowForm]=useState(false),[form,setForm]=useState({});
 const [activeId,setActiveId]=useState(""),[query,setQuery]=useState(""),[edit,setEdit]=useState({});
 const rules=el(workspace.rules),passports=el(workspace.passports),positions=el(workspace.positions),reviews=el(workspace.neutralReviews);
 const records=panel==="rules"?rules:panel==="passports"?passports:panel==="positions"?positions:reviews;
 const filtered=records.filter(o=>JSON.stringify([o.title,o.section,o.documentReference,o.statement,o.reviewer,o.scope]).toLowerCase().includes(query.toLowerCase()));
 const active=passports.find(x=>x.id===activeId)||passports[0]||null;
 const checks=useMemo(()=>active?passportChecks(workspace,active):[],[workspace,active]);
 const related=active?comparePassports(workspace,active):[];
 const pos=active?positions.filter(x=>x.passportId===active.id):[];
 const rev=active?reviews.filter(x=>x.passportId===active.id):[];
 const activeRule=active?rules.find(x=>x.id===active.ruleId):null;
 const changePanel=(p)=>{setPanel(p);setQuery("");setShowForm(false);setForm({})};
 const create=async(e)=>{
  e.preventDefault();
  const isGood=await commit(s=>trustOperation(s,{type:FORM_ACTION[panel],data:form}));
  if(isGood){setShowForm(false);setForm({});}
 };
 const updatePassport=async(e)=>{
  e.preventDefault();if(!active)return;
  const ok=await commit(s=>trustOperation(s,{type:"updatePassport",id:active.id,data:edit}));
  if(ok)setEdit({});
 };
 const updateReview=async(review,status)=>{
  await commit(s=>trustOperation(s,{type:"updateReview",id:review.id,data:{status}}));
 };
 const canCreate=panel!=="passports"||rules.length>0;
 return <div className="trust-center">
  <div className="trust-head"><div><div className="eyebrow">TRANSPARENT GOVERNANCE · LOCAL TRUST WORKBENCH</div><h3>Build a decision that can be explained.</h3><p>Connected source records, proposed decisions, both parties' statements and disclosed reviewers. This is not certified mediation or official notice service.</p></div><ShieldCheck size={26}/></div>
  <div className="trust-warning"><LockKeyhole size={18}/><span>{TRUST_NOTICE} <strong>No legal action, shared invitation, AI determination or external communication occurs here.</strong></span></div>
  <div className="trust-metrics">{[{name:"Source versions",count:rules.length},{name:"Decision passports",count:passports.length},{name:"Perspective entries",count:positions.length},{name:"Proposed reviews",count:reviews.length}].map(m=><div key={m.name}><b>{m.count}</b><small>{m.name}</small></div>)}</div>
  <div className="trust-nav">{PANELS.map(p=>{const Icon=p.icon;return <button key={p.id} className={panel===p.id?"selected":""} onClick={()=>changePanel(p.id)}><Icon size={16}/><span>{p.title}</span></button>})}</div>
  <div className="trust-panel-head"><div><h4>{PANELS.find(p=>p.id===panel)?.title}</h4><p>{PANELS.find(p=>p.id===panel)?.description}</p></div><button type="button" className="btn" disabled={!canCreate||busy} onClick={()=>{setShowForm(v=>!v);setForm({});}}><Plus size={14}/>{showForm?"Close":"Add record"}</button></div>
  {!canCreate?<div className="trust-info"><Info size={16}/> Add a governing source version before preparing a decision passport.</div>:null}
  {showForm&&canCreate?<form className="trust-form" onSubmit={create}><div className="trust-form-grid">{FIELDS[panel].map(f=><FormField key={f[0]} field={f} value={form[f[0]]} onChange={(k,v)=>setForm(o=>({...o,[k]:v}))} workspace={workspace}/>)}</div><p><Info size={14}/> Source quotations and reviewer details are user supplied. Records are not independently checked or shared.</p><button className="btn" type="submit" disabled={busy}>Save encrypted record</button></form>:null}
  <label className="trust-search"><Search size={16}/><span className="sr-only">Filter Trust Center records</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search this module"/></label>
  {filtered.length?<div className="trust-records">{filtered.map(record=><article key={record.id} className="trust-record">
   <div className="trust-record-upper"><div><small>{panel==="rules"?record.kind:panel==="passports"?record.category:panel==="positions"?record.side:record.status}</small><h4>{record.title||record.documentReference||(record.statement?record.statement.slice(0,80):"")||record.reviewer}</h4><p>{panel==="rules"?record.documentReference+" · "+record.section:panel==="passports"?record.status:panel==="positions"?"Reference: "+(record.evidenceReference||"Not supplied"):"Disclosure: "+record.conflictDisclosure}</p></div>{panel==="passports"?<button type="button" className="trust-open" onClick={()=>{setActiveId(record.id);setPanel("passports");setEdit({})}}>Inspect <ArrowRight size={14}/></button>:null}</div>
   {panel==="rules"?<><blockquote>{record.excerpt}</blockquote><p className="trust-small">Effective {safeDate(record.effectiveDate)} · SHA-256 {record.digest.slice(0,18)}… · <strong>User-entered source</strong></p>{record.sourceUrl?<a className="trust-source-link" href={record.sourceUrl} target="_blank" rel="noopener noreferrer"><Link2 size={13}/> Open entered source URL</a>:null}</>:null}
   {panel==="positions"?<p className="trust-note">{record.statement}</p>:null}
   {panel==="reviews"?<div className="trust-review-actions"><label><span>Review tracking</span><select disabled={busy||record.status==="Review closed"} value={record.status} onChange={e=>updateReview(record,e.target.value)}>{REVIEW_STATUSES.map(o=><option key={o}>{o}</option>)}</select></label><small>Proposed reviewer identity not verified</small></div>:null}
   <small className="trust-record-foot">{new Date(record.createdAt).toLocaleDateString()} · Encrypted local entry</small>
  </article>)}</div>:<div className="trust-empty"><FileText size={23}/><p>No records match. Create a record to start building an attributable local history.</p></div>}
  {active&&panel==="passports"?<section className="trust-passport">
   <div className="trust-passport-top"><div><div className="eyebrow">DECISION PASSPORT · HUMAN REVIEW REQUIRED</div><h3>{active.title}</h3><p>{active.category} · {active.community||"Community not labeled"}</p></div><button type="button" className="btn outline" onClick={()=>{if(confirm("This decision package is an UNENCRYPTED JSON export containing sensitive case information. Save it privately?"))downloadPackage(passportExport(workspace,active.id))}}><Download size={14}/> Export complete record</button></div>
   <div className="trust-source-box"><b>Governing reference</b><p>{activeRule?.title||"Source missing"} · {active.ruleSection}</p><blockquote>{active.ruleExcerpt}</blockquote><small>Exact entered source snapshot: {active.ruleDigest.slice(0,26)}…</small></div>
   <div className="trust-check-grid">{checks.map(check=><div key={check.label}><span>{check.complete?<CheckCircle2 size={16} color="#279b78"/>:<AlertTriangle size={16} color="#b77b43"/>}</span><div><b>{check.label}</b><p>{check.detail}</p></div></div>)}</div>
   <div className="trust-passport-columns"><div><h4>Recorded perspectives</h4>{pos.length?pos.map(x=><div key={x.id} className="trust-minor"><b>{x.side}</b><p>{x.statement}</p><small>Evidence ref: {x.evidenceReference||"None"}</small></div>):<p className="trust-small">No perspectives recorded yet.</p>}</div><div><h4>Proposed external reviews</h4>{rev.length?rev.map(x=><div className="trust-minor" key={x.id}><b>{x.reviewer}</b><p>{x.scope}</p><small>{x.status} · Disclosure recorded, not verified</small></div>):<p className="trust-small">No reviewer proposed yet.</p>}</div></div>
   {related.length?<div className="trust-comparisons"><p className="trust-info"><Scale size={15}/> {related.length} other passport(s) share this entered rule version, community and category. Differences warrant factual inquiry, not automatic misconduct conclusions.</p>{related.map(other=><div key={other.id} className="trust-comparison"><b>{other.title}</b><span>{other.status} · {other.category}</span><p><strong>Recorded remedy:</strong> {other.requestedOutcome}</p><p><strong>Documented response:</strong> {other.responseSummary||"Not recorded"}</p><p><strong>Reasoning:</strong> {other.reasoning||"Not recorded"}</p><small>Compare underlying facts, dates, exceptions and sources before drawing conclusions.</small></div>)}</div>:<p className="trust-small">No exact rule-version matches in this workspace. This does not establish whether enforcement was consistent.</p>}
   <form className="trust-revise" onSubmit={updatePassport}><h4>Record procedural progress</h4><div className="trust-form-grid">
    <FormField field={["reasoning","Reason for proposed outcome","textarea"]} value={edit.reasoning??active.reasoning} onChange={(k,v)=>setEdit(o=>({...o,[k]:v}))} workspace={workspace}/>
    <FormField field={["responseSummary","Opportunity to respond and any reply (not delivery proof)","textarea"]} value={edit.responseSummary??active.responseSummary} onChange={(k,v)=>setEdit(o=>({...o,[k]:v}))} workspace={workspace}/>
    <FormField field={["noticeProof","Delivery proof reference (only if independently available)","textarea"]} value={edit.noticeProof??active.noticeProof} onChange={(k,v)=>setEdit(o=>({...o,[k]:v}))} workspace={workspace}/>
    <FormField field={["noticeDraft","Notice draft or notice summary (not transmitted)","textarea"]} value={edit.noticeDraft??active.noticeDraft} onChange={(k,v)=>setEdit(o=>({...o,[k]:v}))} workspace={workspace}/>
    <FormField field={["status","Workflow tracking status","select",false,PASSPORT_STATUSES]} value={edit.status??active.status} onChange={(k,v)=>setEdit(o=>({...o,[k]:v}))} workspace={workspace}/>
   </div><p className="trust-small">These are claims about process. Dates, actual delivery, authority and legal rights still require independent checking.</p><button className="btn" type="submit" disabled={busy}>Save revised passport</button></form>
  </section>:null}
  <div className="trust-method"><ShieldCheck size={16}/><span>Records are encrypted in the existing local workspace and included in its audit snapshot. SHA-256 proves only the recorded bytes match their digest. It does not authenticate the source, person, notice, inspector, or conclusion.</span></div>
 </div>;
}
