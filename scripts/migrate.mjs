
import pg from "pg";
import {readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
const url=process.env.DATABASE_MIGRATION_URL;
if(!url){console.error("DATABASE_MIGRATION_URL is required; no database modified.");process.exit(1);}
const dirname=path.dirname(fileURLToPath(import.meta.url));
const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:6000});
const client=await pool.connect();
try{
 const role=await client.query("SELECT current_user,rolbypassrls FROM pg_roles WHERE rolname=current_user");
 if(role.rows[0]?.current_user==="commonground_runtime"){throw Error("Refusing to run migrations with runtime credentials");}
 await client.query("SELECT pg_advisory_lock(177201)"); 
 await client.query(`CREATE TABLE IF NOT EXISTS public.commonground_schema_migrations
 (filename text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`);
 const directory=path.resolve(dirname,"../migrations");
 const names=(await readdir(directory)).filter(n=>/^[0-9]{4}_[\w-]+\.sql$/.test(n)).sort();
 for(const filename of names){
  const content=await readFile(path.join(directory,filename),"utf8");
  const sha256=createHash("sha256").update(content).digest("hex");
  const existing=await client.query("SELECT sha256 FROM public.commonground_schema_migrations WHERE filename=$1",[filename]);
  if(existing.rows.length){
   if(existing.rows[0].sha256!==sha256)throw Error("Refusing modified applied migration: "+filename);
   console.log("Already applied",filename);continue;
  }
  // Migration files enclose their statements in BEGIN/COMMIT. Never silently
  // mark a migration applied when its own transaction has failed.
  console.log("Applying",filename);
  try{
   const m=content.match(/^\s*(?:(?:--[^\n]*\n)\s*)*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/i);
   if(!m)throw Error("Migration lacks transaction wrapper: "+filename);
   await client.query("BEGIN");
   await client.query(m[1]);
   await client.query("INSERT INTO public.commonground_schema_migrations(filename,sha256) VALUES($1,$2)",[filename,sha256]);
   await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}
 }
 console.log("Schema migration check complete");
}finally{await client.query("SELECT pg_advisory_unlock(177201)").catch(()=>{});client.release();await pool.end();}
