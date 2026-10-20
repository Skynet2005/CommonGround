import {reply,failure,method,requireJSON,sameOrigin,session,asActor,uuid,stringField} from "../server/core.js";
import {collabGate,caseRoomSafety} from "../server/collaboration.js";

export default async function handler(req,res){
 if(!method(req,res,["GET","POST"])||!collabGate(res))return;
 if(req.method==="POST"&&!sameOrigin(req))return reply(res,403,{error:"Invalid request origin"});
 try{
  const actor=await session(req);if(!actor)return reply(res,401,{error:"Sign-in required"});
  if(req.method==="GET"){
   const caseId=req.query?.caseId;if(!uuid(caseId))return reply(res,400,{error:"Invalid case ID"});
   const room=await asActor(actor,async c=>{
    const found=await c.query("SELECT id,title,category,status,created_by,version FROM app.cases WHERE id=$1 AND deleted_at IS NULL",[caseId]);
    if(!found.rowCount)return null;
    const notes=await c.query("SELECT id,author_id,visibility,statement,evidence_reference,created_at FROM app.case_room_notes WHERE case_id=$1 ORDER BY created_at,id LIMIT 500",[caseId]);
    const receipts=await c.query("SELECT note_id,acknowledged_by,acknowledged_at FROM app.case_room_receipts WHERE case_id=$1 ORDER BY acknowledged_at LIMIT 1500",[caseId]);
    const members=await c.query("SELECT * FROM app.case_room_members($1)",[caseId]);
    const history=await c.query("SELECT actor_id,event_type,subject_id,occurred_at FROM app.case_room_access_events WHERE case_id=$1 ORDER BY occurred_at DESC LIMIT 100",[caseId]);
    return {case:found.rows[0],notes:notes.rows,receipts:receipts.rows,members:members.rows,accessHistory:history.rows};
   });
   return room?reply(res,200,{...room,viewer:actor,safety:caseRoomSafety()}):
    reply(res,404,{error:"Case room not found or access revoked"});
  }
  const data=requireJSON(req,7500);
  if(!uuid(data.caseId))return reply(res,400,{error:"Invalid case ID"});
  if(data.action==="note"){
   const statement=stringField(data.statement,5000);
   const evidenceReference=stringField(data.evidenceReference||"",500);
   if(statement.length<3||!["shared","private"].includes(data.visibility))
    return reply(res,400,{error:"Invalid message or sharing scope"});
   const saved=await asActor(actor,c=>c.query("INSERT INTO app.case_room_notes(case_id,author_id,visibility,statement,evidence_reference) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at",[data.caseId,actor,data.visibility,statement,evidenceReference]));
   return reply(res,201,{created:true,note:saved.rows[0]});
  }
  if(data.action==="acknowledge"){
   if(!uuid(data.noteId))return reply(res,400,{error:"Invalid message ID"});
   const r=await asActor(actor,c=>c.query(
    "INSERT INTO app.case_room_receipts(note_id,case_id,acknowledged_by) SELECT id,case_id,$3 FROM app.case_room_notes WHERE id=$1 AND case_id=$2 AND visibility='shared' AND author_id<>$3 ON CONFLICT (note_id,acknowledged_by) DO NOTHING RETURNING id",
    [data.noteId,data.caseId,actor]));
   return reply(res,200,{acknowledged:!!r.rowCount});
  }
  return reply(res,400,{error:"Unsupported room action"});
 }catch(e){return failure(res,e)}
}
