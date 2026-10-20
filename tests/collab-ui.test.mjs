import test from "node:test";
import assert from "node:assert/strict";
import {Window} from "happy-dom";
import React from "react";
import {createRoot} from "react-dom/client";
import {createServer} from "vite";

test("case creator can render secure room and pending-invitation controls",async()=>{
 const win=new Window({url:"https://commonground-standalone.vercel.app/"});
 for(const name of ["window","document","navigator","localStorage","location","HTMLElement","Element","Node","MutationObserver","getComputedStyle"]){
  Object.defineProperty(globalThis,name,{configurable:true,value:name==="getComputedStyle"?win[name].bind(win):win[name]});
 }
 const owner="11111111-1111-4111-8111-111111111111";
 const caseId="22222222-2222-4222-8222-222222222222";
 const requests=[];
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  requests.push(String(url));
  const data=String(url).includes("invitations?")?{pending:[{invite_id:"44444444-4444-4444-8444-444444444444",recipient_email:"guest@example.test",expires_at:new Date().toISOString()}]}:
   {viewer:owner,case:{id:caseId,created_by:owner,title:"Case A"},members:[{member_id:owner,member_email:"owner@example.test",member_role:"case_owner"}],notes:[{id:"33333333-3333-4333-8333-333333333333",author_id:owner,visibility:"shared",statement:"Request verified record and follow-up",created_at:new Date().toISOString()}],receipts:[],accessHistory:[]};
  return {ok:true,json:async()=>data};
 };
 const host=win.document.createElement("div");win.document.body.append(host);
 const server=await createServer({configFile:"vite.config.js",server:{middlewareMode:true},appType:"custom",logLevel:"error"});
 try{
  const {default:CaseRoom}=await server.ssrLoadModule("/src/CaseRoom.jsx");
  const root=createRoot(host);
  root.render(React.createElement(CaseRoom,{caseId,viewerId:owner,creatorId:owner}));
  await new Promise(resolve=>setTimeout(resolve,180));
  assert.match(host.textContent,/Shared case room/);
  assert.match(host.textContent,/Verified-email participation/);
  assert.match(host.textContent,/Invite a participant/);
  assert.match(host.textContent,/Request verified record/);
  assert.match(host.textContent,/guest@example.test/);
  assert.ok(requests.some(x=>x.includes("/api/room?caseId=")));
  root.unmount();
 }finally{
  await server.close();
  win.happyDOM.cancelAsync();
  globalThis.fetch=originalFetch;
 }
});
