import { randomBytes } from "node:crypto";
import { resolveMx } from "node:dns/promises";

// Temporary, disposable QA of production endpoints. Runs exactly once for the
// preconfigured test alias, and never reveals email tokens or passwords.
export function runEmailE2E({ port, pool, getToken, clearToken }) {
  const run=String(process.env.EMAIL_E2E_RUN_ID||"");
  const stage=String(process.env.EMAIL_E2E_STAGE||"");
  const email=String(process.env.EMAIL_E2E_EMAIL||"").trim().toLowerCase();
  if (run!=="mgqa-20261123e2e" || stage!=="register" ||
      email!=="jaime.home+mgqa-20261123e2e@gmail.com") return;

  async function diagnoseInbound() {
    try {
      const records=await resolveMx("underworldhub.co.uk");
      console.log("[inbound-qa] Published MX records: "+(records.length?records.map(r=>r.priority+":"+r.exchange).join(","):"NONE"));
    } catch(e) {
      console.log("[inbound-qa] MX lookup: "+String(e.code||e.message).slice(0,90));
    }
    if(!process.env.RESEND_API_KEY) return;
    const headers={Authorization:"Bearer "+process.env.RESEND_API_KEY};
    try {
      const r=await fetch("https://api.resend.com/emails/receiving",{headers,signal:AbortSignal.timeout(12000)});
      if(!r.ok) console.log("[inbound-qa] Resend receiving list HTTP "+r.status);
      else {
        const json=await r.json();
        const rows=Array.isArray(json.data)?json.data:[];
        const ours=rows.filter(x=>(Array.isArray(x.to)?x.to:[]).some(t=>String(t).toLowerCase()==="support@underworldhub.co.uk"));
        const test=ours.filter(x=>/Media God|MG support/i.test(String(x.subject||"")));
        console.log("[inbound-qa] Resend recent incoming emails (page): "+rows.length+", to support: "+ours.length+", test subjects: "+test.length);
      }
    } catch(e) {console.log("[inbound-qa] Resend receiving lookup: "+String(e.message||"error").slice(0,100));}
    try {
      const r=await fetch("https://api.resend.com/domains",{headers,signal:AbortSignal.timeout(12000)});
      if(!r.ok) {console.log("[inbound-qa] Resend domains list HTTP "+r.status);return;}
      const json=await r.json();
      const domain=Array.isArray(json.data)?json.data.find(x=>x.name==="underworldhub.co.uk"):null;
      if(!domain){console.log("[inbound-qa] Resend domain not listed");return;}
      console.log("[inbound-qa] Resend domain status="+domain.status+", receive status="+JSON.stringify(domain.capabilities?.receiving||"unknown"));
      const d=await fetch("https://api.resend.com/domains/"+encodeURIComponent(domain.id),{headers,signal:AbortSignal.timeout(12000)});
      if(d.ok) {
        const info=await d.json();
        const mx=(info.records||[]).filter(x=>String(x.type).toUpperCase()==="MX");
        console.log("[inbound-qa] Resend expected MX: "+mx.map(x=>[x.name,x.value||x.content,x.priority,x.status].filter(v=>v!==undefined).join(":")).join(","));
      }
    } catch(e) {console.log("[inbound-qa] Resend domain lookup: "+String(e.message||"error").slice(0,100));}
  }
  const diagnostic=setTimeout(()=>diagnoseInbound().catch(()=>{}),1800);
  diagnostic.unref?.();
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
