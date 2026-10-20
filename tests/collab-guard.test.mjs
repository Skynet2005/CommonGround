import test from "node:test";
import assert from "node:assert/strict";
import room from "../api/room.js";
import invites from "../api/invitations.js";
import status from "../api/status.js";
import {collaborationReady} from "../server/collaboration.js";

function replyCapture(){
 const headers={};
 return {code:0,body:null,headers,
  setHeader(k,v){headers[k]=v;return this},
  status(v){this.code=v;return this},
  json(v){this.body=v;return this}};
}
test("new room and invitation APIs never activate without independent production gates",async()=>{
 const previous=process.env.CASE_COLLAB_ENABLED;
 delete process.env.CASE_COLLAB_ENABLED;
 try{
  assert.equal(collaborationReady(),false);
  for(const handler of [room,invites]){
   const get=replyCapture();
   await handler({method:"GET",headers:{},query:{caseId:"untrusted"}},get);
   assert.equal(get.code,503);
   const post=replyCapture();
   await handler({method:"POST",headers:{"content-type":"application/json"},body:{action:"invite"}},post);
   assert.equal(post.code,503);
  }
  const check=replyCapture();
  await status({method:"GET",headers:{}},check);
  assert.equal(check.code,200);
  assert.equal(check.body.collaborationEnabled,false);
  assert.equal(check.body.databaseReady,false);
 }finally{if(previous!==undefined)process.env.CASE_COLLAB_ENABLED=previous}
});
