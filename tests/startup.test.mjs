import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {Window} from "happy-dom";
import {createServer} from "vite";

test("the real React entry renders and Community Operations navigates without a blank screen",async()=>{
 const win=new Window({url:"https://commonground-standalone.vercel.app/"});
 const names=["window","document","navigator","localStorage","location","HTMLElement","Element","Node","MutationObserver","getComputedStyle"];
 for(const name of names){
  const value=name==="getComputedStyle"?win[name].bind(win):win[name];
  Object.defineProperty(globalThis,name,{configurable:true,value});
 }
 const root=win.document.createElement("div");root.id="root";win.document.body.append(root);
 const runtimeErrors=[];
 win.addEventListener("error",e=>runtimeErrors.push(String(e.message)));
 const server=await createServer({configFile:"vite.config.js",server:{middlewareMode:true},appType:"custom",logLevel:"error"});
 try{
  // Load the actual UI module, so undefined icon symbols fail this test.
  await server.ssrLoadModule("/src/main.jsx");
  await new Promise(resolve=>setTimeout(resolve,130));
  assert.match(root.textContent,/FAIR COMMUNITY GOVERNANCE/);
  assert.match(root.textContent,/Case workspace/);
  const operations=[...win.document.querySelectorAll("button")].find(x=>x.textContent.includes("Community operations"));
  assert.ok(operations,"Community Operations navigation must exist");
  operations.click();
  await new Promise(resolve=>setTimeout(resolve,180));
  assert.match(root.textContent,/Manage the work/);
  assert.match(root.textContent,/encrypted workspace|private workspace/i);
  assert.equal(runtimeErrors.length,0,"Page errors: "+runtimeErrors.join(", "));
 }finally{
  await server.close();
  win.happyDOM.cancelAsync();
 }
});
