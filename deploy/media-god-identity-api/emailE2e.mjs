import { randomBytes } from "node:crypto";

// Temporary, disposable QA of production endpoints. Runs exactly once for the
// preconfigured test alias, and never reveals email tokens or passwords.
export function runEmailE2E({ port, pool, getToken, clearToken }) {
  const run=String(process.env.EMAIL_E2E_RUN_ID||"");
  const stage=String(process.env.EMAIL_E2E_STAGE||"");
  const email=String(process.env.EMAIL_E2E_EMAIL||"").trim().toLowerCase();
  if (run!=="mgqa-20261123e2e" || stage!=="register" ||
      email!=="jaime.home+mgqa-20261123e2e@gmail.com") return;

  async function test() {
    const client=await pool.connect();
    let locked=false, ticketId="";
    const id=run+":full-account-and-support-v2";
    try {
      const result=await client.query("SELECT pg_try_advisory_lock(42177, 20261123) AS locked");
      locked=Boolean(result.rows?.[0]?.locked);
      if (!locked) return;
      await client.query("CREATE TABLE IF NOT EXISTS identity_email_e2e_runs(id TEXT PRIMARY KEY,finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      const finished=await client.query("SELECT 1 FROM identity_email_e2e_runs WHERE id=$1",[id]);
      if (finished.rows.length) {
        console.log("[email-e2e] Full registration/reset/support QA already passed");
        return;
      }
      const existing=await client.query("SELECT id,full_name FROM identity_accounts WHERE email=$1",[email]);
      if(existing.rows.length) {
        if(existing.rows[0].full_name!=="Media God QA") throw Error("Test alias is occupied by a non-QA account");
        await client.query("DELETE FROM identity_accounts WHERE email=$1 AND full_name='Media God QA'",[email]);
      }
      const base="http://127.0.0.1:"+port;
      async function request(path,method="GET",body,auth) {
        const r=await fetch(base+path,{
          method,
          headers:{"Content-Type":"application/json",...(auth?{Authorization:"Bearer "+auth}:{})},
          ...(body!==undefined?{body:JSON.stringify(body)}:{}),
          signal:AbortSignal.timeout(20000)
        });
        return {status:r.status, data:await r.json().catch(()=>({}))};
      }
      const post=(path,body,auth)=>request(path,"POST",body,auth);
      const must=(r,status,label)=>{
        if(r.status!==status) throw Error(label+" returned HTTP "+r.status+" instead of "+status);
        return r.data;
      };
      const password=randomBytes(30).toString("hex");
      must(await post("/auth/register",{email,name:"Media God QA",password}),201,"Register");
      console.log("[email-e2e] Registration email accepted by Resend");
      const verification=getToken("verify");
      if(!/^[A-Za-z0-9_-]{40,100}$/.test(verification||"")) throw Error("QA verification mail token was not captured");
      must(await post("/auth/verify",{token:verification}),200,"Verify account");
      clearToken("verify");
      must(await post("/auth/verify",{token:verification}),400,"Verify link reuse");
      const login=must(await post("/auth/login",{email,password}),200,"First login");
      if(login.user?.email!==email || !login.access_token) throw Error("Login response missing account/session");
      must(await request("/auth/me","GET",undefined,login.access_token),200,"Profile");
      must(await post("/auth/reset-request",{email}),200,"Request reset");
      console.log("[email-e2e] Verification and password-reset email accepted");
      const reset=getToken("reset");
      if(!/^[A-Za-z0-9_-]{40,100}$/.test(reset||"")) throw Error("QA reset email token was not captured");
      const replacement=randomBytes(30).toString("hex");
      must(await post("/auth/reset",{token:reset,password:replacement}),200,"Password reset");
      clearToken("reset");
      must(await post("/auth/reset",{token:reset,password:replacement}),400,"Reset link reuse");
      must(await request("/auth/me","GET",undefined,login.access_token),401,"Old session revocation");
      must(await post("/auth/login",{email,password}),401,"Old password invalidated");
      const after=must(await post("/auth/login",{email,password:replacement}),200,"Login with reset password");
      must(await post("/auth/logout",{},after.access_token),200,"Sign out");
      must(await request("/auth/me","GET",undefined,after.access_token),401,"Signed-out session");
      console.log("[email-e2e] Verification, one-use reset, password change, login and logout passed");
      const subject="Media God automated support test "+run;
      const create=must(await post("/support/tickets",{
        name:"Media God QA",email,category:"Other",subject,device:"QA",
        details:"Automated support workflow validation of submission, ticket security, follow-up messages and notification delivery."
      }),201,"Create support ticket");
      if(!create.id || !create.key || create.confirmation_email_accepted!==true)
        throw Error("Support ticket identifier, key or acknowledgement delivery missing");
      ticketId=create.id;
      const viewPath="/support/tickets/"+encodeURIComponent(ticketId)+"?key="+encodeURIComponent(create.key);
      const view=must(await request(viewPath),200,"Ticket view");
      if(view.messages?.length!==1) throw Error("Ticket initial message not saved");
      must(await post("/support/tickets/"+ticketId+"/reply",{
        key:create.key,message:"Customer follow-up message for QA."
      }),201,"Customer reply");
      const second=must(await request(viewPath),200,"Ticket follow-up");
      if(second.messages?.length!==2) throw Error("Follow-up message not saved");
      must(await request("/support/tickets/"+ticketId+"?key=invalid"),403,"Bad ticket secret blocked");
      must(await request("/support/admin/tickets"),401,"Unauthenticated staff inbox blocked");
      console.log("[email-e2e] Ticket creation, acknowledgement, follow-up and access restrictions passed");
      await client.query("INSERT INTO identity_email_e2e_runs(id) VALUES($1) ON CONFLICT DO NOTHING",[id]);
      console.log("[email-e2e] FULL QA PASS");
    } catch(e) {
      console.error("[email-e2e] FULL QA FAILED: "+String(e?.message||"unknown").slice(0,200));
    } finally {
      if(locked) {
        try {
          if(ticketId) await client.query("DELETE FROM support_tickets WHERE id=$1 AND requester_email=$2",[ticketId,email]);
          await client.query("DELETE FROM identity_accounts WHERE email=$1 AND full_name='Media God QA'",[email]);
          console.log("[email-e2e] Disposable test account and ticket cleaned up");
        } catch(e) {
          console.error("[email-e2e] Cleanup failed: "+String(e?.message||"unknown").slice(0,180));
        }
        await client.query("SELECT pg_advisory_unlock(42177, 20261123)").catch(()=>{});
      }
      clearToken("verify");
      clearToken("reset");
      client.release();
    }
  }
  const timer=setTimeout(()=>test().catch(e=>console.error("[email-e2e] Runner failed "+String(e.message).slice(0,150))),2500);
  timer.unref?.();
}
