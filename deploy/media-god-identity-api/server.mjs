import http from "node:http";
import { randomBytes, randomUUID, createHash, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { createSocialOAuth } from "./socialOAuth.mjs";
import { createSupport } from "./support.mjs";

const { Pool } = pg;
const scrypt = promisify(scryptCb);
const url = process.env.DATABASE_URL;
if (!url) throw Error("DATABASE_URL required");
const pool = new Pool({ connectionString: url, max: 8, connectionTimeoutMillis: 5000 });
const port = Number(process.env.PORT || 4000);
// The independently hosted Media God website is now verified on the www custom
// domain, including TLS. Keep that as the link origin until the root domain
// is fully routed and verified too. SITE_LINK_ORIGIN may override this.
const site = String(process.env.SITE_LINK_ORIGIN || "https://www.underworldhub.co.uk").replace(/\/+$/, "");
const origins = new Set(String(process.env.ALLOWED_ORIGINS || "https://underworldhub.co.uk,https://www.underworldhub.co.uk").split(",").map(s=>s.trim()).filter(Boolean));
origins.add(site);
const mailReady = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
const maxBytes = 128000;
const entities = new Set(["Addon","Channel","ContinueWatching","Favorite","MediaReview","Movie","PlayerRemoteSession","RoadmapItem","WatchParty","WatchPartyMessage","WatchPartyPresence","WatchlistItem"]);
const sensitive = /password|refresh.?token|access.?token|api.?key|client.?secret|^rd_token$|debrid.?token/i;
const traffic = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha = value => createHash("sha256").update(String(value)).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const err = (status, message, code="REQUEST_ERROR") => { const e = Error(message); e.status=status; e.code=code; throw e; };
const profile = u => ({ id:u.id,email:u.email,full_name:u.full_name,role:"user",preferences:u.preferences||{},created_date:u.created_at,updated_date:u.updated_at });
const respond = (res,code,data,origin) => {
  if (origin && origins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin",origin);
    res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Vary","Origin");
  }
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.writeHead(code);
  res.end(code===204?"":JSON.stringify(data));
};
const input = async req => {
  let size=0, buffers=[];
  for await (const part of req) {
    size+=part.length;
    if (size>maxBytes) err(413,"Request too large");
    buffers.push(part);
  }
  if (!buffers.length) return {};
  try {
    const value=JSON.parse(Buffer.concat(buffers).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value!=="object") err(400,"Invalid object");
    return value;
  } catch(e) {
    if (e.status) throw e;
    err(400,"Invalid JSON");
  }
};
const validEmail = raw => {
  const email=String(raw||"").trim().toLowerCase();
  if (!emailPattern.test(email) || email.length>254) err(400,"Valid email address required");
  return email;
};
const validPassword = password => {
  if (typeof password!=="string" || password.length<12 || password.length>128) err(400,"Use a password of 12 to 128 characters");
  return password;
};
const hashPass = async password => {
  const salt=randomBytes(16);
  const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:67108864});
  return "scrypt:"+salt.toString("hex")+":"+key.toString("hex");
};
const verifyPass = async (password,stored) => {
  const parts=String(stored||"").split(":");
  if (parts.length!==3 || parts[0]!=="scrypt") return false;
  const expected=Buffer.from(parts[2],"hex");
  if (expected.length!==64) return false;
  const actual=await scrypt(password,Buffer.from(parts[1],"hex"),64,{N:32768,r:8,p:1,maxmem:67108864});
  return timingSafeEqual(expected,actual);
};
const limitRate = (req,kind,email="") => {
  const key=sha(kind+":"+String(req.socket.remoteAddress||"") + ":" + email);
  const now=Date.now(), prior=traffic.get(key);
  const state=prior&&prior.until>now?prior:{n:0,until:now+900000};
  state.n++;
  state.kind=kind;
  state.emailHash=sha(email);
  traffic.set(key,state);
  if (traffic.size>6000) for (const [id,val] of traffic) if (val.until<=now) traffic.delete(id);
  if (state.n>(kind==="login"?30:12)) err(429,"Too many requests. Try again later.");
};
// A verified password-reset token proves mailbox ownership; release that
// account's in-memory login throttle alongside its database lockout.
// This never clears throttles on an unauthenticated reset request.
const clearLoginRateForEmail = email => {
  const emailHash=sha(email);
  for (const [key,state] of traffic) {
    if (state.kind==="login" && state.emailHash===emailHash) traffic.delete(key);
  }
};
const emailSend = async (recipient,subject,plain,options={}) => {
  if (!mailReady) err(503,"Verification email is not configured yet","EMAIL_NOT_READY");
  const result=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:options.from||process.env.EMAIL_FROM,to:[recipient],subject,text:plain}),
    signal:AbortSignal.timeout(10000)
  });
  if (!result.ok) {
    console.error("[identity] email delivery unavailable",result.status);
    err(503,"Could not deliver the email. Try again later.");
  }
};
const requireUser=async req=>{
  const auth=/^Bearer ([A-Za-z0-9_-]{30,200})$/.exec(String(req.headers.authorization||""));
  if (!auth) err(401,"Sign in to your new Media God account","AUTH_REQUIRED");
  const {rows}=await pool.query(
    "SELECT a.*,s.id AS session_id FROM identity_sessions s JOIN identity_accounts a ON a.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>NOW() AND a.verified_at IS NOT NULL",
    [sha(auth[1])]
  );
  if (!rows.length) err(401,"Session expired. Sign in again.","SESSION_EXPIRED");
  return rows[0];
};
const issueSession=async user=>{
  const value=token();
  await pool.query("INSERT INTO identity_sessions(id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,$4)",
    [randomUUID(),user.id,sha(value),new Date(Date.now()+14*86400000)]);
  return {access_token:value,expires_in:14*86400,user:profile(user)};
};
const safeData=(obj,max=50000)=>{
  if (!obj||typeof obj!=="object"||Array.isArray(obj)||JSON.stringify(obj).length>max) err(400,"Invalid data");
  for (const k of Object.keys(obj)) {
    if (["__proto__","constructor","prototype"].includes(k)||sensitive.test(k)) {
      err(400,"Provider credentials must use a separate encrypted connection");
    }
  }
  return obj;
};
const sqlSchema=[
"CREATE TABLE IF NOT EXISTS identity_accounts (id UUID PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,full_name TEXT NOT NULL DEFAULT '',preferences JSONB NOT NULL DEFAULT '{}'::jsonb,verified_at TIMESTAMPTZ,verify_hash TEXT UNIQUE,verify_expires TIMESTAMPTZ,reset_hash TEXT UNIQUE,reset_expires TIMESTAMPTZ,login_failures INT NOT NULL DEFAULT 0,locked_until TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS identity_sessions (id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES identity_accounts(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS identity_sessions_account_idx ON identity_sessions(user_id)",
"CREATE TABLE IF NOT EXISTS identity_records(id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES identity_accounts(id) ON DELETE CASCADE,entity TEXT NOT NULL,data JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS identity_records_user_idx ON identity_records(user_id,entity,updated_at DESC)"
];
for (const sql of sqlSchema) await pool.query(sql);
const socialOAuth = createSocialOAuth({pool,issueSession});
await socialOAuth.initialize();
const support = await createSupport({pool,requireUser,emailSend,site});

async function authentication(req,res,path,body,origin) {
  if (path==="/auth/config"&&req.method==="GET") return respond(res,200,{independent:true,email_verification_required:true,registration_ready:mailReady,previous_accounts_not_imported:true},origin);
  if (path==="/auth/register"&&req.method==="POST") {
    const email=validEmail(body.email);
    const password=validPassword(body.password);
    if (!mailReady) err(503,"New account email verification is not configured yet","EMAIL_NOT_READY");
    limitRate(req,"register",email);
    const found=await pool.query("SELECT id FROM identity_accounts WHERE email=$1",[email]);
    if (found.rows.length) return respond(res,200,{ok:true,message:"If your account is eligible, check your email."},origin);
    const verify=token();
    await pool.query("INSERT INTO identity_accounts(id,email,password_hash,full_name,verify_hash,verify_expires) VALUES($1,$2,$3,$4,$5,$6)",[
      randomUUID(),email,await hashPass(password),String(body.name||"").slice(0,100),sha(verify),new Date(Date.now()+86400000)
    ]);
    await emailSend(email,"Verify your new Media God account","Verify your new account:\n"+site+"/verify-email?token="+encodeURIComponent(verify)+"\nThis link expires in 24 hours.");
    return respond(res,201,{ok:true,message:"Check your email for a verification link."},origin);
  }
  if (path==="/auth/resend-verification"&&req.method==="POST") {
    const email=validEmail(body.email);
    limitRate(req,"verify",email);
    const {rows}=await pool.query("SELECT id FROM identity_accounts WHERE email=$1 AND verified_at IS NULL",[email]);
    if (rows.length && mailReady) {
      const verify=token();
      await pool.query("UPDATE identity_accounts SET verify_hash=$1,verify_expires=$2 WHERE id=$3",[sha(verify),new Date(Date.now()+86400000),rows[0].id]);
      await emailSend(email,"Verify your Media God account","Verify your new account:\n"+site+"/verify-email?token="+encodeURIComponent(verify));
    }
    return respond(res,200,{ok:true,message:"If verification is pending, check your email."},origin);
  }
  if (path==="/auth/verify"&&req.method==="POST") {
    const value=String(body.token||"");
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(value)) err(400,"Invalid verification link");
    const result=await pool.query("UPDATE identity_accounts SET verified_at=NOW(),verify_hash=NULL,verify_expires=NULL,updated_at=NOW() WHERE verify_hash=$1 AND verify_expires>NOW() AND verified_at IS NULL RETURNING id",[sha(value)]);
    if (!result.rowCount) err(400,"Verification link expired or already used");
    return respond(res,200,{ok:true},origin);
  }
  if (path==="/auth/login"&&req.method==="POST") {
    const email=validEmail(body.email),password=String(body.password||"");
    limitRate(req,"login",email);
    const {rows}=await pool.query("SELECT * FROM identity_accounts WHERE email=$1",[email]);
    const user=rows[0];
    if (user?.locked_until && new Date(user.locked_until)>new Date()) err(429,"Account temporarily locked after incorrect sign-in attempts. You can reset your password to unlock it, or wait 15 minutes.","ACCOUNT_LOCKED");
    if (!user || !await verifyPass(password,user.password_hash)) {
      if (user) await pool.query(
        // After a completed lockout window, a new incorrect attempt starts
        // a fresh counter instead of immediately locking the user again.
        "UPDATE identity_accounts SET login_failures=CASE WHEN locked_until<=NOW() THEN 1 ELSE login_failures+1 END,locked_until=CASE WHEN locked_until<=NOW() THEN NULL WHEN login_failures>=4 THEN NOW()+INTERVAL '15 minutes' ELSE locked_until END WHERE id=$1",
        [user.id]
      );
      err(401,"Invalid email or password");
    }
    if (!user.verified_at) err(403,"Verify your email before signing in","EMAIL_UNVERIFIED");
    await pool.query("UPDATE identity_accounts SET login_failures=0,locked_until=NULL WHERE id=$1",[user.id]);
    return respond(res,200,await issueSession(user),origin);
  }
  if (path==="/auth/reset-request"&&req.method==="POST") {
    const email=validEmail(body.email);
    limitRate(req,"reset",email);
    const {rows}=await pool.query("SELECT id FROM identity_accounts WHERE email=$1 AND verified_at IS NOT NULL",[email]);
    if (rows.length && mailReady) {
      const value=token();
      await pool.query("UPDATE identity_accounts SET reset_hash=$1,reset_expires=$2 WHERE id=$3",[sha(value),new Date(Date.now()+3600000),rows[0].id]);
      await emailSend(email,"Reset Media God password","Reset your password:\n"+site+"/reset-password?token="+encodeURIComponent(value)+"\nExpires in 1 hour.");
    }
    return respond(res,200,{ok:true,message:"If your account exists, check your email."},origin);
  }
  if (path==="/auth/reset"&&req.method==="POST") {
    const value=String(body.token||""),password=validPassword(body.password);
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(value)) err(400,"Invalid link");
    // A successfully consumed, single-use recovery token must also clear
    // previous password-guess counters. Otherwise a new password can still
    // be rejected with ACCOUNT_LOCKED for 15 minutes.
    const {rows}=await pool.query("UPDATE identity_accounts SET password_hash=$1,reset_hash=NULL,reset_expires=NULL,login_failures=0,locked_until=NULL,updated_at=NOW() WHERE reset_hash=$2 AND reset_expires>NOW() RETURNING id,email",[await hashPass(password),sha(value)]);
    if (!rows.length) err(400,"Reset link expired or used");
    await pool.query("UPDATE identity_sessions SET revoked_at=NOW() WHERE user_id=$1",[rows[0].id]);
    clearLoginRateForEmail(rows[0].email);
    return respond(res,200,{ok:true},origin);
  }
  const user=await requireUser(req);
  // A still-valid Media God session is proof of prior authentication. Allow
  // that user to unlock sign-in on their other devices without a password
  // change, email-disclosure, or any account-wide security bypass.
  // No unauthenticated or cross-account unlock operation is provided.
  if (path==="/auth/unlock-login"&&req.method==="POST") {
    limitRate(req,"unlock",user.email);
    await pool.query(
      "UPDATE identity_accounts SET login_failures=0,locked_until=NULL,updated_at=NOW() WHERE id=$1",
      [user.id]
    );
    clearLoginRateForEmail(user.email);
    return respond(res,200,{ok:true,message:"Sign-in attempts unlocked for this Media God account."},origin);
  }
  if (path==="/auth/me"&&req.method==="GET") {
    // Renew active sessions at most once a week, including existing installations.
    await pool.query("UPDATE identity_sessions SET expires_at=NOW()+INTERVAL '14 days' WHERE id=$1 AND revoked_at IS NULL AND expires_at>NOW() AND expires_at<NOW()+INTERVAL '7 days'",[user.session_id]);
    return respond(res,200,profile(user),origin);
  }
  if (path==="/auth/logout"&&req.method==="POST") {
    await pool.query("UPDATE identity_sessions SET revoked_at=NOW() WHERE id=$1",[user.session_id]);
    return respond(res,200,{ok:true},origin);
  }
  if (path==="/auth/me"&&req.method==="PATCH") {
    const display=body.full_name===undefined?null:String(body.full_name).slice(0,100);
    const prefs=body.preferences===undefined?null:JSON.stringify(safeData(body.preferences));
    if (display===null && prefs===null) err(400,"No editable profile fields");
    const {rows}=await pool.query("UPDATE identity_accounts SET full_name=COALESCE($2,full_name),preferences=preferences||COALESCE($3::jsonb,'{}'::jsonb),updated_at=NOW() WHERE id=$1 RETURNING *",[user.id,display,prefs]);
    return respond(res,200,profile(rows[0]),origin);
  }
  err(404,"Unknown auth route");
}
function mapped(row) { return {...row.data,id:row.id,created_date:row.created_at,updated_date:row.updated_at,created_by_id:row.user_id}; }
async function entityRoute(req,res,path,body,origin) {
  const parts=/^\/entities\/([A-Za-z][A-Za-z0-9_]{0,62})(?:\/([a-f0-9-]{36}))?$/.exec(path);
  if (!parts || !entities.has(parts[1])) err(404,"Entity unavailable");
  const [,type,id]=parts, user=await requireUser(req);
  if (req.method==="GET"&&id) {
    const {rows}=await pool.query(
      "SELECT * FROM identity_records WHERE id=$1 AND user_id=$2 AND entity=$3",
      [id,user.id,type]
    );
    if (!rows.length) err(404,"Record not found");
    return respond(res,200,mapped(rows[0]),origin);
  }
  if (req.method==="GET"&&!id) {
    const args=new URL(req.url,"http://localhost").searchParams;
    let filter={};
    try {if(args.has("filter"))filter=JSON.parse(args.get("filter"));}catch{err(400,"Invalid filter");}
    safeData(filter,4000);
    const sort=String(args.get("sort")||"-updated_date"),field=sort.replace(/^-/,"");
    if (!["created_date","updated_date","title","content_key","name"].includes(field)) err(400,"Unsupported sort field");
    const column=field==="created_date"?"created_at":field==="updated_date"?"updated_at":"data->>'"+field+"'";
    const direction=sort.startsWith("-")?"DESC":"ASC";
    const limit=Math.max(1,Math.min(500,Number(args.get("limit")||100)||100));
    const skip=Math.max(0,Math.min(10000,Number(args.get("skip")||0)||0));
    const {rows}=await pool.query("SELECT * FROM identity_records WHERE user_id=$1 AND entity=$2 AND data @> $3::jsonb ORDER BY "+column+" "+direction+",id LIMIT $4 OFFSET $5",[user.id,type,JSON.stringify(filter),limit,skip]);
    return respond(res,200,rows.map(mapped),origin);
  }
  if (req.method==="GET"&&id) {
    const {rows}=await pool.query(
      "SELECT * FROM identity_records WHERE id=$1 AND user_id=$2 AND entity=$3",
      [id,user.id,type]
    );
    if (!rows.length) err(404,"Record not found");
    return respond(res,200,mapped(rows[0]),origin);
  }
  if (req.method==="POST"&&!id) {
    const data=safeData(body);
    const {rows}=await pool.query("INSERT INTO identity_records(id,user_id,entity,data) VALUES($1,$2,$3,$4::jsonb) RETURNING *",[randomUUID(),user.id,type,JSON.stringify({...data,created_by_id:user.id,created_by:user.email})]);
    return respond(res,201,mapped(rows[0]),origin);
  }
  if (req.method==="PATCH"&&id) {
    const {rows}=await pool.query("UPDATE identity_records SET data=data||$4::jsonb,updated_at=NOW() WHERE id=$1 AND user_id=$2 AND entity=$3 RETURNING *",[id,user.id,type,JSON.stringify(safeData(body))]);
    if (!rows.length) err(404,"Record not found");
    return respond(res,200,mapped(rows[0]),origin);
  }
  if (req.method==="DELETE"&&id) {
    await pool.query("DELETE FROM identity_records WHERE id=$1 AND user_id=$2 AND entity=$3",[id,user.id,type]);
    return respond(res,200,{ok:true},origin);
  }
  err(405,"Unsupported entity operation");
}
async function handler(req,res) {
  const origin=String(req.headers.origin||"");
  try {
    const path=new URL(req.url||"/","http://localhost").pathname;
    // Sign in with Apple sends a cross-site form_post from appleid.apple.com.
    // This single server-to-server OAuth callback is verified using its
    // one-use state, browser-binding cookie, signed ID token and nonce.
    // appleCallback is defined above for both the origin check and body decoder.
    const appleCallback = path==="/auth/oauth/apple/callback" && req.method==="POST";
    if (origin&&!origins.has(origin)&&!appleCallback) err(403,"Origin not allowed");
    if (req.method==="OPTIONS") return respond(res,204,{},origin);
    if (path==="/health"&&req.method==="GET") {
      await pool.query("SELECT 1");
      return respond(res,200,{status:"ok",identity:"jaime-home",database:"connected",registration_ready:mailReady},origin);
    }
    if (path==="/"&&req.method==="GET") return respond(res,200,{service:"Media God Identity",base44:false},origin);
    // Apple's form_post must be read as URL-encoded body by the OAuth router,
    // not parsed as JSON by the usual application request decoder.
    if (path==="/support/inbound/resend" && req.method==="POST") {
      let size=0, chunks=[];
      for await (const chunk of req) {
        size+=chunk.length;
        if (size>maxBytes) err(413,"Webhook payload too large");
        chunks.push(chunk);
      }
      return await support.receiveWebhook(req,res,Buffer.concat(chunks).toString("utf8"),origin,respond);
    }
    const body=!appleCallback && ["POST","PATCH"].includes(req.method)?await input(req):{};
    if (path==="/auth/providers" || path.startsWith("/auth/oauth/")) {
      return await socialOAuth.handle(req,res,path,body,origin,respond);
    }
    if (path.startsWith("/auth/")) return await authentication(req,res,path,body,origin);
    if (path.startsWith("/entities/")) return await entityRoute(req,res,path,body,origin);
    if (path.startsWith("/support/")) return await support.handle(req,res,path,body,origin,respond);
    err(404,"Not found");
  }catch(e){
    const status=Number(e.status)||500;
    if (status>=500) console.error("[identity] operation failed",{status,path:String(req.url||"").split("?")[0]});
    respond(res,status,{error:status===500?"Internal server error":e.message,code:e.code||"REQUEST_ERROR"},origin);
  }
}
http.createServer(handler).listen(port,"0.0.0.0",()=>{
  console.log("[identity] Jaime Home service started; email setup "+(mailReady?"ready":"pending"));
});
