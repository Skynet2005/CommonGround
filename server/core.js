
import pg from "pg";
import {createHmac,randomBytes,createHash} from "node:crypto";

const {Pool}=pg;
let pool;
let safety;
export const RUNTIME_KEYS=["DATABASE_RUNTIME_URL","AUTH_TOKEN_PEPPER"];
export const EMAIL_KEYS=["RESEND_API_KEY","EMAIL_FROM","PUBLIC_ORIGIN"];
export function configured(){return RUNTIME_KEYS.every(x=>!!process.env[x]);}
export function mailConfigured(){return EMAIL_KEYS.every(x=>!!process.env[x]);}
export function randomToken(){return randomBytes(32).toString("base64url");}
export function digestToken(token){
 if(!process.env.AUTH_TOKEN_PEPPER)throw new Error("Authentication not configured");
 return createHmac("sha256",process.env.AUTH_TOKEN_PEPPER).update(String(token)).digest("hex");
}
export function sha(text){return createHash("sha256").update(text).digest("hex");}
export function safeOrigin(req){
 const origin=process.env.PUBLIC_ORIGIN;
 if(!origin)throw new Error("Origin not configured");
 const url=new URL(origin);
 if(url.protocol!=="https:" && !(url.protocol==="http:"&&url.hostname==="localhost"))throw new Error("Origin must be HTTPS");
 return url.origin;
}
export function sameOrigin(req){
 const expected=safeOrigin(req);
 const origin=req.headers.origin;
 if(origin) return origin===expected;
 const referer=req.headers.referer;
 if(referer){try{return new URL(referer).origin===expected}catch{return false}}
 // Machine/script callers need an explicit Origin (except approved server-to-server flows).
 return false;
}
export function requireJSON(req,maxBytes=32000){
 if(!String(req.headers["content-type"]||"").toLowerCase().startsWith("application/json"))throw Object.assign(new Error("JSON content required"),{status:415});
 if(Number(req.headers["content-length"]||0)>maxBytes)throw Object.assign(new Error("Payload too large"),{status:413});
 const val=req.body;
 if(!val||typeof val!=="object"||Array.isArray(val))throw Object.assign(new Error("Invalid JSON object"),{status:400});
 return val;
}
export function method(req,res,allowed){
 res.setHeader("Allow",allowed.join(", "));
 if(!allowed.includes(req.method)){reply(res,405,{error:"Method not allowed"});return false}
 return true;
}
export function secureHeaders(res){
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Referrer-Policy","no-referrer");
 res.setHeader("X-Frame-Options","DENY");
}
export function reply(res,status,data){
 secureHeaders(res);
 return res.status(status).json(data);
}
export function failure(res,error){
 const code=(error?.status && Number.isInteger(error.status) && error.status>=400&&error.status<500)?error.status:500;
 if(code===500)console.error("CommonGround request failed",error?.name||"Error"); // no sensitive payloads, email or tokens
 return reply(res,code,{error:code===500?"Internal service error":error.message});
}
export function assertConfigured(){
 if(!configured())throw Object.assign(new Error("Shared database and authentication are not connected"),{status:503});
}
export async function db(){
 assertConfigured();
 if(!pool){
  pool=new Pool({connectionString:process.env.DATABASE_RUNTIME_URL,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:20000,ssl:process.env.DATABASE_SSL==="disable"&&process.env.NODE_ENV!=="production"?false:{rejectUnauthorized:true}});
 }
 // Never let migration-owner credentials be used to serve application traffic.
 if(!safety){
  safety=(async()=>{
   const r=await pool.query(`SELECT current_user as role,rolsuper,rolbypassrls,
    (SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='app' AND c.relname='cases') as cases_owner
    FROM pg_roles WHERE rolname=current_user`);
   const row=r.rows[0];
   if(!row || row.rolsuper||row.rolbypassrls||row.role===row.cases_owner)
      throw new Error("Refusing to use an unsafe privileged database credential");
   return true;
  })().catch(e=>{safety=null;throw e});
 }
 await safety;
 return pool;
}
export async function asActor(actorId,action){
 const p=await db();const client=await p.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.actor_id',$1,true)",[actorId]);
  const result=await action(client);
  await client.query("COMMIT");
  return result;
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}finally{client.release()}
}
export function cookie(req,name){
 const raw=String(req.headers.cookie||"").split(";").map(s=>s.trim());
 const prefix=name+"=";
 const found=raw.find(x=>x.startsWith(prefix));
 return found?decodeURIComponent(found.slice(prefix.length)):"";
}
export async function session(req){
 const token=cookie(req,"cg_session");
 if(!token||token.length>128)return null;
 const p=await db();
 const result=await p.query("SELECT app.auth_session_account($1) AS actor",[digestToken(token)]);
 return result.rows[0]?.actor||null;
}
export function setSessionCookie(res,token,maxAge=60*60*24*14){
 const cookie=`cg_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
 res.setHeader("Set-Cookie",cookie);
}
export function clearSessionCookie(res){
 res.setHeader("Set-Cookie","cg_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}
export function validEmail(s){
 if(typeof s!=="string")return null;
 const email=s.trim().toLowerCase();
 return email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
export function stringField(v,max=12000){if(typeof v!=="string")throw Object.assign(new Error("Expected a text field"),{status:400});if(v.length>max)throw Object.assign(new Error("Text field too long"),{status:400});return v.trim()}
export function uuid(x){return typeof x==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x)}
export function fingerprint(req){
 const forwarded=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim().slice(0,100);
 const ua=String(req.headers["user-agent"]||"").slice(0,160);
 return digestToken("ip:"+forwarded+";ua:"+ua);
}
