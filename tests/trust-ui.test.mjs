import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {Window} from "happy-dom";
import React from "react";
import {createRoot} from "react-dom/client";
import {createServer} from "vite";
import {emptyOperations} from "../src/operations-store.js";
import {trustOperation} from "../src/trust-engine.js";

test("Trust Center React screen renders source, passport and review tabs without crashing",async()=>{
 const win=new Window({url:"https://commonground-standalone.vercel.app/"});
 for(const name of ["window","document","navigator","localStorage","location","HTMLElement","Element","Node","MutationObserver","getComputedStyle"]){
  Object.defineProperty(globalThis,name,{configurable:true,value:name==="getComputedStyle"?win[name].bind(win):win[name]});
 }
 const host=win.document.createElement("div");win.document.body.append(host);
 const server=await createServer({configFile:"vite.config.js",server:{middlewareMode:true},appType:"custom",logLevel:"error"});
 try{
  const {default:TrustCenter}=await server.ssrLoadModule("/src/TrustCenter.jsx");
  let state=emptyOperations();
  const rule={title:"Recorded Declaration 2020",kind:"Declaration",documentReference:"County recording 2020-0292",section:"Art. IV.4",excerpt:"A homeowner is required to submit architectural changes for appropriate approval before exterior construction."};
  state=await trustOperation(state,{type:"createRule",data:rule});
  state=await trustOperation(state,{type:"createPassport",data:{title:"Exterior boundary adjustment review",category:"Architectural",ruleId:state.rules[0].id,factSummary:"Contractor moved shared fence panels without a confirmed written authorization.",requestedOutcome:"Document the authority and seek qualified independent inspection."}});
  const tree=createRoot(host);
  tree.render(React.createElement(TrustCenter,{workspace:state,busy:false,commit:async()=>false}));
  await new Promise(r=>setTimeout(r,150));
  assert.match(host.textContent,/RuleGraph/);
  assert.match(host.textContent,/Recorded Declaration/);
  const passportButton=[...host.querySelectorAll("button")].find(b=>b.textContent.includes("Decision Passports"));
  assert.ok(passportButton);
  passportButton.click();
  await new Promise(r=>setTimeout(r,150));
  assert.match(host.textContent,/Exterior boundary adjustment review/);
  assert.match(host.textContent,/Exact governing source captured/);
  const neutralButton=[...host.querySelectorAll("button")].find(b=>b.textContent.includes("Independent review"));
  assert.ok(neutralButton);
  neutralButton.click();
  await new Promise(r=>setTimeout(r,140));
  assert.match(host.textContent,/Proposed neutrals, disclosures and scope/);
  tree.unmount();
 }finally{await server.close();win.happyDOM.cancelAsync()}
});
