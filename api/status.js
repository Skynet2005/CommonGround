import {configured,mailConfigured,db,reply,method} from "../server/core.js";
export default async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 const enabled=configured()&&mailConfigured()&&process.env.SHARED_BETA_ENABLED==="true";
 if(!enabled)return reply(res,200,{service:"CommonGround",mode:"local-only",sharedEnabled:false,databaseReady:false,secureUploadReady:false});
 try{const p=await db();await p.query("SELECT 1");return reply(res,200,{service:"CommonGround",mode:"private-beta",sharedEnabled:true,databaseReady:true,secureUploadReady:false})}
 catch{return reply(res,503,{service:"CommonGround",mode:"unavailable",sharedEnabled:false,databaseReady:false,secureUploadReady:false})}
}