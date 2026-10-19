import {reply,failure,method,cookie,digestToken,db,clearSessionCookie,sameOrigin,configured} from "../../server/core.js";
export default async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  if(!configured()||process.env.SHARED_BETA_ENABLED!=="true"){
   clearSessionCookie(res);
   return reply(res,200,{authenticated:false,mode:"local-only"});
  }
  if(!sameOrigin(req))return reply(res,403,{error:"Request origin not permitted"});
  if(configured()){
   const token=cookie(req,"cg_session");
   if(token&&token.length<=128){const p=await db();await p.query("SELECT app.auth_revoke_session($1)",[digestToken(token)])}
  }
  clearSessionCookie(res);
  return reply(res,200,{authenticated:false});
 }catch(e){clearSessionCookie(res);return failure(res,e)}
}