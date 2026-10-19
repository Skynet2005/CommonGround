import React,{useMemo,useState} from "react";
import {Scale,ClipboardCheck,AlertTriangle,CheckCircle2,Search,FileText,ArrowRight,Info,ShieldCheck,BookOpen,Users,Eye} from "lucide-react";
import {reviewFlags,reviewSummary,comparableCases,comparisonQuestions} from "./review-engine.js";

export default function ProcessReview({cases,onViewCase}){
 const [category,setCategory]=useState("All");
 const [active,setActive]=useState(null);
 const filtered=useMemo(()=>cases.filter(c=>category==="All"||c.category===category),[cases,category]);
 const categories=[...new Set(cases.map(c=>c.category))].sort();
 const stats=reviewSummary(cases);
 const selected=cases.find(c=>c.id===active)||filtered[0];
 const matching=selected?comparableCases(selected,cases):[];
 const flags=selected?reviewFlags(selected):[];
 return <section className="review-workbench">
  <div className="section-head"><div><div className="eyebrow">COMMUNITY ACCOUNTABILITY</div><h2>Review the process, not the person.</h2><p>Understand gaps in documented authority, factual support, participation and remedies. Compare only records with the exact same entered community, category and rule reference.</p></div></div>
  <div className="review-metrics">
   <div><span><ClipboardCheck size={19}/></span><b>{stats.total}</b><small>Cases inspected</small></div>
   <div><span><AlertTriangle size={19}/></span><b>{stats.unresolved}</b><small>Not marked resolved</small></div>
   <div><span><CheckCircle2 size={19}/></span><b>{stats.checklistComplete}</b><small>Checklists fully documented</small></div>
   <div><span><Scale size={19}/></span><b>{stats.comparisonGroups}</b><small>Shared rule-reference groups</small></div>
  </div>
  <div className="review-intro"><Info size={17}/><span><b>Interpretation safeguard:</b> These results only measure whether particular fields have been filled in. They do not establish legal compliance, procedural fairness, discrimination, selective enforcement or the truth of an allegation.</span></div>
  <div className="review-filters"><label htmlFor="review-category">Category</label><select id="review-category" value={category} onChange={e=>{setCategory(e.target.value);setActive(null)}}><option>All</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
  {filtered.length?<div className="review-grid">
   <div className="panel review-case-list">{filtered.map(c=>{const missing=reviewFlags(c);return <button className={"review-case-option "+(selected?.id===c.id?"selected":"")} key={c.id} onClick={()=>setActive(c.id)}><span className="review-case-symbol"><FileText size={18}/></span><span className="review-case-text"><b>{c.title}</b><small>{c.community} · {c.category}</small></span><span className={"review-case-number "+(missing.length?"open":"done")}>{missing.length} gap{missing.length===1?"":"s"}</span></button>})}</div>
   {selected?<div className="panel review-analysis">
    <div className="review-analysis-head"><div className="eyebrow">PROCEDURAL DOCUMENTATION</div><h3>{selected.title}</h3><p>{selected.community} · {selected.category}</p></div>
    <div className="review-issues">{flags.length?flags.map(item=><div className="review-issue" key={item.id}><span className={"review-severity "+item.importance}><AlertTriangle size={16}/></span><div><b>{item.message}</b><p>{item.action}</p></div></div>):<div className="review-complete"><CheckCircle2 size={26}/><div><b>All five documentation checks are filled.</b><p>That does not verify accuracy, lawful notice, consistency or a correct outcome. Qualified review may still be needed.</p></div></div>}</div>
    <div className="review-compare"><div className="review-compare-head"><Scale size={19}/><div><b>Comparable case review</b><small>{matching.length} exact-reference match{matching.length===1?"":"es"} found in this browser</small></div></div>
     {comparisonQuestions(selected,matching).map((q,i)=><p key={i}>{q}</p>)}
     {matching.length?<div className="review-compare-list">{matching.map(c=><button key={c.id} onClick={()=>onViewCase(c.id)}><span><b>{c.title}</b><small>{c.status} · {c.category}</small></span><ArrowRight size={16}/></button>)}</div>:null}
    </div>
    <button className="btn" onClick={()=>onViewCase(selected.id)}>Open case to document next steps <ArrowRight size={15}/></button>
   </div>:null}
   </div>:<div className="panel empty"><span className="empty-icon"><Search size={24}/></span><h3>No cases in this category</h3><p>Choose another category or create a sample case.</p></div>}
  <div className="review-method"><ShieldCheck size={18}/><span>Method: deterministic field completeness and exact recorded rule-reference matching, computed only from this browser's local case records. No AI classification, external data exchange or automated enforcement is involved.</span></div>
 </section>
}
