
import React,{useState} from "react";
import {ArrowUpRight,BookOpen,CheckCircle2,Info,Scale,AlertTriangle,Landmark,FileText,ShieldCheck,ArrowRight} from "lucide-react";
import {GUIDES,lawURL,GUIDE_DATE,guideForCategory} from "./procedures";
const typeIcons={architectural:Scale,fine:ShieldCheck,records:FileText,elections:CheckCircle2,assessments:Landmark};
export default function Navigator({category}){
 const [selected,setSelected]=useState(category?guideForCategory(category):"architectural");
 const [reviewed,setReviewed]=useState({});
 const guide=GUIDES.find(g=>g.id===selected)||GUIDES[0];
 const checked=new Set(reviewed[guide.id]||[]);
 function toggle(i){setReviewed(prev=>{const old=new Set(prev[guide.id]||[]);old.has(i)?old.delete(i):old.add(i);return {...prev,[guide.id]:[...old]}})}
 return <div className={category?"navigator-inline":"navigator-main"}>
 {category?<div className="nav-case-heading"><div><h3>Florida procedure navigator</h3><p>Research prompts, not a legal opinion.</p></div></div>:<div className="section-head"><div><div className="eyebrow">SOURCE-BACKED GUIDANCE</div><h2>Start with the right process.</h2><p>Explore practical information-gathering steps mapped to the official 2026 Florida statutes. Different HOA disputes follow different procedures.</p></div></div>}
 <div className="guide-layout">
 <div className="guide-menu">
 {GUIDES.map(g=>{const Icon=typeIcons[g.id]||BookOpen;return <button type="button" className={selected===g.id?"guide-choice chosen":"guide-choice"} key={g.id} onClick={()=>setSelected(g.id)}><Icon size={17}/><span>{g.title}</span><ArrowRight size={14}/></button>})}
 </div>
 <div className="panel guide-content">
  <div className="guide-top"><div className="eyebrow">{guide.tag}</div><h3>{guide.title}</h3><p>{guide.intro}</p><div className="guide-date"><BookOpen size={14}/>{GUIDE_DATE}</div></div>
  <div className="guide-step-list">{guide.steps.map((step,i)=><div className="guide-step" key={step.name}><button className={checked.has(i)?"guide-tick done":"guide-tick"} onClick={()=>toggle(i)} aria-label={(checked.has(i)?"Unmark":"Mark")+" reviewed: "+step.name}>{checked.has(i)?<CheckCircle2 size={21}/>:<span>{i+1}</span>}</button><div><b>{step.name}</b><p>{step.detail}</p><a href={lawURL(step.source)} target="_blank" rel="noreferrer">Florida § {step.source} <ArrowUpRight size={14}/></a></div></div>)}</div>
  <div className="guide-bottom"><Info size={18}/><div><strong>These steps are not compliance determinations.</strong><p>Check the applicable version of the law, the recorded governing documents, the exact facts, and statutory exceptions. Checking a box only marks that you reviewed a topic in this session. Nothing is automatically filed, served or imposed.</p></div></div>
  <div className="guide-references"><span>PRIMARY SOURCES</span>{guide.law.map(l=><a key={l} target="_blank" rel="noreferrer" href={lawURL(l)}>§ {l} <ArrowUpRight size={13}/></a>)}</div>
 </div>
 </div></div>
}
