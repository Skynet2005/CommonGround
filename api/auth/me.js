import {reply,failure,method,session,asActor,configured} from "../../server/core.js";
export default async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 if(!configured()||process.env.SHARED_BETA_ENABLED!=="true")return reply(res,200,{authenticated:false,mode:"local-only"});
 try{
  const actor=await session(req);
  if(!actor)return reply(res,200,{authenticated:false});
  const data=await asActor(actor,c=>c.query("SELECT id,email,display_name FROM app.accounts WHERE id=$1 AND disabled_at IS NULL",[actor]));
  return reply(res,200,{authenticated:!!data.rowCount,user:data.rows[0]||null});
 }catch(e){return failure(res,e)}
}