import {reply,failure,method,requireJSON,sameOrigin,session,asActor,uuid,stringField,sha,configured} from "../server/core.js";
const validCategory=new Set(["Architectural","Enforcement","Financial","Records","Elections","Maintenance","Governance","Other"]);
function allowed(){return configured()&&process.env.SHARED_BETA_ENABLED==="true"}
async function event(client,{caseId,actor,version,type,note,changes}){
 const latest=await client.query("SELECT digest FROM app.case_events WHERE case_id=$1 ORDER BY case_version DESC LIMIT 1",[caseId]);
 const prev=latest.rows[0]?.digest||"GENESIS";
 const payload=JSON.stringify({caseId,actor,version,type,note,changes,prev});
 const digest=sha(payload);
 await client.query(`INSERT INTO app.case_events(case_id,actor_id,event_type,public_note,changes,previous_digest,digest,case_version)
 VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,[caseId,actor,type,note,JSON.stringify(changes),prev,digest,version]);
}
export default async function handler(req,res){
 if(!method(req,res,["GET","POST","PATCH"]))return;
 if(!allowed())return reply(res,503,{error:"Shared database is not enabled. Use the local workspace."});
 if(req.method!=="GET"&&!sameOrigin(req))return reply(res,403,{error:"Request origin not permitted"});
 try{
  const actor=await session(req);
  if(!actor)return reply(res,401,{error:"Authentication required"});
  if(req.method==="GET"){
   const result=await asActor(actor,client=>client.query(`SELECT id,created_by,title,category,status,summary,rule_reference,evidence_summary,
    proposed_resolution,created_at,updated_at,version FROM app.cases
    WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`));
   return reply(res,200,{cases:result.rows});
  }
  const data=requireJSON(req);
  if(req.method==="POST"){
   const title=stringField(data.title,180);
   const category=stringField(data.category,40);
   const summary=stringField(data.summary||"");
   if(title.length<3||!validCategory.has(category))return reply(res,400,{error:"Invalid title or category"});
   const output=await asActor(actor,async client=>{
    const result=await client.query(`INSERT INTO app.cases(created_by,title,category,summary)
    VALUES($1,$2,$3,$4) RETURNING id,title,category,status,created_at,version`,[actor,title,category,summary]);
    await event(client,{caseId:result.rows[0].id,actor,version:1,type:"Case opened",note:"Created in authenticated workspace",changes:{title:{from:null,to:title}}});
    return result.rows[0];
   });
   return reply(res,201,{case:output});
  }
  if(!uuid(data.id))return reply(res,400,{error:"Invalid case id"});
  if(!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<1)return reply(res,400,{error:"Expected case version required"});
  const props=["title","summary","rule_reference","evidence_summary","proposed_resolution"];
  const patch={};
  for(const k of props){if(data[k]!==undefined)patch[k]=stringField(data[k],k==="title"?180:12000)}
  if(data.category!==undefined){const cat=stringField(data.category,50);if(!validCategory.has(cat))return reply(res,400,{error:"Invalid category"});patch.category=cat}
  const states=new Set(["draft","shared","in_review","in_discussion","resolved","closed"]);
  if(data.status!==undefined){if(!states.has(data.status))return reply(res,400,{error:"Invalid status"});patch.status=data.status}
  if(data.response_opportunity!==undefined){if(typeof data.response_opportunity!=="boolean")return reply(res,400,{error:"Invalid response flag"});patch.response_opportunity=data.response_opportunity}
  if(data.independent_review_considered!==undefined){if(typeof data.independent_review_considered!=="boolean")return reply(res,400,{error:"Invalid review flag"});patch.independent_review_considered=data.independent_review_considered}
  if(!Object.keys(patch).length)return reply(res,400,{error:"No changes"});
  if(patch.title!==undefined&&patch.title.length<3)return reply(res,400,{error:"Title too short"});
  const result=await asActor(actor,async client=>{
   const found=await client.query("SELECT * FROM app.cases WHERE id=$1 AND created_by=$2 AND deleted_at IS NULL FOR UPDATE",[data.id,actor]);
   if(!found.rowCount)return null;
   const before=found.rows[0];
   if(before.version!==data.expectedVersion)throw Object.assign(new Error("Case changed in another session. Reload before editing."),{status:409});
   const diff={};
   for(const [key,to] of Object.entries(patch)){if(to!==before[key])diff[key]={from:before[key],to}}
   if(!Object.keys(diff).length)return {case:before,unchanged:true};
   const version=before.version+1;
   const fields=Object.keys(diff),values=fields.map(key=>patch[key]);
   const assignments=fields.map((key,i)=>'"'+key+'"=$'+(i+1)).join(", ");
   const upd=await client.query(`UPDATE app.cases SET ${assignments},version=$${fields.length+1},updated_at=now()
    WHERE id=$${fields.length+2} RETURNING *`,[...values,version,data.id]);
   await event(client,{caseId:data.id,actor,version,type:"Case updated",note:"Authenticated revision",changes:diff});
   return {case:upd.rows[0],unchanged:false};
  });
  if(!result)return reply(res,404,{error:"Case not found"});
  return reply(res,200,result);
 }catch(e){return failure(res,e)}
}