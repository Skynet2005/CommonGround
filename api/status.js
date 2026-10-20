import {configured,mailConfigured,db,reply,method} from "../server/core.js";
import {collaborationReady} from "../server/collaboration.js";
export default async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 const enabled=configured()&&mailConfigured()&&process.env.SHARED_BETA_ENABLED==="true";
 if(!enabled)return reply(res,200,{service:"CommonGround",mode:"local-only",sharedEnabled:false,databaseReady:false,secureUploadReady:false,collaborationEnabled:false});
 try{
  const p=await db();await p.query("SELECT 1");
  let collaborationEnabled=false;
  if(collaborationReady()){
   const r=await p.query("SELECT (to_regclass('app.case_room_notes') IS NOT NULL AND COALESCE(has_table_privilege(current_user,to_regclass('app.case_room_notes'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('app.case_room_notes'),'INSERT'),false) AND COALESCE(has_function_privilege(current_user,to_regprocedure('app.case_accept_invite(text)'),'EXECUTE'),false)) AS ready");
   collaborationEnabled=!!r.rows[0]?.ready;
  }
  return reply(res,200,{service:"CommonGround",mode:"private-beta",sharedEnabled:true,databaseReady:true,secureUploadReady:false,collaborationEnabled});
 }catch{return reply(res,503,{service:"CommonGround",mode:"unavailable",sharedEnabled:false,databaseReady:false,secureUploadReady:false,collaborationEnabled:false})}
}
