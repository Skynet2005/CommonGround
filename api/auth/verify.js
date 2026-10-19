import {db,reply,failure,method,requireJSON,sameOrigin,digestToken,randomToken,setSessionCookie,configured,mailConfigured} from "../../server/core.js";
export default async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  if(!configured()||!mailConfigured()||process.env.SHARED_BETA_ENABLED!=="true")return reply(res,503,{error:"Shared accounts are not enabled"});
  if(!sameOrigin(req))return reply(res,403,{error:"Request origin not permitted"});
  const token=requireJSON(req,2000).token;
  if(typeof token!=="string"||!(/^[A-Za-z0-9_-]{40,100}$/.test(token)))return reply(res,400,{error:"Invalid sign-in link"});
  const sessionToken=randomToken();
  const p=await db();
  const result=await p.query("SELECT * FROM app.auth_accept_link($1,$2)",[digestToken(token),digestToken(sessionToken)]);
  if(!result.rows.length)return reply(res,401,{error:"Link expired or already used"});
  setSessionCookie(res,sessionToken);
  return reply(res,200,{authenticated:true,email:result.rows[0].verified_email});
 }catch(e){return failure(res,e)}
}