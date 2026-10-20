// Separate, tiny startup entry. If the main app fails to load, the page must
// still explain the failure rather than staying completely white.
const root=document.getElementById("root");

function launchFailure(error){
  console.error("CommonGround startup failed",error);
  if(!root)return;
  root.replaceChildren();
  const wrapper=document.createElement("main");
  Object.assign(wrapper.style,{maxWidth:"590px",margin:"12vh auto",padding:"32px",fontFamily:"system-ui, sans-serif",color:"#244455",lineHeight:"1.65"});
  const logo=document.createElement("div");
  logo.textContent="CommonGround";
  Object.assign(logo.style,{fontSize:"14px",fontWeight:"800",letterSpacing:".1em",color:"#278975"});
  const title=document.createElement("h1");
  title.textContent="We couldn't open your workspace.";
  Object.assign(title.style,{fontSize:"27px",margin:"16px 0"});
  const description=document.createElement("p");
  description.textContent="A startup error occurred. Your browser's existing workspace and encrypted files have not been automatically cleared. You can reload or export your browser-local case data before troubleshooting.";
  const actions=document.createElement("div");
  Object.assign(actions.style,{display:"flex",flexWrap:"wrap",gap:"12px",marginTop:"23px"});
  const reload=document.createElement("button");
  reload.type="button";
  reload.textContent="Retry loading";
  Object.assign(reload.style,{padding:"12px 16px",background:"#227d70",border:"0",borderRadius:"8px",color:"white",cursor:"pointer"});
  reload.addEventListener("click",()=>location.reload());
  const backup=document.createElement("button");
  backup.type="button";
  backup.textContent="Export local case backup";
  Object.assign(backup.style,{padding:"12px 16px",background:"#f1f7f6",border:"1px solid #b6d6cb",borderRadius:"8px",color:"#22695f",cursor:"pointer"});
  backup.addEventListener("click",()=>{
    if(!confirm("This backup contains unencrypted local case information. Save it privately?"))return;
    try{
      const data=Object.fromEntries(["cg.cases.v1","cg.sources.v1","cg.charter.v1"].map(k=>[k,localStorage.getItem(k)]));
      const blob=new Blob([JSON.stringify({format:"commonground-browser-recovery-v1",exportedAt:new Date().toISOString(),data},null,2)],{type:"application/json"});
      const link=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=link;a.download="commonground-local-recovery.json";a.click();
      setTimeout(()=>URL.revokeObjectURL(link),2000);
    }catch(e){description.textContent="The browser blocked data export: "+String(e.message||e);}
  });
  actions.append(reload,backup);
  const footer=document.createElement("p");
  footer.textContent="If the problem persists, check whether a content blocker is interfering with this site. Don't clear browser data until you have backed it up.";
  Object.assign(footer.style,{fontSize:"12px",color:"#6f8390",marginTop:"25px"});
  wrapper.append(logo,title,description,actions,footer);
  root.append(wrapper);
}
if(root){
  const initial=document.createElement("div");
  initial.textContent="Opening CommonGround…";
  Object.assign(initial.style,{fontFamily:"system-ui,sans-serif",color:"#667f8b",padding:"32px",textAlign:"center"});
  root.replaceChildren(initial);
}
import("./main.jsx").catch(launchFailure);
