import React,{useEffect,useState} from "react";
import {Users,Send,Mail,ShieldCheck,LockKeyhole,CheckCircle2,AlertTriangle,RefreshCw,UserX,FileCheck2,Info} from "lucide-react";
import "./case-room.css";

async function api(path,options={}){
 const r=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,
 headers:{"Content-Type":"application/json",...(options.headers||{})}});
 const json=await r.json().catch(()=>({error:"Unexpected response"}));
 if(!r.ok)throw Error(json.error||"Case-room request failed");
 return json;
}
function post(path,body){return api(path,{method:"POST",body:JSON.stringify(body)})}
export default function CaseRoom({caseId,viewerId,creatorId}){
 const [room,setRoom]=useState(null),[pending,setPending]=useState([]),[email,setEmail]=useState("");
 const [statement,setStatement]=useState(""),[visibility,setVisibility]=useState("shared"),[ref,setRef]=useState("");
 const [error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false);
 const owner=viewerId===creatorId;
 async function refresh(){
  const result=await api("/api/room?caseId="+encodeURIComponent(caseId));
  setRoom(result);
  if(owner){const p=await api("/api/invitations?caseId="+encodeURIComponent(caseId));setPending(p.pending||[])}
  else setPending([]);
 }
 useEffect(()=>{let live=true;setRoom(null);setError("");setPending([]);
  api("/api/room?caseId="+encodeURIComponent(caseId)).then(r=>{if(live)setRoom(r)}).catch(e=>{if(live)setError(e.message)});
  if(owner)api("/api/invitations?caseId="+encodeURIComponent(caseId)).then(r=>{if(live)setPending(r.pending||[])}).catch(e=>{if(live)setError(e.message)});
  return ()=>{live=false};
 },[caseId,owner]);
 async function run(work,successText){
  if(busy)return;setBusy(true);setError("");setSuccess("");
  try{await work();await refresh();setSuccess(successText)}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const members=room?.members||[];
 const memberName=(id)=>members.find(x=>x.member_id===id)?.member_email||"Former participant";
 async function invite(e){e.preventDefault();await run(async()=>{
  await post("/api/invitations",{action:"invite",caseId,email});
  setEmail("");
 },"Invitation email sent. No access until accepted by the intended verified mailbox.")}
 async function cancel(inviteId){await run(()=>post("/api/invitations",{action:"cancel",inviteId}),"Invitation canceled.")}
 async function revoke(memberId){
  if(!confirm("Remove this guest's future access to this case? Previously seen information cannot be recalled."))return;
  await run(()=>post("/api/invitations",{action:"revoke",caseId,memberId}),"Guest access revoked.");
 }
 async function send(e){e.preventDefault();
  if(visibility==="shared"&&!confirm("Share this statement with ALL currently accepted room members? This is not end-to-end encrypted."))return;
  await run(async()=>{
   await post("/api/room",{action:"note",caseId,visibility,statement,evidenceReference:ref});
   setStatement("");setRef("");
  },visibility==="shared"?"Statement shared with current room members.":"Private author-only note recorded.");
 }
 const acknowledged=new Set((room?.receipts||[]).filter(r=>r.acknowledged_by===viewerId).map(r=>r.note_id));
 async function ack(noteId){await run(()=>post("/api/room",{action:"acknowledge",caseId,noteId}),"You acknowledged receipt of the selected statement, not its truth or legal validity.")}
 return <section className="cg-room">
  <div className="cg-room-header"><div><span className="eyebrow">PRIVATE BETA · CASE-SCOPED ACCESS</span><h3><Users size={20}/> Shared case room</h3><p>Verified-email participation, written positions and consent-based receipt acknowledgments. No proof of association authority or property ownership.</p></div><button className="btn outline" onClick={()=>run(()=>Promise.resolve(),"Case room refreshed.")} disabled={busy}><RefreshCw size={14}/> Refresh</button></div>
  <div className="cg-room-warning"><LockKeyhole size={18}/><span><b>Before sharing:</b> statements are stored in the hosted case database, not end-to-end encrypted. Other accepted members can read shared notes, including members invited later. Do not put confidential mediation, privileged advice, financial credentials or private identity documents here.</span></div>
  {!room?<p className="muted">Loading case permissions…</p>:<>
   <div className="cg-room-columns">
    <div className="cg-room-side">
     <h4>Accepted members ({members.length})</h4>
     {members.map(m=><div className="cg-room-member" key={m.member_id}><div><b>{m.member_email}</b><small>{m.member_role==="case_owner"?"Case creator":"Verified mailbox · case guest (unverified authority)"}</small></div>{owner&&m.member_id!==viewerId?<button type="button" disabled={busy} onClick={()=>revoke(m.member_id)} title="Remove future access"><UserX size={16}/></button>:null}</div>)}
     {owner?<><form onSubmit={invite} className="cg-room-invite"><h4><Mail size={16}/> Invite a participant</h4><label>Email address<input type="email" placeholder="recipient@example.com" required maxLength="254" value={email} onChange={e=>setEmail(e.target.value)}/></label><p>One-time invitation to that mailbox, valid for 48 hours. Not a verification of legal capacity.</p><button type="submit" disabled={busy||!email} className="btn"><Mail size={14}/> Send invitation</button></form>
       <h4>Invitations awaiting acceptance</h4>{pending.length?pending.map(i=><div className="cg-room-member" key={i.invite_id}><div><b>{i.recipient_email}</b><small>Expires {new Date(i.expires_at).toLocaleString()}</small></div><button onClick={()=>cancel(i.invite_id)} disabled={busy} type="button" aria-label="Cancel invitation"><UserX size={16}/></button></div>):<p className="muted">No pending invitations.</p>}</>:null}
    </div>
    <div className="cg-room-main">
     <h4>Documented perspectives</h4><p className="cg-room-small">Shared notes are readable by all current guests. Private notes are readable only by their author, not by the case creator unless the creator wrote them. Entries cannot be silently edited or deleted.</p>
     {(room.notes||[]).length?room.notes.map(n=><article className="cg-room-note" key={n.id}><div className="cg-room-note-head"><strong>{memberName(n.author_id)}</strong><span>{n.visibility==="private"?"Private to author":"Shared with room"}</span></div><p>{n.statement}</p>{n.evidence_reference?<small>Evidence reference (not an uploaded file): {n.evidence_reference}</small>:null}
      <div className="cg-room-note-footer"><time>{new Date(n.created_at).toLocaleString()}</time>{n.visibility==="shared"?<span>{(room.receipts||[]).filter(r=>r.note_id===n.id).length} receipt acknowledgment(s)</span>:null}
       {n.visibility==="shared"&&n.author_id!==viewerId&&!acknowledged.has(n.id)?<button type="button" disabled={busy} onClick={()=>ack(n.id)}><FileCheck2 size={14}/> Acknowledge receipt</button>:null}
       {acknowledged.has(n.id)?<span><CheckCircle2 size={14}/> You acknowledged receipt</span>:null}
      </div>
     </article>):<p className="muted">No recorded positions in this room yet.</p>}
     <form onSubmit={send} className="cg-room-compose"><h4>Record a position</h4><label>Who can read this entry?<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="shared">Shared with current and future accepted guests</option><option value="private">Only me (private draft)</option></select></label><label>Statement<textarea required minLength="3" maxLength="5000" rows="4" value={statement} onChange={e=>setStatement(e.target.value)} placeholder="Record a factual position, disagreement, or observation. Avoid sensitive personal data."/></label><label>Evidence reference (optional, no file upload)<input maxLength="500" value={ref} onChange={e=>setRef(e.target.value)} placeholder="e.g. inspection report reference"/></label><button className="btn" disabled={busy||statement.trim().length<3} type="submit"><Send size={15}/> {visibility==="shared"?"Share statement":"Save private note"}</button></form>
    </div>
   </div>
   {(room.accessHistory||[]).length?<details className="cg-room-history"><summary>Access history ({room.accessHistory.length})</summary>{room.accessHistory.map((ev,i)=><p key={i}>{ev.event_type} · {new Date(ev.occurred_at).toLocaleString()} · {memberName(ev.actor_id)}</p>)}</details>:null}
  </>}
  {error?<p className="cg-room-error" role="alert"><AlertTriangle size={16}/>{error}</p>:null}
  {success?<p className="cg-room-success" role="status"><Info size={16}/>{success}</p>:null}
 </section>;
}
