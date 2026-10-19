import logout from "../api/auth/logout.js";
import test from "node:test";
import assert from "node:assert/strict";
import {validEmail,sameOrigin,digestToken,requireJSON,configured} from "../server/core.js";

test("email normalization doesn't accept invalid identities",()=>{
 assert.equal(validEmail(" USER@Example.org "),"user@example.org");
 assert.equal(validEmail("noatsign"),null);
 assert.equal(validEmail("a@b"),null);
 assert.equal(validEmail("x".repeat(255)),null);
});
test("unsafe origins are denied, including missing origin headers",()=>{
 const prior=process.env.PUBLIC_ORIGIN;
 process.env.PUBLIC_ORIGIN="https://commonground-nu.vercel.app";
 try{
  assert.equal(sameOrigin({headers:{origin:"https://commonground-nu.vercel.app"}}),true);
  assert.equal(sameOrigin({headers:{origin:"https://attacker.invalid"}}),false);
  assert.equal(sameOrigin({headers:{}}),false);
 }finally{if(prior===undefined)delete process.env.PUBLIC_ORIGIN;else process.env.PUBLIC_ORIGIN=prior}
});
test("one time token digest depends on private signing pepper",()=>{
 const prior=process.env.AUTH_TOKEN_PEPPER;
 process.env.AUTH_TOKEN_PEPPER="test-hmac-key-not-a-production-secret";
 try{
  const one=digestToken("one-token");
  assert.equal(one.length,64);
  assert.notEqual(one,digestToken("another-token"));
 }finally{if(prior===undefined)delete process.env.AUTH_TOKEN_PEPPER;else process.env.AUTH_TOKEN_PEPPER=prior}
});
test("reject content type confusion and malformed JSON payloads",()=>{
 assert.throws(()=>requireJSON({headers:{"content-type":"text/plain"},body:{}}),/JSON content required/);
 assert.throws(()=>requireJSON({headers:{"content-type":"application/json"},body:[]}),/Invalid JSON object/);
 assert.deepEqual(requireJSON({headers:{"content-type":"application/json"},body:{title:"test"}}),{title:"test"});
});

test("logout remains harmless while shared infrastructure is disabled",async()=>{
 const old=process.env.SHARED_BETA_ENABLED;
 delete process.env.SHARED_BETA_ENABLED;
 try{
  const headers={};
  const res={statusCode:0,body:null,setHeader(k,v){headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
  await logout({method:"POST",headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.authenticated,false);
  assert.equal(res.body.mode,"local-only");
  assert.ok(headers["Set-Cookie"].includes("Max-Age=0"));
 }finally{if(old!==undefined)process.env.SHARED_BETA_ENABLED=old}
});
