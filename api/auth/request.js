import {db,reply,failure,method,requireJSON,sameOrigin,validEmail,randomToken,digestToken,fingerprint,mailConfigured,safeOrigin,configured} from "../../server/core.js";
export default async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  if(!configured()||!mailConfigured()||process.env.SHARED_BETA_ENABLED!=="true")return reply(res,503,{error:"Shared accounts are not enabled"});
  if(!sameOrigin(req))return reply(res,403,{error:"Request origin not permitted"});
  const email=validEmail(requireJSON(req,2000).email);
  if(!email)return reply(res,400,{error:"Enter a valid email address"});
  const token=randomToken(),hash=digestToken(token),p=await db();
  const row=await p.query("SELECT app.auth_issue_link($1,$2,$3) AS id",[email,hash,fingerprint(req)]);
  const linkId=row.rows[0]?.id;
  const acknowledgement={message:"If allowed, a sign-in link will be sent."};
  if(!linkId)return reply(res,202,acknowledgement);
  const url=new URL(safeOrigin(req));url.hash="auth_code="+encodeURIComponent(token);
  try{
   const sent=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"Authorization":"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:"Your CommonGround sign-in link",
      text:"Use this private, one-time link to sign in to CommonGround. It expires in 15 minutes.\n\n"+url.toString()+"\n\nIf you didn't ask for it, ignore this email."}),
    signal:AbortSignal.timeout(8000)
   });
   if(!sent.ok)throw new Error("Email provider failed");
  }catch{
   await p.query("SELECT app.auth_cancel_link($1,$2)",[linkId,hash]).catch(()=>{});
   return reply(res,503,{error:"Sign-in email service is unavailable"});
  }
  return reply(res,202,{message:"If allowed, a sign-in link will be sent."});
 }catch(e){return failure(res,e)}
}