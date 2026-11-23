import { randomBytes } from "node:crypto";

// Operator-triggered one-time QA. Only accepts a disposable Gmail plus-alias.
// Credentials and verification/reset tokens never enter source control or logs.
export function runEmailE2E({ port, pool }) {
  const run=String(process.env.EMAIL_E2E_RUN_ID||"");
  const stage=String(process.env.EMAIL_E2E_STAGE||"");
  const email=String(process.env.EMAIL_E2E_EMAIL||"").trim().toLowerCase();
  if (!/^[a-z0-9-]{6,60}$/.test(run) ||
      !["register","verify","reset","support"].includes(stage) ||
      !/^jaime\.home\+mgqa-[a-z0-9-]{6,60}@gmail\.com$/.test(email)) return;
  async function execute() {
    const identifier=run+":"+stage;
    await pool.query("CREATE TABLE IF NOT EXISTS identity_email_e2e_runs(id TEXT PRIMARY KEY,finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const done=await pool.query("SELECT 1 FROM identity_email_e2e_runs WHERE id=$1",[identifier]);
    if(done.rowCount) { console.log("[email-e2e] "+stage+" already completed"); return; }
    const base="http://127.0.0.1:"+port;
    async function post(route,body,authorization="") {
      const response=await fetch(base+route,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(authorization?{Authorization:"Bearer "+authorization}:{})},
        body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
      });
      const data=await response.json().catch(()=>({}));
      return {status:response.status,data};
    }
    async function get(route,authorization) {
      const response=await fetch(base+route,{
        headers:{Authorization:"Bearer "+authorization},signal:AbortSignal.timeout(15000)
      });
      return {status:response.status,data:await response.json().catch(()=>({}))};
    }
    function check(result,expected,step) {
      if(result.status!==expected) throw Error(step+" returned HTTP "+result.status+" (expected "+expected+")");
    }
    if(stage==="register") {
      const pw=randomBytes(30).toString("hex");
      const result=await post("/auth/register",{email,password:pw,name:"Media God QA"});
      check(result,201,"Registration");
      console.log("[email-e2e] Registration endpoint accepted a real verification-email request");
    }
    if(stage==="verify") {
      const value=String(process.env.EMAIL_E2E_VERIFY_TOKEN||"");
      if(!/^[A-Za-z0-9_-]{40,100}$/.test(value)) throw Error("Verification token is missing");
      check(await post("/auth/verify",{token:value}),200,"Verification");
      console.log("[email-e2e] Verification link activated the disposable account");
      check(await post("/auth/reset-request",{email}),200,"Password reset request");
      console.log("[email-e2e] Password-reset email requested for verified account");
    }
    if(stage==="reset") {
      const value=String(process.env.EMAIL_E2E_RESET_TOKEN||"");
      if(!/^[A-Za-z0-9_-]{40,100}$/.test(value)) throw Error("Reset token is missing");
      const pw=randomBytes(30).toString("hex");
      check(await post("/auth/reset",{token:value,password:pw}),200,"Password reset");
      check(await post("/auth/reset",{token:value,password:pw}),400,"One-time reset token reuse");
      const login=await post("/auth/login",{email,password:pw});
      check(login,200,"Login with reset password");
      if(!login.data.access_token || login.data.user?.email!==email) throw Error("Incorrect login response");
      check(await get("/auth/me",login.data.access_token),200,"Authenticated profile");
      check(await post("/auth/logout",{},login.data.access_token),200,"Logout");
      check(await get("/auth/me",login.data.access_token),401,"Revoked session");
      console.log("[email-e2e] Password reset, one-time token, login, profile, logout and revoked session all passed");
      const clean=await pool.query("DELETE FROM identity_accounts WHERE email=$1 AND full_name='Media God QA'",[email]);
      console.log("[email-e2e] Disposable account cleaned up, deleted "+clean.rowCount+" record");
    }
    if(stage==="support") {
      const title="Media God automated support ticket test "+run;
      const create=await post("/support/tickets",{
        name:"Media God QA",email,category:"Other",subject:title,device:"QA automation",
        details:"This is an authorised test request to check the live support ticket, acknowledgement, follow-up reply and private access controls."
      });
      check(create,201,"Support ticket creation");
      if(!create.data?.id || !create.data?.key) throw Error("Support key not returned");
      const id=create.data.id,key=create.data.key;
      try {
        const detail=await fetch(base+"/support/tickets/"+encodeURIComponent(id)+"?key="+encodeURIComponent(key),{signal:AbortSignal.timeout(10000)});
        if(detail.status!==200) throw Error("Customer ticket read HTTP "+detail.status);
        check(await post("/support/tickets/"+id+"/reply",{key,message:"This is the customer follow-up test message."}),201,"Customer reply");
        const again=await fetch(base+"/support/tickets/"+encodeURIComponent(id)+"?key="+encodeURIComponent(key));
        const record=await again.json();
        if(again.status!==200 || record.messages?.length!==2) throw Error("Customer conversation was not retained");
        const invalid=await fetch(base+"/support/tickets/"+encodeURIComponent(id)+"?key=invalid");
        if(invalid.status!==403) throw Error("Invalid ticket key was not blocked");
        const admin=await fetch(base+"/support/admin/tickets");
        if(admin.status!==401) throw Error("Staff inbox accessible without login");
        console.log("[email-e2e] Support form, receipt, customer follow-up and private access checks passed (confirmation email accepted="+Boolean(create.data.confirmation_email_accepted)+")");
      } finally {
        await pool.query("DELETE FROM support_tickets WHERE id=$1 AND requester_email=$2 AND subject=$3",[id,email,title]);
        console.log("[email-e2e] Disposable support ticket cleaned up");
      }
    }
    await pool.query("INSERT INTO identity_email_e2e_runs(id) VALUES($1) ON CONFLICT(id) DO NOTHING",[identifier]);
    console.log("[email-e2e] Stage "+stage+" passed");
  }
  const timer=setTimeout(()=>execute().catch(e=>console.error("[email-e2e] Stage "+stage+" failed: "+String(e.message||"unknown").slice(0,200))),2500);
  timer.unref?.();
}
