
import React,{useEffect,useRef,useState} from "react";
import {Landmark,Users,CalendarDays,Wrench,BriefcaseBusiness,Wallet,FileCheck2,FolderOpen,Vote,LockKeyhole,UnlockKeyhole,Download,Upload,Plus,Trash2,ShieldCheck,Info,AlertTriangle,RefreshCw,CheckCircle2,ArrowRight,Eye,EyeOff,FileText,RotateCcw} from "lucide-react";
import {emptyOperations,readOperations,saveOperations,hasOperations,removeOperations,applyOperation,appendAudit,financialReport,parseMoney,money,OPERATIONS_NOTICE,encryptedBackupRecord,restoreEncryptedOperations} from "./operations-store.js";
import {addEvidence,listEvidence,retrieveEvidence,downloadEvidence} from "./vault.js";
import "./operations.css";
import TrustCenter from "./TrustCenter.jsx";

const TABS=[
 {id:"trust",name:"Trust Center",icon:ShieldCheck,summary:"Source-linked decision accountability"},
 {id:"members",name:"People & roles",icon:Users,summary:"Self-reported participation and authority"},
 {id:"meetings",name:"Meetings",icon:CalendarDays,summary:"Agendas, decisions and minutes"},
 {id:"requests",name:"Maintenance",icon:Wrench,summary:"Request-to-completion tracking"},
 {id:"bids",name:"Vendor review",icon:BriefcaseBusiness,summary:"Quotes, conflicts and decisions"},
 {id:"finance",name:"Budget & ledger",icon:Wallet,summary:"Budget estimates and balanced example entries"},
 {id:"notices",name:"Notice drafts",icon:FileCheck2,summary:"Draft communication and cited sources"},
 {id:"documents",name:"Documents",icon:FolderOpen,summary:"Document index and encrypted files"},
 {id:"polls",name:"Community feedback",icon:Vote,summary:"Informal, nonbinding input"}
];
const FIELDS={
 members:[["name","Name or identifier","text",true],["capacity","Claimed role","select",true,["Owner (self-reported)","Tenant (self-reported)","Board (unverified)","Manager (unverified)","Neutral (unverified)"]],["detail","Scope, authorization evidence or notes","textarea"]],
 meetings:[["title","Meeting or agenda title","text",true],["date","Meeting date","date",true],["location","Location or meeting medium","text"],["detail","Agenda, decisions and notes","textarea"]],
 requests:[["title","Maintenance issue","text",true],["location","Location (avoid sensitive address details)","text"],["detail","Description and requested work","textarea",true]],
 bids:[["vendor","Vendor or bidder","text",true],["scope","Work scope","textarea",true],["amount","Quoted amount, USD","money"],["conflict","Related-party or conflict disclosure","textarea"]],
 budgets:[["category","Budget category","text",true],["amount","Proposed annual allocation, USD","money",true],["detail","Budget assumptions","textarea"]],
 expenses:[["category","Accounting category","text",true],["amount","Example expenditure, USD","money",true],["reference","Document or vendor reference","text"],["notes","Explanation","textarea"]],
 notices:[["title","Draft notice subject","text",true],["reference","Referenced rule or document","text"],["deadline","Proposed date (not legally calculated)","date"],["message","Draft text (not delivered)","textarea",true]],
 documents:[["title","Record title","text",true],["reference","Source, reference or version","text"],["detail","Custody and access notes","textarea"]],
 polls:[["question","Question","text",true],["choices","Choices (separate with |)","textarea",true],["detail","Purpose and limitations","textarea"]]
};
const STATUS={
 members:["Proposed","Reviewed","Revoked"],meetings:["Planned","Held","Minutes drafted","Closed"],
 requests:["Open","Triaged","Scheduled","Completed","Canceled"],
 bids:["Received","Under review","Declined","Selected"],
 budgets:["Draft","Proposed","Approved"],
 notices:["Draft","Reviewed","Archived"],documents:["Draft","Reviewed","Archived"],polls:["Open","Closed"]
};
const MAX_BACKUP=11*1024*1024;
function downloadJson(content,name){
 const blob=new Blob([content],{type:"application/json"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function Field({spec,form,onChange}){
 const [key,label,type,required,choices]=spec;
 return <label className="ops-field"><span>{label}{required?" *":""}</span>{type==="textarea"?<textarea rows={key==="message"||key==="detail"?3:2} value={form[key]||""} onChange={e=>onChange(key,e.target.value)} required={!!required} maxLength={key==="message"||key==="detail"?2400:500}/>:type==="select"?<select value={form[key]||""} required={!!required} onChange={e=>onChange(key,e.target.value)}><option value="">Choose a role</option>{choices.map(o=><option key={o}>{o}</option>)}</select>:<input value={form[key]||""} onChange={e=>onChange(key,e.target.value)} type={type==="money"?"text":type} inputMode={type==="money"?"decimal":undefined} placeholder={type==="money"?"125.00":undefined} pattern={type==="money"?"[0-9]{1,9}(\\.[0-9]{1,2})?":undefined} required={!!required} maxLength="500"/>}</label>
}
function moduleCount(state,id){return id==="finance"?state.budgets.length+state.expenses.length:id==="trust"?(state.rules||[]).length+(state.passports||[]).length+(state.positions||[]).length+(state.neutralReviews||[]).length:state[id].length}
function labelFor(item,kind){return item.title||item.name||item.vendor||item.category||item.question||kind}
function supporting(item,kind){
 if(kind==="members")return item.capacity;
 if(kind==="meetings")return item.date+(item.location?" · "+item.location:"");
 if(kind==="requests")return item.location||"Issue tracked";
 if(kind==="bids")return item.scope;
 if(kind==="budgets"||kind==="expenses")return money(item.amountCents)+(item.reference?" · "+item.reference:"");
 if(kind==="notices")return item.reference||"Authority not supplied";
 if(kind==="documents")return item.reference||"No source reference";
 if(kind==="polls")return item.choices?.join(" / ");
 return "";
}
function SetStatus({kind,item,onChange,disabled}){
 const options=STATUS[kind];if(!options)return null;
 return <label className="ops-status-label"><span className="sr-only">Update status</span><select disabled={disabled} value={item.status} onChange={e=>onChange(item.id,e.target.value)} aria-label={"Status for "+labelFor(item,kind)}>{options.map(v=><option key={v}>{v}</option>)}</select></label>
}
function FileBin({doc,passphrase,busy,setBusy,setError,setSuccess}){
 const [files,setFiles]=useState([]);
 const picker=useRef(null);
 const key="ops-document-"+doc.id;
 const refresh=async()=>{try{setFiles(await listEvidence(key))}catch(e){setError(e.message)}};
 useEffect(()=>{refresh()},[doc.id]);
 const add=async e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  if(file.size<1||file.size>8*1024*1024){setError("Files must be 1 byte to 8 MB.");return}
  setBusy(true);
  try{await addEvidence(file,passphrase,key);await refresh();setSuccess("File encrypted and attached locally. Keep the original as well.");setError("");}
  catch(err){setError(err.message)}finally{setBusy(false)}
 };
 const open=async id=>{
  setBusy(true);try{const info=await retrieveEvidence(id,passphrase);downloadEvidence(info);setError("")}
  catch(err){setError(err.message)}finally{setBusy(false)}
 };
 return <div className="ops-doc-bin"><div className="ops-doc-header"><small><LockKeyhole size={13}/> {files.length} encrypted file(s)</small><button type="button" disabled={busy} onClick={()=>picker.current?.click()}><Upload size={13}/> Attach file</button><input ref={picker} type="file" onChange={add} hidden/></div>{files.map(f=><div key={f.id} className="ops-file"><span>Sealed file · {new Date(f.createdAt).toLocaleDateString()} · {Math.ceil(f.size/1024)} KB</span><button onClick={()=>open(f.id)} disabled={busy} type="button" aria-label="Decrypt attached file"><Download size={15}/></button></div>)}</div>
}
export default function Operations(){
 const [exists,setExists]=useState(null),[password,setPassword]=useState(""),[show,setShow]=useState(false);
 const [workspace,setWorkspace]=useState(null),[tab,setTab]=useState("members"),[form,setForm]=useState({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [creating,setCreating]=useState(false),[editing,setEditing]=useState(null),[communityDraft,setCommunityDraft]=useState(""),[fileBusy,setFileBusy]=useState(false);
 const passRef=useRef(""),revisionRef=useRef(0),stateRef=useRef(null),importRef=useRef(null),savingRef=useRef(false);
 useEffect(()=>{hasOperations().then(setExists).catch(e=>setError(e.message))},[]);
 function lock(){passRef.current="";stateRef.current=null;setWorkspace(null);setPassword("");setForm({});setEditing(null);setSuccess("");}
 async function unlock(e){
  e.preventDefault();if(password.length<12)return setError("Use at least 12 characters for the passphrase.");
  setBusy(true);setError("");
  try{
   const loaded=await readOperations(password);
   if(loaded){stateRef.current=loaded.workspace;revisionRef.current=loaded.revision;setWorkspace(loaded.workspace);}
   else{const state=emptyOperations();const rev=await saveOperations(state,password,0);stateRef.current=state;revisionRef.current=rev;setWorkspace(state);setExists(true);}
   passRef.current=password;setPassword("");setSuccess("Encrypted workspace unlocked for this browser session.");
  }catch(err){setError(err.message)}finally{setBusy(false)}
 }
 async function commit(transform){
  if(!stateRef.current||savingRef.current)return false;
  savingRef.current=true;setBusy(true);setError("");setSuccess("");
  try{
   const next=await transform(stateRef.current);
   if(next===stateRef.current)return;
   const revision=await saveOperations(next,passRef.current,revisionRef.current);
   revisionRef.current=revision;stateRef.current=next;setWorkspace(next);setSuccess("Changes encrypted and saved locally.");return true;
  }catch(err){setError(err.message);return false}finally{setBusy(false);savingRef.current=false}
 }
 async function create(e){
  e.preventDefault();
  const kind=tab==="finance"?form.mode==="budget"?"budgets":"expenses":tab;
  try{
   const input={...form};
   if(kind==="budgets"||kind==="expenses"||(kind==="bids"&&input.amount))input.amountCents=parseMoney(input.amount);
   if(kind==="polls")input.choices=String(input.choices||"").split("|").map(v=>v.trim());
   const saved=await commit(state=>applyOperation(state,{type:editing?"edit":"add",kind,id:editing||undefined,data:input}));
   if(saved){setForm({});setCreating(false);setEditing(null);}
  }catch(err){setError(err.message)}
 }
 function startEdit(item){
  if(item.kind==="expenses"||item.archivedAt)return;
  if(item.kind==="budgets"&&item.status==="Approved")return;
  if(item.kind==="polls"&&item.responses.length)return;
  const draft={...item};
  if(draft.amountCents)draft.amount=(draft.amountCents/100).toFixed(2);
  if(Array.isArray(draft.choices))draft.choices=draft.choices.join(" | ");
  if(tab==="finance")draft.mode="budget";
  setEditing(item.id);setForm(draft);setCreating(true);setError("");
 }
 async function archiveItem(item){
  if(!confirm("Archive this local record? Its details will remain in your encrypted history."))return;
  await commit(state=>applyOperation(state,{type:"archive",kind:item.kind,id:item.id}));
 }
 async function destroyWorkspace(){
  if(!confirm("Delete the complete encrypted operations workspace from this browser? Export a backup first."))return;
  if(!confirm("This cannot be undone without an encrypted backup and its passphrase. Continue?"))return;
  setBusy(true);setError("");
  try{await removeOperations(revisionRef.current);lock();setExists(false);setSuccess("Operations metadata deleted. Encrypted document attachments remain in Evidence vault.");}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function saveCommunity(e){
  e.preventDefault();
  await commit(async state=>{
   const value=communityDraft.trim().slice(0,200);
   const next={...state,community:value};
   return appendAudit(next,{action:"Community label",kind:"workspace",itemId:"private",details:"Private local community description updated"});
  });
 }
 async function changeStatus(kind,id,status){await commit(state=>applyOperation(state,{type:"status",kind,id,status}))}
 async function reverseExpense(id){if(!confirm("Enter a compensating example journal entry? The original event will remain in the audit record."))return;await commit(state=>applyOperation(state,{type:"reverse",kind:"expenses",id}))}
 async function respond(id,choice){await commit(state=>applyOperation(state,{type:"respond",kind:"polls",id,choice}))}
 async function encryptedExport(){
  setBusy(true);setError("");
  try{const backup=await encryptedBackupRecord();downloadJson(backup,"commonground-operations-encrypted.json");setSuccess("Encrypted metadata backed up. Export the evidence vault separately to preserve attached documents.");}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function restoreFile(e){
  const file=e.target.files?.[0];e.target.value="";if(!file)return;
  if(file.size>MAX_BACKUP)return setError("Backup is too large.");
  if(exists&&!confirm("Replace your current encrypted operations workspace with this backup? Export a current backup first."))return;
  setBusy(true);setError("");
  try{const raw=await file.text();const existing=exists?await readOperations(passRef.current||password):null;const phrase=passRef.current||password;
   if(phrase.length<12)throw Error("Enter the backup passphrase first.");
   const result=await restoreEncryptedOperations(raw,phrase,existing?.revision||0);
   revisionRef.current=result.revision;stateRef.current=result.workspace;passRef.current=phrase;setWorkspace(result.workspace);setExists(true);setSuccess("Encrypted backup restored. Attached file backups must be restored separately from Evidence vault.");
  }catch(err){setError(err.message)}finally{setBusy(false)}
 }
 const report=workspace?financialReport(workspace):null;
 const items=workspace?tab==="finance"?[...workspace.budgets.map(x=>({...x,kind:"budgets"})),...workspace.expenses.map(x=>({...x,kind:"expenses"}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)):tab==="trust"?[]:workspace[tab].map(x=>({...x,kind:tab})):[];
 return <div className="operations-page"><div className="section-head"><div><div className="eyebrow">COMMUNITY OPERATIONS</div><h2>Manage the work. Document the decisions.</h2><p>Track community processes in one encrypted, private workspace with a consistent activity history.</p></div>{workspace?<button className="btn outline" onClick={lock}><LockKeyhole size={15}/> Lock workspace</button>:null}</div>
 {!workspace?<div className="ops-entry"><div className="ops-entry-symbol"><LockKeyhole size={30}/></div><h3>{exists===false?"Create your encrypted workspace":"Unlock your private workspace"}</h3><p>{OPERATIONS_NOTICE}</p><form onSubmit={unlock}><label className="ops-field"><span>{exists===false?"Create a recovery passphrase":"Workspace passphrase"}</span><span className="ops-pass"><input autoComplete="off" spellCheck="false" type={show?"text":"password"} minLength="12" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 12 characters"/><button type="button" aria-label={show?"Hide passphrase":"Show passphrase"} onClick={()=>setShow(x=>!x)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label><button className="btn" disabled={busy||password.length<12} type="submit"><UnlockKeyhole size={16}/>{busy?"Decrypting…":exists===false?"Create private workspace":"Unlock workspace"}</button></form><p className="ops-caution">The passphrase is never saved. Without your passphrase or exported encrypted backup, your workspace may be unrecoverable. Records aren't automatically synchronized between devices.</p><button className="ops-restore-button" disabled={busy} onClick={()=>importRef.current?.click()}><Upload size={15}/> Restore encrypted operations backup</button><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={restoreFile}/></div>:
 <><div className="ops-security"><div><ShieldCheck size={19}/><span><b>Local encrypted mode</b><small>{OPERATIONS_NOTICE}</small></span></div><div className="ops-security-actions"><button type="button" onClick={encryptedExport} disabled={busy}><Download size={15}/> Export encrypted backup</button><button type="button" className="ops-delete" onClick={destroyWorkspace} disabled={busy}><Trash2 size={15}/> Erase metadata</button></div></div>
 <div className="ops-community"><div><span>PRIVATE COMMUNITY LABEL</span><h3>{workspace.community||"No community selected"}</h3></div><form onSubmit={saveCommunity}><input value={communityDraft} maxLength="200" placeholder="Community reference (avoid private details)" onChange={e=>setCommunityDraft(e.target.value)}/><button className="btn outline" disabled={busy||!communityDraft.trim()} type="submit">Save label</button></form></div>
 <div className="ops-kpis"><div><b>{workspace.members.length}</b><small>Self-reported people</small></div><div><b>{workspace.requests.filter(x=>x.status!=="Completed"&&x.status!=="Canceled").length}</b><small>Active requests</small></div><div><b>{workspace.meetings.length}</b><small>Tracked meetings</small></div><div><b>{workspace.events.length}</b><small>Local audit events</small></div></div>
 <div className="ops-layout"><nav className="ops-tabs" aria-label="Community operations modules">{TABS.map(x=>{const Icon=x.icon;return <button key={x.id} className={tab===x.id?"active":""} onClick={()=>{setTab(x.id);setForm({});setCreating(false);setEditing(null)}}><Icon size={18}/><span>{x.name}</span><small>{moduleCount(workspace,x.id)}</small></button>})}</nav>
 <section className="ops-main">{tab==="trust"?<TrustCenter workspace={workspace} commit={commit} busy={busy} passphrase={passRef.current}/>:<><div className="ops-main-header"><div><div className="eyebrow">{TABS.find(x=>x.id===tab).summary}</div><h3>{TABS.find(x=>x.id===tab).name}</h3></div><button className="btn" onClick={()=>{setCreating(x=>!x);setEditing(null);setForm({mode:"budget"})}}><Plus size={15}/>{creating?"Close form":"New record"}</button></div>
 {tab==="finance"?<div className="ops-finance"><div><small>Approved allocations (illustrative)</small><b>{money(report.planned)}</b></div><div><small>Net example spending</small><b>{money(report.netExpense)}</b></div><div><small>Illustrative remaining</small><b>{money(report.remaining)}</b></div><div className={report.balanced?"balanced":"unbalanced"}><CheckCircle2 size={17}/>{report.balanced?"All example entries balance":"Unbalanced example entries"}</div></div>:null}
 {creating?<form className="ops-create" onSubmit={create}>
  <div className="ops-create-top"><b>{editing?"Edit record":"Add "+(tab==="finance"?"financial record":TABS.find(x=>x.id===tab).name.toLowerCase()+" record")}</b><span>Stored only in the encrypted browser workspace</span></div>
  {tab==="finance"?<label className="ops-field"><span>Record type</span><select disabled={!!editing} value={form.mode||"budget"} onChange={e=>setForm({mode:e.target.value})}><option value="budget">Planned budget allocation</option><option value="expense">Illustrative expense journal entry</option></select></label>:null}
  <div className="ops-form-grid">{FIELDS[tab==="finance"?(form.mode==="expense"?"expenses":"budgets"):tab].map(f=><Field key={f[0]} spec={f} form={form} onChange={(k,v)=>setForm(s=>({...s,[k]:v}))}/>)}</div>
  <div className="ops-legal-note"><Info size={16}/>{tab==="notices"?"This saves a draft only. It is not served and does not calculate a legal deadline.":tab==="polls"?"This is an informal feedback poll, not a legally compliant HOA election.":tab==="finance"?"No real funds, invoices or accounts are changed. Values are illustrative only.":"Use descriptive, non-sensitive identifiers. These records are not independently authenticated."}</div>
  <button type="submit" className="btn" disabled={busy}><Plus size={15}/> {editing?"Save revised record":"Encrypt and save record"}</button>
 </form>:null}
 {items.length===0?<div className="ops-empty"><span><FolderOpen size={25}/></span><h4>No records yet</h4><p>Start by creating a record. It will be encrypted locally and included in the workspace audit history.</p></div>:
 <div className="ops-records">{items.map(item=><article className="ops-record" key={item.id}><div className="ops-record-top"><div><small>{item.kind==="budgets"?"BUDGET ALLOCATION":item.kind==="expenses"?"ILLUSTRATIVE LEDGER":TABS.find(t=>t.id===tab)?.name.toUpperCase()}</small><h4>{labelFor(item,item.kind)}</h4><p>{supporting(item,item.kind)}</p></div>{item.kind!=="expenses"?<SetStatus kind={item.kind} item={item} disabled={busy||!!item.archivedAt} onChange={(id,status)=>changeStatus(item.kind,id,status)}/>:<span className="ops-static-status">{item.reverses?"Compensating entry":item.status}</span>}</div>
 <div className="ops-record-actions">{item.archivedAt?<span>Archived locally</span>:<>{item.kind!=="expenses"&&(item.kind!=="budgets"||item.status!=="Approved")&&(item.kind!=="polls"||!item.responses.length)?<button type="button" disabled={busy} onClick={()=>startEdit(item)}><FileText size={13}/> Edit</button>:null}{item.kind!=="expenses"&&item.kind!=="budgets"?<button type="button" disabled={busy} onClick={()=>archiveItem(item)}><FolderOpen size={13}/> Archive</button>:null}</>}</div>
 {item.detail||item.message||item.notes||item.conflict?<div className="ops-record-notes">{[item.detail,item.message,item.notes,item.conflict].filter(Boolean).map((value,i)=><p key={i}>{value}</p>)}</div>:null}
 {item.kind==="expenses"?<div className="ops-ledger-lines">{item.ledger.map((line,i)=><div key={i}><span>{line.account.replaceAll("_"," ")}</span><span>Debit {money(line.debit)}</span><span>Credit {money(line.credit)}</span></div>)}{!item.reverses&&item.status==="Recorded"?<button type="button" disabled={busy} onClick={()=>reverseExpense(item.id)}><RotateCcw size={14}/> Enter reversal</button>:null}</div>:null}
 {item.kind==="documents"?<FileBin doc={item} passphrase={passRef.current} busy={busy||fileBusy} setBusy={setFileBusy} setError={setError} setSuccess={setSuccess}/>:null}
 {item.kind==="polls"?<div className="ops-poll">{item.choices.map((choice,i)=>{const votes=item.responses.filter(x=>x===i).length;return <button type="button" key={i} disabled={busy||item.status!=="Open"} onClick={()=>respond(item.id,i)}><span>{choice}</span><small>{votes} local response{votes===1?"":"s"}</small><div className="ops-poll-bar" style={{width:(item.responses.length?votes/item.responses.length*100:0)+"%"}}/></button>})}<p>Responses are not attributable to verified people. Duplicate responses from one browser are allowed. Not for statutory elections.</p></div>:null}
 <div className="ops-record-footer"><span><LockKeyhole size={13}/> Encrypted · {new Date(item.createdAt).toLocaleString()}</span><span>Unverified local record</span></div>
 </article>)}</div>}
 </>}</section></div>
 <div className="ops-audit"><div className="ops-audit-head"><h3><FileText size={18}/> Workspace activity</h3><span>{workspace.events.length} linked local events</span></div>{workspace.events.length?workspace.events.slice(-8).reverse().map(e=><div key={e.id}><b>{e.action} · {e.kind}</b><span>{e.details}</span><time>{new Date(e.when).toLocaleString()}</time></div>):<p>No changes have been recorded yet.</p>}<p>This event chain detects some local edits. It is not externally anchored or independently authenticated.</p></div>
 </>}
 {error?<div className="ops-feedback error" role="alert"><AlertTriangle size={17}/>{error}</div>:null}
 {success?<div className="ops-feedback success" role="status"><CheckCircle2 size={17}/>{success}</div>:null}
 </div>;
}
