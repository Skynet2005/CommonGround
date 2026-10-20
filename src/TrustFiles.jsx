import React,{useEffect,useRef,useState} from "react";
import {Download,Upload,FileText,LockKeyhole,AlertTriangle} from "lucide-react";
import {MAX_FILE_BYTES,addEvidence,listEvidence,retrieveEvidence,downloadEvidence} from "./vault.js";

// Attaches encrypted originals to a local record. Not an evidentiary attestation.
export default function TrustFiles({bucket,passphrase}){
 const [files,setFiles]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const picker=useRef(null);
 async function refresh(){try{setFiles(await listEvidence(bucket))}catch(e){setError(e.message)}}
 useEffect(()=>{refresh()},[bucket]);
 async function attach(e){
  const f=e.target.files?.[0];e.target.value="";
  if(!f)return;
  if(f.size<1||f.size>MAX_FILE_BYTES){setError("Files must be between 1 byte and 8 MB.");return}
  setBusy(true);setError("");
  try{await addEvidence(f,passphrase,bucket);await refresh()}
  catch(err){setError(err.message)}finally{setBusy(false)}
 }
 async function retrieve(file){
  setBusy(true);setError("");
  try{const value=await retrieveEvidence(file.id,passphrase);downloadEvidence(value)}
  catch(err){setError(err.message)}finally{setBusy(false)}
 }
 return <div className="trust-files"><div className="trust-file-heading"><span><LockKeyhole size={14}/> {files.length} encrypted local attachment{files.length===1?"":"s"}</span><button type="button" disabled={busy} onClick={()=>picker.current?.click()}><Upload size={14}/> Attach original</button><input hidden type="file" ref={picker} onChange={attach}/></div>
 {files.map(f=><div className="trust-file-row" key={f.id}><span><FileText size={13}/> Encrypted item · {Math.ceil(f.size/1024)} KB · {new Date(f.createdAt).toLocaleDateString()}</span><button type="button" disabled={busy} onClick={()=>retrieve(f)} aria-label="Decrypt and save local file"><Download size={15}/></button></div>)}
 {error?<p className="trust-file-error"><AlertTriangle size={13}/>{error}</p>:null}
 <small>File content and name are encrypted locally. Back up attachments separately from the Operations metadata. No source authenticity or independent custody is verified.</small>
 </div>;
}
