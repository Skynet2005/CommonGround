import {reply,failure,method,requireJSON,sameOrigin,session,asActor,uuid,stringField,sha,configured} from "../server/core.js";
export default async function handler(req,res){
 if(!method(req,res,["GET","POST"]))return;
 if(!configured()||process.env.SHARED_BETA_ENABLED!=="true")return reply(res,503,{error:"Shared case records are not enabled"});
 if(req.method==="POST"&&!sameOrigin(req))return reply(res,403,{error:"Request origin not permitted"});
 try{
  const actor=await session(req);if(!actor)return reply(res,401,{error:"Authentication required"});
  if(req.method==="GET"){
   const id=req.query?.id;if(!uuid(id))return reply(res,400,{error:"Invalid case id"});
   const out=await asActor(actor,c=>c.query("SELECT id,event_type,public_note,changes,case_version,created_at,digest,previous_digest FROM app.case_events WHERE case_id=$1 ORDER BY case_version ASC",[id]));
   return reply(res,200,{events:out.rows});
  }
  const data=requireJSON(req,16000);
  if(!uuid(data.id))return reply(res,400,{error:"Invalid case id"});
  if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<1)return reply(res,400,{error:"Expected case version required"});
  const type=stringField(data.type||"Activity noted",70),note=stringField(data.note||"",12000);
  if(note.length<3)return reply(res,400,{error:"Provide a meaningful note"});
  const result=await asActor(actor,async client=>{
   const found=await client.query("SELECT id,version FROM app.cases WHERE id=$1 AND created_by=$2 AND deleted_at IS NULL FOR UPDATE",[data.id,actor]);
   if(!found.rowCount)return null;
   if(found.rows[0].version!==data.expectedVersion)throw Object.assign(new Error("Case changed in another session. Reload before adding activity."),{status:409});
   const version=found.rows[0].version+1;
   const last=await client.query("SELECT digest FROM app.case_events WHERE case_id=$1 ORDER BY case_version DESC LIMIT 1",[data.id]);
   const prev=last.rows[0]?.digest||"GENESIS";
   const digest=sha(JSON.stringify({caseId:data.id,actor,version,type,note,changes:{},prev}));
   await client.query("UPDATE app.cases SET version=$2,updated_at=now() WHERE id=$1",[data.id,version]);
   await client.query(`INSERT INTO app.case_events(case_id,actor_id,event_type,public_note,changes,previous_digest,digest,case_version)
     VALUES($1,$2,$3,$4,'{}'::jsonb,$5,$6,$7)`,[data.id,actor,type,note,prev,digest,version]);
   return {version,digest};
  });
  if(!result)return reply(res,404,{error:"Case not found"});
  return reply(res,201,{event:result});
 }catch(e){return failure(res,e)}
}