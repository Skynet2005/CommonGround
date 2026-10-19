
// Local encrypted evidence vault. No bytes or passphrases are sent over the network.
// Authenticated encryption detects accidental or malicious ciphertext modification;
// it does NOT prove that an uploaded document was truthful or independently verified.
const DB_NAME="commonground-vault-v1";
const STORE="evidence";
const ITERATIONS=600000;
export const MAX_FILE_BYTES=8*1024*1024;
export const VAULT_NOTICE="Files are encrypted on this device only. Losing the passphrase or browser data can make them unrecoverable. This is not independently verified legal evidence custody.";
const enc=new TextEncoder(), dec=new TextDecoder();
function bytes(x){return x instanceof Uint8Array?x:new Uint8Array(x)}
function newSalt(n){return crypto.getRandomValues(new Uint8Array(n))}
function toHex(x){return [...new Uint8Array(x)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function requirePhrase(passphrase){if(typeof passphrase!=="string"||passphrase.length<12||passphrase.length>512)throw Error("Use a passphrase of at least 12 characters.");}
async function derive(passphrase,salt){
 requirePhrase(passphrase);
 const base=await crypto.subtle.importKey("raw",enc.encode(passphrase),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERATIONS,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
export async function sealEvidence(fileData,filename,mimeType,passphrase){
 const data=bytes(fileData);
 if(data.byteLength===0||data.byteLength>MAX_FILE_BYTES)throw Error("File must be between 1 byte and 8 MB.");
 if(!filename||filename.length>255)throw Error("File name must be between 1 and 255 characters.");
 const salt=newSalt(16),bodyIv=newSalt(12),metaIv=newSalt(12);
 const key=await derive(passphrase,salt);
 const digest=toHex(await crypto.subtle.digest("SHA-256",data));
 const meta=enc.encode(JSON.stringify({filename,mimeType:String(mimeType||"application/octet-stream").slice(0,150),sha256:digest}));
 const [body,header]=await Promise.all([
   crypto.subtle.encrypt({name:"AES-GCM",iv:bodyIv},key,data),
   crypto.subtle.encrypt({name:"AES-GCM",iv:metaIv},key,meta)
 ]);
 return {version:1,salt,bodyIv,metaIv,body:bytes(body),header:bytes(header),size:data.byteLength};
}
export async function openEvidence(record,passphrase){
 if(record?.version!==1)throw Error("Unsupported evidence format.");
 const key=await derive(passphrase,bytes(record.salt));
 try{
  const [plain,metadata]=await Promise.all([
   crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(record.bodyIv)},key,bytes(record.body)),
   crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(record.metaIv)},key,bytes(record.header))
  ]);
  const info=JSON.parse(dec.decode(metadata));
  const calculated=toHex(await crypto.subtle.digest("SHA-256",plain));
  if(calculated!==info.sha256)throw Error("Evidence integrity check failed.");
  return {data:bytes(plain),filename:info.filename,mimeType:info.mimeType,sha256:calculated};
 }catch{throw Error("Unable to decrypt or verify this item. Check the passphrase and the saved file.");}
}
function dbOpen(){
 if(typeof indexedDB==="undefined")return Promise.reject(Error("IndexedDB is unavailable in this browser."));
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:"id"});store.createIndex("caseId","caseId");}};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("Evidence database could not be opened."));
 });
}
async function transaction(mode,operation){
 const db=await dbOpen();
 try{return await new Promise((resolve,reject)=>{
   const t=db.transaction(STORE,mode);
   const store=t.objectStore(STORE);
   let result;
   const req=operation(store);
   req.onsuccess=()=>{result=req.result;};
   t.oncomplete=()=>resolve(result);
   t.onerror=()=>reject(t.error||Error("Evidence storage failed."));
   t.onabort=()=>reject(t.error||Error("Evidence storage was interrupted."));
 })}finally{db.close();}
}
export async function listEvidence(caseId){
 const rows=await transaction("readonly",store=>caseId?store.index("caseId").getAll(caseId):store.getAll());
 return rows.map(x=>({id:x.id,caseId:x.caseId,createdAt:x.createdAt,size:x.size})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function addEvidence(file,passphrase,caseId){
 if(!file || file.size>MAX_FILE_BYTES||file.size<1)throw Error("Choose a file from 1 byte to 8 MB.");
 const data=new Uint8Array(await file.arrayBuffer());
 const sealed=await sealEvidence(data,file.name,file.type,passphrase);
 const record={...sealed,id:crypto.randomUUID(),caseId:String(caseId||"unassigned").slice(0,160),createdAt:new Date().toISOString()};
 await transaction("readwrite",store=>store.put(record));
 return {id:record.id,size:record.size,createdAt:record.createdAt,caseId:record.caseId};
}
export async function retrieveEvidence(id,passphrase){
 const row=await transaction("readonly",store=>store.get(id));
 if(!row)throw Error("File not found on this device.");
 return openEvidence(row,passphrase);
}
export async function removeEvidence(id){await transaction("readwrite",store=>store.delete(id));}
export function downloadEvidence({filename,mimeType,data}){
 const safeName=String(filename||"evidence.bin").split(/[\\/]/).at(-1).replace(/[\u0000-\u001f]/g,"_")||"evidence.bin";
 const blob=new Blob([bytes(data)],{type:mimeType||"application/octet-stream"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=safeName;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}


// Portable backup of encrypted ciphertext. The backup never includes the passphrase,
// but visible timestamps and case IDs remain unencrypted metadata.
const ARRAY_KEYS=["salt","bodyIv","metaIv","body","header"];
function encodeB64(value){
 const x=bytes(value);let binary="";
 for(let i=0;i<x.length;i+=16384)binary+=String.fromCharCode(...x.subarray(i,i+16384));
 return btoa(binary);
}
function decodeB64(str){
 if(typeof str!=="string"||str.length>12*1024*1024)throw Error("Invalid encrypted item encoding.");
 const binary=atob(str);const out=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
 return out;
}
export function packEncryptedRecord(record){
 return {...record,...Object.fromEntries(ARRAY_KEYS.map(k=>[k,encodeB64(record[k])]))};
}
export function unpackEncryptedRecord(data){
 if(!data||data.version!==1||!Number.isInteger(data.size)||data.size<1||data.size>MAX_FILE_BYTES)throw Error("Unsupported encrypted record.");
 const record={...data,...Object.fromEntries(ARRAY_KEYS.map(k=>[k,decodeB64(data[k])]))};
 if(record.salt.length!==16||record.bodyIv.length!==12||record.metaIv.length!==12||record.body.length!==data.size+16||record.header.length<16||record.header.length>2000)throw Error("Invalid encrypted record dimensions.");
 if(typeof record.caseId!=="string"||record.caseId.length>160||typeof record.createdAt!=="string"||record.createdAt.length>70)throw Error("Invalid encrypted record metadata.");
 return {...record,id:crypto.randomUUID()};
}
export async function exportEncryptedVaultBackup(){
 const rows=await transaction("readonly",store=>store.getAll());
 if(rows.length>100||rows.reduce((sum,r)=>sum+r.size,0)>64*1024*1024)throw Error("Vault exceeds backup limit (100 files or 64 MB).");
 const body=JSON.stringify({format:"commonground-encrypted-vault-v1",exportedAt:new Date().toISOString(),items:rows.map(packEncryptedRecord)},null,2);
 const blob=new Blob([body],{type:"application/json"});
 const link=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=link;a.download="commonground-encrypted-vault.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(link),5000);
 return rows.length;
}
export async function restoreEncryptedVaultBackup(file){
 if(!file||file.size>95*1024*1024)throw Error("Encrypted backup exceeds 95 MB.");
 const raw=JSON.parse(await file.text());
 if(raw?.format!=="commonground-encrypted-vault-v1"||!Array.isArray(raw.items)||raw.items.length>100)throw Error("Not a supported encrypted vault backup.");
 let sum=0;
 const rows=raw.items.map(item=>{const record=unpackEncryptedRecord(item);sum+=record.size;return record;});
 if(sum>64*1024*1024)throw Error("Encrypted backup exceeds 64 MB.");
 for(const row of rows)await transaction("readwrite",store=>store.put(row));
 return rows.length;
}
