
import React,{useEffect,useRef,useState} from "react";
import {LockKeyhole,Upload,Download,Trash2,ShieldCheck,FileText,EyeOff,Eye,AlertTriangle,Info,FolderLock,RefreshCw,CheckCircle2} from "lucide-react";
import {addEvidence,listEvidence,retrieveEvidence,removeEvidence,downloadEvidence,VAULT_NOTICE,MAX_FILE_BYTES,exportEncryptedVaultBackup,restoreEncryptedVaultBackup} from "./vault.js";

function fmt(bytes){return bytes>=1024*1024?(bytes/1024/1024).toFixed(2)+" MB":Math.ceil(bytes/1024)+" KB";}
export default function VaultView({caseId,compact=false,cases=[]}){
 const [rows,setRows]=useState([]);
 const [targetCase,setTargetCase]=useState(caseId||"unassigned");
 const [phrase,setPhrase]=useState("");
 const [show,setShow]=useState(false);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const picker=useRef(null);
 const importPicker=useRef(null);
 useEffect(()=>{if(caseId)setTargetCase(caseId)},[caseId]);
 async function refresh(){try{setRows(await listEvidence(caseId||undefined));setError("")}catch(e){setError(e.message)}}
 useEffect(()=>{refresh()},[caseId]);
 const choose=async e=>{
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  setError("");setMessage("");
  if(phrase.length<12){setError("Enter a passphrase of at least 12 characters before selecting a file.");return;}
  if(file.size>MAX_FILE_BYTES){setError("The maximum file size is 8 MB.");return;}
  setBusy("upload");
  try{
   await addEvidence(file,phrase,caseId||targetCase);
   await refresh();
   setMessage("File encrypted and saved on this device. It has not been shared or authenticated.");
  }catch(err){setError(err.message)}finally{setBusy("")}
 };
 async function download(row){
  if(phrase.length<12){setError("Enter the passphrase used to encrypt the file.");return;}
  setBusy(row.id);setError("");setMessage("");
  try{
   const file=await retrieveEvidence(row.id,phrase);
   downloadEvidence(file);
   setMessage("Evidence decrypted locally and SHA-256 checked before download.");
  }catch(err){setError(err.message)}finally{setBusy("")}
 }
 async function backup(){setBusy("backup");setError("");try{const count=await exportEncryptedVaultBackup();setMessage("Encrypted backup exported with "+count+" item(s). Keep the backup and passphrase in different safe places.");}catch(e){setError(e.message)}finally{setBusy("")}}
 async function restore(e){const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!confirm("Import ciphertext from this encrypted vault backup? These files will be added on this device; existing files remain."))return;setBusy("restore");setError("");try{const count=await restoreEncryptedVaultBackup(file);await refresh();setMessage(count+" encrypted item(s) restored. Decryption still requires their original passphrases.");}catch(err){setError(err.message)}finally{setBusy("")}}
 async function remove(row){
  if(!confirm("Permanently delete this local encrypted evidence file? This cannot be undone."))return;
  setBusy(row.id);setError("");
  try{await removeEvidence(row.id);await refresh();setMessage("Encrypted file deleted from this browser.")}catch(err){setError(err.message)}finally{setBusy("")}
 }
 return <div className={compact?"vault-inline":"vault-screen"}>
  {!compact?<div className="section-head"><div><div className="eyebrow">ENCRYPTED EVIDENCE</div><h2>Protect the record, not the secrecy.</h2><p>Store photographs, correspondence and documents under local authenticated encryption. Only you hold the passphrase.</p></div></div>:null}
  <div className="vault-info"><span className="vault-icon-large"><FolderLock size={27}/></span><div><h3>Private on-device vault</h3><p>{VAULT_NOTICE}</p></div><span className="vault-badge"><LockKeyhole size={14}/> AES-256-GCM</span></div>
  <div className="vault-grid">
   <div className="panel padded">
    <h3>Encrypt a document</h3>
    <p className="muted">Your browser encrypts file contents and filenames before storing them in IndexedDB. Nothing is uploaded to our servers.</p>
    {!caseId?<div className="field"><label className="field-label" htmlFor="vault-case">Link to a case</label><select id="vault-case" value={targetCase} onChange={e=>setTargetCase(e.target.value)}><option value="unassigned">Unassigned</option>{cases.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></div>:null}
    <div className="field">
      <label htmlFor={compact?"vault-pass-case":"vault-pass-all"} className="field-label">Evidence passphrase (minimum 12 characters)</label>
      <div className="vault-pass">
       <input id={compact?"vault-pass-case":"vault-pass-all"} type={show?"text":"password"} autoComplete="off" spellCheck="false" value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="Your private encryption passphrase"/>
       <button aria-label={show?"Hide passphrase":"Show passphrase"} type="button" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button>
      </div>
    </div>
    <button className="btn" disabled={!!busy||phrase.length<12} onClick={()=>picker.current?.click()}><Upload size={16}/>{busy==="upload"?"Encrypting…":"Choose file to encrypt"}</button>
    <input ref={picker} type="file" style={{display:"none"}} onChange={choose} />
    <p className="vault-foot">Up to 8 MB per file. Different files may use different passphrases. Passphrases are never saved. Encryption cannot confirm that the file is authentic.</p>{!compact?<div className="vault-backup"><strong>Encrypted backups</strong><p>Export ciphertext for safekeeping or restore a previously exported vault. Your backup does not contain a passphrase.</p><div><button className="btn outline" disabled={!!busy} onClick={backup}><Download size={15}/> Export vault backup</button><button className="btn outline" disabled={!!busy} onClick={()=>importPicker.current?.click()}><Upload size={15}/> Restore backup</button></div><input ref={importPicker} type="file" accept=".json,application/json" hidden onChange={restore}/></div>:null}
    {error?<div className="vault-feedback error" role="alert"><AlertTriangle size={17}/>{error}</div>:null}
    {message?<div className="vault-feedback success" role="status"><CheckCircle2 size={17}/>{message}</div>:null}
   </div>
   <div className="panel padded">
     <div className="panel-heading" style={{padding:"0 0 16px"}}><div><h3>Encrypted items</h3><p>{rows.length} document(s) saved locally</p></div><button className="icon-button" onClick={refresh} title="Refresh evidence list" aria-label="Refresh"><RefreshCw size={17}/></button></div>
     {rows.length?rows.map((row,i)=><div className="vault-file" key={row.id}><span className="vault-file-icon"><LockKeyhole size={19}/></span><div className="vault-file-info"><b>Sealed evidence #{rows.length-i}</b><small>{fmt(row.size)} · {new Date(row.createdAt).toLocaleDateString()} · {caseId?"Linked to current case":row.caseId==="unassigned"?"Unassigned":cases.find(c=>c.id===row.caseId)?.title||"Case reference"}</small></div><button className="icon-button" aria-label="Decrypt and download file" title="Decrypt and download" disabled={!!busy} onClick={()=>download(row)}><Download size={17}/></button><button className="icon-button danger" aria-label="Delete encrypted file" title="Delete encrypted file" disabled={!!busy} onClick={()=>remove(row)}><Trash2 size={17}/></button></div>):<div className="empty"><span className="empty-icon"><LockKeyhole size={24}/></span><h3>No encrypted evidence yet</h3><p>Files added here remain on this device until you delete them or clear browser data.</p></div>}
     <div className="notice-box" style={{margin:"15px 0 0"}}><Info size={16}/><span>The visible list does not expose filenames. File integrity is checked when you decrypt it. Local storage is not an independently preserved audit archive.</span></div>
   </div>
  </div>
 </div>
}
