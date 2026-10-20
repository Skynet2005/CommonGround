import {configured,mailConfigured,reply} from "./core.js";

export function collaborationReady(){
 return configured()&&mailConfigured()&&
  process.env.SHARED_BETA_ENABLED==="true" &&
  process.env.CASE_COLLAB_ENABLED==="true";
}
export function collabGate(res){
 if(collaborationReady())return true;
 reply(res,503,{error:"Shared case rooms are not enabled until the database, verified email and authorization controls are configured."});
 return false;
}
export function caseRoomSafety(){
 return {
  verified:"Email mailbox only",legalAuthorityVerified:false,
  hostedEvidenceReady:false,noticesSent:false,legalAdvice:false,
  privacy:"Shared statements are readable by all accepted case members and are not end-to-end encrypted. Do not enter privileged mediation material."
 };
}
