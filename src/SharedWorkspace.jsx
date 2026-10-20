
import React,{useEffect,useMemo,useState} from "react";
import CaseRoom from "./CaseRoom.jsx";
import {Database,ShieldCheck,LockKeyhole,CloudOff,Mail,Plus,FolderOpen,ArrowRight,CheckCircle2,AlertTriangle,RefreshCw,BookOpen,UserCheck,Info,LogOut,Cloud,FileText} from "lucide-react";

async function request(path,options={}){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,
  headers:{"Content-Type":"application/json",...(options.headers||{})}});
 const data=await response.json().catch(()=>({error:"Unexpected response"}));
 if(!response.ok)throw Error(data.error||"Request failed");
 return data;
}
export default function SharedWorkspace(){
 const [status,setStatus]=useState(null),[me,setMe]=useState(null);
 const [email,setEmail]=useState(""),[title,setTitle]=useState(""),[category,setCategory]=useState("Architectural"),[summary,setSummary]=useState("");
 const [cases,setCases]=useState([]),[details,setDetails]=useState(null),[activity,setActivity]=useState([]),[note,setNote]=useState("");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [inviteToken,setInviteToken]=useState(()=>new URLSearchParams(window.location.hash.replace(/^#/,"")).get("invite_code")||"");
 const [consent,setConsent]=useState(false);
 async function refresh(){
  try{
   const check=await request("/api/status");
   setStatus(check);
   if(check.sharedEnabled){
    const user=await request("/api/auth/me");setMe(user);
    if(user.authenticated){const list=await request("/api/cases");setCases(list.cases);}
   }else{setMe(null);setCases([])}
  }catch(e){setStatus({mode:"unavailable",sharedEnabled:false});setNotice(e.message)}
 }
 useEffect(()=>{refresh();
  const params=new URLSearchParams(window.location.hash.replace(/^#/,""));
  const token=params.get("auth_code");
  if(!token)return;
  history.replaceState(null,"",window.location.pathname+window.location.search);
  (async()=>{
   setBusy(true);
   try{const confirmed=await request("/api/auth/verify",{method:"POST",body:JSON.stringify({token})});setNotice(confirmed.authenticated?"Signed in with one-time email link.":"Unable to sign in.");await refresh();}
   catch(e){setNotice(e.message)}finally{setBusy(false)}
  })();
 },[]);
 async function sendLink(e){e.preventDefault();setBusy(true);setNotice("");
  try{const data=await request("/api/auth/request",{method:"POST",body:JSON.stringify({email})});setNotice(data.message||"Check your email.")}catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function createCase(e){e.preventDefault();setBusy(true);setNotice("");
  try{const out=await request("/api/cases",{method:"POST",body:JSON.stringify({title,category,summary})});setTitle("");setSummary("");setNotice("Private authenticated case created.");await refresh();setDetails(out.case);setActivity([]);}
  catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function openCase(c){setDetails(c);setActivity([]);setNotice("");try{const data=await request("/api/events?id="+encodeURIComponent(c.id));setActivity(data.events)}catch(e){setNotice(e.message)}}
 async function addNote(e){e.preventDefault();if(!details||!note.trim())return;setBusy(true);
  try{await request("/api/events",{method:"POST",body:JSON.stringify({id:details.id,type:"Activity noted",note,expectedVersion:details.version})});setNote("");const [log,list]=await Promise.all([request("/api/events?id="+encodeURIComponent(details.id)),request("/api/cases")]);setActivity(log.events);setCases(list.cases);setDetails(list.cases.find(c=>c.id===details.id)||details);setNotice("Signed-in activity recorded in the database.")}
  catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function acceptInvitation(){
  if(!inviteToken||!consent)return;setBusy(true);setNotice("");
  try{
   const accepted=await request("/api/invitations",{method:"POST",body:JSON.stringify({action:"accept",token:inviteToken})});
   history.replaceState(null,"",window.location.pathname+window.location.search);
   setInviteToken("");setConsent(false);
   await refresh();
   const list=await request("/api/cases");const invited=list.cases.find(c=>c.id===accepted.caseId);
   if(invited)await openCase(invited);
   setNotice("Invitation accepted. Your email is visible to room members, but no HOA role was verified.");
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function logout(){setBusy(true);try{await request("/api/auth/logout",{method:"POST",body:"{}"});setMe(null);setCases([]);setDetails(null);setNotice("Signed out.")}catch(e){setNotice(e.message)}finally{setBusy(false)}}
 return <div className="shared-screen">
  <div className="section-head"><div><div className="eyebrow">SECURE COLLABORATION INFRASTRUCTURE</div><h2>One record. Clear ownership.</h2><p>The shared workspace uses verified email sessions and a separate PostgreSQL authorization layer when its private beta is enabled. Local cases are not automatically uploaded.</p></div><button className="btn outline" onClick={refresh}><RefreshCw size={15}/> Refresh status</button></div>
  {!status?<div className="shared-banner"><Database size={24}/> Checking backend availability…</div>:
  !status.sharedEnabled?<div className="shared-not-ready"><div className="shared-shield"><CloudOff size={28}/></div><div className="eyebrow">SECURE DEFAULT: SHARED ACCESS OFF</div><h2>Hosted cases are not yet enabled.</h2><p>The application deliberately refuses remote private-case operations until a dedicated nonprivileged PostgreSQL role, the email sign-in service, encryption and the reviewed beta controls are configured. Your existing browser-local workspace remains available.</p><div className="shared-status-grid"><div><Database size={17}/><b>PostgreSQL</b><small>Not connected</small></div><div><UserCheck size={17}/><b>Member identities</b><small>No verified enrollment</small></div><div><LockKeyhole size={17}/><b>Server custody</b><small>Not enabled</small></div></div><div className="shared-callout"><Info size={17}/> The complete schema and API implementation live in GitHub. A designed table or endpoint does not imply a live service or legal verification.</div></div>:
  !me?.authenticated?<div className="shared-signin panel padded"><span className="setting-icon"><Mail size={21}/></span><h3>Sign in to your private workspace</h3><p className="muted">An expiring one-time link is emailed to you. Signing in proves control of that mailbox, not HOA membership or property ownership.</p>{inviteToken?<p className="shared-invite-info">An invitation was opened for this browser. Sign in with the <b>same invited email address</b>, then reopen your invitation link to accept it. Acceptance does not verify HOA office or ownership.</p>:null}<form onSubmit={sendLink}><div className="field"><label className="field-label" htmlFor="shared-email">Email address</label><input type="email" id="shared-email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/></div><button className="btn" disabled={busy||!email} type="submit"><Mail size={16}/> Send secure link</button></form></div>:
  <div>{inviteToken&&status?.collaborationEnabled?<div className="shared-invite-consent panel padded"><h3>Accept case-room invitation</h3><p>The invitation must match your signed-in email. By accepting, you agree your verified mailbox address will be shown to other accepted room participants. Shared notes are not end-to-end encrypted.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I consent to join this case room and display my email address to its members.</label><button type="button" className="btn" disabled={busy||!consent} onClick={acceptInvitation}>Accept invitation</button></div>:null}<div className="shared-user"><div><CheckCircle2 size={18}/><span>Signed in as <b>{me.user?.email}</b></span></div><button className="btn outline" onClick={logout} disabled={busy}><LogOut size={15}/> Sign out</button></div>
   <div className="vault-grid"><div className="panel padded"><h3>New private case</h3><p className="muted">Private by default. If collaboration is enabled, the case creator may later invite a verified email address to participate.</p><form onSubmit={createCase}><div className="field"><label className="field-label" htmlFor="cloud-title">Title</label><input id="cloud-title" required minLength="3" maxLength="180" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Case title"/></div><div className="field"><label className="field-label" htmlFor="cloud-cat">Category</label><select id="cloud-cat" value={category} onChange={e=>setCategory(e.target.value)}>{["Architectural","Enforcement","Financial","Records","Elections","Maintenance","Governance","Other"].map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label className="field-label" htmlFor="cloud-summary">Summary (keep details redacted for beta)</label><textarea id="cloud-summary" rows="3" value={summary} onChange={e=>setSummary(e.target.value)}/></div><button className="btn" disabled={busy} type="submit"><Plus size={16}/> Create private case</button></form></div>
   <div className="panel padded"><h3>My hosted cases</h3><p className="muted">Database-backed records, not your browser-local examples.</p>{cases.length?cases.map(c=><button type="button" className="case-row" style={{padding:"14px 0"}} key={c.id} onClick={()=>openCase(c)}><span className="case-type"><FolderOpen size={17}/></span><span className="case-row-info"><b>{c.title}</b><small>{c.category} · {c.status}</small></span><ArrowRight size={15}/></button>):<div className="empty"><span className="empty-icon"><FolderOpen size={23}/></span><h3>No hosted cases</h3><p>Create a private case. Browser-local records are never auto-synced.</p></div>}</div></div>
   {details?<div className="panel padded shared-details"><div className="panel-heading" style={{padding:"0 0 18px"}}><div><h3>{details.title}</h3><p>Case history · secure server audit records</p></div><button className="icon-button" onClick={()=>setDetails(null)} aria-label="Close case details">✕</button></div>{activity.length?activity.map(ev=><div className="shared-event" key={ev.id}><b>{ev.event_type}</b><span>{new Date(ev.created_at).toLocaleString()}</span><p>{ev.public_note}</p></div>):<p className="muted">No activities loaded beyond case creation.</p>}{details.created_by===me.user?.id?<form onSubmit={addNote}><div className="field"><label className="field-label" htmlFor="cloud-note">Record a new activity</label><textarea id="cloud-note" rows="2" minLength="3" maxLength="12000" value={note} onChange={e=>setNote(e.target.value)} placeholder="A factual, redacted progress note"/></div><button type="submit" disabled={busy||!note.trim()} className="btn"><Plus size={15}/> Append event</button></form>:<p className="muted">Only the case creator may append case-history events. Guests can post attributed statements in the room below.</p>}{status?.collaborationEnabled?<CaseRoom key={details.id} caseId={details.id} viewerId={me.user?.id} creatorId={details.created_by}/>:<p className="muted">Multi-user case collaboration is not enabled on this deployment.</p>}</div>:null}
  </div>}
  {notice?<div className="vault-feedback success" role="status"><Info size={16}/>{notice}</div>:null}
 </div>;
}
