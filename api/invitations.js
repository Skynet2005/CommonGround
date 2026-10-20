import {reply,failure,method,requireJSON,sameOrigin,session,asActor,uuid,randomToken,digestToken,validEmail,safeOrigin} from "../server/core.js";
import {collabGate} from "../server/collaboration.js";

export default async function handler(req,res){
 if(!method(req,res,["GET","POST"])||!collabGate(res))return;
 if(req.method==="POST"&&!sameOrigin(req))return reply(res,403,{error:"Invalid request origin"});
 try{
  const actor=await session(req);
  if(!actor)return reply(res,401,{error:"Verified-email sign-in required"});
  if(req.method==="GET"){
   if(!uuid(req.query?.caseId))return reply(res,400,{error:"Invalid case"});
   const r=await asActor(actor,c=>c.query("SELECT * FROM app.case_pending_invites($1)",[req.query.caseId]));
   return reply(res,200,{pending:r.rows});
  }
  const data=requireJSON(req,3000);
  if(data.action==="accept"){
   if(typeof data.token!=="string"||!/^[A-Za-z0-9_-]{40,100}$/.test(data.token))return reply(res,400,{error:"Invalid invitation"});
   const r=await asActor(actor,c=>c.query("SELECT * FROM app.case_accept_invite($1)",[digestToken(data.token)]));
   return r.rowCount?reply(res,200,{accepted:true,caseId:r.rows[0].accepted_case_id,verifiedAuthority:false}):
    reply(res,403,{error:"Invitation invalid, expired, revoked, or intended for another verified email"});
  }
  if(data.action==="cancel"){
   if(!uuid(data.inviteId))return reply(res,400,{error:"Invalid invitation ID"});
   const r=await asActor(actor,c=>c.query("SELECT app.case_cancel_invite($1) AS ok",[data.inviteId]));
   return reply(res,r.rows[0]?.ok?200:404,{canceled:!!r.rows[0]?.ok});
  }
  if(data.action==="revoke"){
   if(!uuid(data.caseId)||!uuid(data.memberId))return reply(res,400,{error:"Invalid case or member"});
   const r=await asActor(actor,c=>c.query("SELECT app.case_revoke_participant($1,$2) AS ok",[data.caseId,data.memberId]));
   return reply(res,200,{revoked:!!r.rows[0]?.ok});
  }
  if(data.action!=="invite"||!uuid(data.caseId))return reply(res,400,{error:"Unsupported invitation request"});
  const email=validEmail(data.email);
  if(!email)return reply(res,400,{error:"Invalid email"});
  const token=randomToken(),hash=digestToken(token);
  const r=await asActor(actor,c=>c.query("SELECT app.case_issue_invite($1,$2,$3,$4) AS id",
    [data.caseId,email,hash,digestToken("recipient:"+email)]));
  const inviteId=r.rows[0]?.id;
  const link=new URL(safeOrigin(req));link.hash="invite_code="+encodeURIComponent(token);
  try{
   const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{
    Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:"CommonGround case room invitation",
      text:"Open this private invitation after signing in with this email:\n"+link.toString()+
      "\n\nAccepting shares your email with other room participants. This is NOT proof of HOA authority or property ownership. Expires in 48 hours."}),
    signal:AbortSignal.timeout(8000)});
   if(!sent.ok)throw Error("Mail delivery failed");
  }catch{
   await asActor(actor,c=>c.query("SELECT app.case_cancel_invite($1)",[inviteId])).catch(()=>{});
   return reply(res,503,{error:"Invitation email delivery could not be confirmed"});
  }
  return reply(res,202,{sent:true,inviteId});
 }catch(e){return failure(res,e)}
}
