import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, decodeJwt, importPKCS8, SignJWT } from "jose";

const SOC = Object.freeze(["google","facebook","microsoft","apple"]);
const safeToken = () => randomBytes(32).toString("base64url");
const sha = x => createHash("sha256").update(String(x)).digest("hex");
const b64u = x => createHash("sha256").update(String(x)).digest("base64url");
const COOKIE = "mg_oauth_browser";
const MAX_OAUTH_BODY=20000;
const DEVICE_ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const deviceCode=()=>Array.from(randomBytes(8),n=>DEVICE_ALPHABET[n%DEVICE_ALPHABET.length]).join("");
const normalDeviceCode=raw=>String(raw||"").toUpperCase().replace(/[\s-]/g,"");
const validDeviceCode=code=>/^[A-HJ-NP-Z2-9]{8}$/.test(code);

const scopes = {
  google:"openid email profile",
  microsoft:"openid email profile",
  facebook:"email,public_profile",
  apple:"name email",
};
const jwks = Object.freeze({
  google:createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
  microsoft:createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys")),
  apple:createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
});
const configured = provider => {
  const upper=provider.toUpperCase();
  if (!SOC.includes(provider)) return false;
  if (provider==="apple") return Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY &&
    process.env.APPLE_REDIRECT_URI==="https://auth.underworldhub.co.uk/auth/oauth/apple/callback");
  return Boolean(process.env[upper+"_CLIENT_ID"] && process.env[upper+"_CLIENT_SECRET"]);
};
// Align OAuth errors and interrupted sign-ins with the verified independent
// website. The non-www address is still hosted separately during DNS migration.
const site = String(process.env.SITE_LINK_ORIGIN || "https://www.underworldhub.co.uk").replace(/\/+$/,"");
const identity = String(process.env.SOCIAL_CALLBACK_BASE_URL ||
  "https://media-god-identity-api-production.up.railway.app").replace(/\/+$/,"");
const allowedOrigins = new Set(String(process.env.SOCIAL_RETURN_ORIGINS ||
  "https://underworldhub.co.uk,https://www.underworldhub.co.uk,https://media-god-independent-web-production.up.railway.app")
  .split(",").map(s=>s.trim().replace(/\/+$/,"")).filter(Boolean));
const providerConfig = p => {
  const upper=p.toUpperCase();
  // Apple requires a verified domain controlled by Media God. Its return
  // hostname can move to auth.underworldhub.co.uk without changing the
  // working Google, Facebook or Microsoft callback registrations.
  const defaultCallback=identity+"/auth/oauth/"+p+"/callback";
  const appleOverride=String(process.env.APPLE_REDIRECT_URI||"").trim();
  const appleCallback="https://auth.underworldhub.co.uk/auth/oauth/apple/callback";
  return {
    clientId: process.env[upper+"_CLIENT_ID"] || "",
    secret: process.env[upper+"_CLIENT_SECRET"] || "",
    callback:p==="apple" && appleOverride===appleCallback
      ? appleCallback : defaultCallback,
  };
};
function safeReturn(raw) {
  try {
    const url=new URL(String(raw||"/"),site);
    if (!["https:"].includes(url.protocol) || !allowedOrigins.has(url.origin)) throw Error();
    return url.origin;
  } catch { return site; }
}
function browserCookie(req) {
  const parts=String(req.headers.cookie||"").split(";").map(s=>s.trim());
  const found=parts.find(s=>s.startsWith(COOKIE+"="));
  const value=found?.slice(COOKIE.length+1)||"";
  return /^[A-Za-z0-9_-]{40,100}$/.test(value)?value:"";
}
function setBrowserCookie(res,value) {
  // SameSite=None supports the Apple cross-origin form_post callback. The
  // callback also checks the one-time state, PKCE/nonce and browser binder.
  res.setHeader("Set-Cookie",COOKIE+"="+value+"; HttpOnly; Secure; SameSite=None; Path=/auth/oauth; Max-Age=600");
}
function redirect(res,url) {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("Location",url);
  res.writeHead(303);
  res.end();
}
function errorResponse(res,returnOrigin,kind="unavailable") {
  const url=new URL("/login",returnOrigin);
  url.searchParams.set("social_error",kind);
  redirect(res,url.toString());
}
function sanitizeProfile(person,provider,subject) {
  const email=String(person?.email||"").trim().toLowerCase();
  const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length<=254;
  const verified=person?.emailVerified===true && valid;
  return {
    provider, subject:String(subject), verifiedEmail:verified?email:"",
    fullName:String(person?.name||"").trim().slice(0,120),
    preferredDisplay:valid?email:provider,
  };
}
function httpError(response) {
  if (!response.ok) throw new Error("Social identity provider unavailable");
}
async function readJson(response) {
  httpError(response);
  return response.json();
}
async function exchangeCode(provider,code,verifier,config) {
  const form=new URLSearchParams({
    grant_type:"authorization_code",code,client_id:config.clientId,redirect_uri:config.callback
  });
  let endpoint;
  if(provider==="google") endpoint="https://oauth2.googleapis.com/token";
  if(provider==="microsoft") endpoint="https://login.microsoftonline.com/common/oauth2/v2.0/token";
  if(provider==="apple") endpoint="https://appleid.apple.com/auth/token";
  if(provider==="facebook") endpoint="https://graph.facebook.com/v24.0/oauth/access_token";
  if (provider==="apple") {
    const privateKey=String(process.env.APPLE_PRIVATE_KEY||"").replace(/\\n/g,"\n");
    const key=await importPKCS8(privateKey,"ES256");
    const seconds=Math.floor(Date.now()/1000);
    const clientSecret=await new SignJWT({
      iss:process.env.APPLE_TEAM_ID,sub:config.clientId,aud:"https://appleid.apple.com"
    }).setProtectedHeader({alg:"ES256",kid:process.env.APPLE_KEY_ID})
      .setIssuedAt(seconds).setExpirationTime(seconds+300).sign(key);
    form.set("client_secret",clientSecret);
  } else form.set("client_secret",config.secret);
  if (provider==="google"||provider==="microsoft") form.set("code_verifier",verifier);
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:form,signal:AbortSignal.timeout(12000)});
  return readJson(response);
}
async function verifiedIdentity(provider,tokens,config,nonce) {
  if(provider==="google"||provider==="microsoft"||provider==="apple") {
    if (!tokens?.id_token) throw Error("Provider identity token missing");
    let options;
    if(provider==="google") options={issuer:["https://accounts.google.com","accounts.google.com"],audience:config.clientId};
    else if(provider==="apple") options={issuer:"https://appleid.apple.com",audience:config.clientId};
    else {
      // Microsoft common returns a tenant-specific issuer. The tenant ID is
      // validated as a GUID and the JWT signature, issuer and audience must
      // ALL match; untrusted claims are never used without verification.
      const claims=decodeJwt(tokens.id_token);
      const tenant=String(claims.tid||"");
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant)) {
        throw Error("Unrecognised Microsoft tenant");
      }
      options={issuer:"https://login.microsoftonline.com/"+tenant+"/v2.0",audience:config.clientId};
    }
    const {payload}=await jwtVerify(tokens.id_token,jwks[provider],options);
    if (payload.nonce!==nonce) throw Error("OAuth nonce mismatch");
    if (!payload.sub || typeof payload.sub!=="string") throw Error("Provider subject missing");
    const verifiedEmail=payload.email_verified===true || payload.email_verified==="true";
    const profile=sanitizeProfile({
      email:payload.email||"",
      emailVerified:verifiedEmail,
      name:payload.name||[payload.given_name,payload.family_name].filter(Boolean).join(" ")
    },provider,payload.sub);
    // Only Gmail/Googlemail addresses may be joined automatically after
    // Google verifies the signed ID token, email_verified and OAuth nonce.
    // Workspace and other third-party email addresses can be reassigned, so
    // they must use an explicit account-link flow rather than auto-merging.
    const domain=profile.verifiedEmail.split("@")[1]||"";
    return {
      ...profile,
      trustedGoogleMailbox:provider==="google" && Boolean(profile.verifiedEmail) &&
        (domain==="gmail.com" || domain==="googlemail.com"),
    };
  }
  // Facebook Login is OAuth (not OpenID Connect): verify the exchanged token
  // is valid, belongs to our Meta app, and names the same person returned by
  // /me before creating an identity. Never trust its email as verified.
  const access=String(tokens?.access_token||"");
  if(!access) throw Error("Facebook access token missing");
  const proof=createHmac("sha256",config.secret).update(access).digest("hex");
  const debugUrl=new URL("https://graph.facebook.com/v24.0/debug_token");
  debugUrl.searchParams.set("input_token",access);
  debugUrl.searchParams.set("access_token",config.clientId+"|"+config.secret);
  const debug=await readJson(await fetch(debugUrl,{signal:AbortSignal.timeout(10000)}));
  if(debug?.data?.is_valid!==true||String(debug?.data?.app_id)!==config.clientId||
     !String(debug?.data?.user_id||"")) throw Error("Facebook identity verification failed");
  const meUrl=new URL("https://graph.facebook.com/v24.0/me");
  meUrl.searchParams.set("fields","id,name,email");
  meUrl.searchParams.set("access_token",access);
  meUrl.searchParams.set("appsecret_proof",proof);
  const info=await readJson(await fetch(meUrl,{signal:AbortSignal.timeout(10000)}));
  if(String(info?.id)!==String(debug.data.user_id)) throw Error("Facebook subject mismatch");
  return sanitizeProfile({name:info.name,email:info.email,emailVerified:false},provider,info.id);
}

export async function associateSocialAccount(pool,person,linkUserId="") {
  const conn=await pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query("SELECT pg_advisory_xact_lock(hashtext($1))",[person.provider+":"+person.subject]);
    const linked=await conn.query(
      "SELECT a.* FROM identity_social_accounts s JOIN identity_accounts a ON a.id=s.user_id WHERE s.provider=$1 AND s.subject=$2",
      [person.provider,person.subject]);
    if(linked.rows[0]){
      // An already-linked third-party identity belongs exclusively to that
      // user. Never transfer it to another account during a linking attempt.
      if(linkUserId && String(linked.rows[0].id)!==String(linkUserId)){
        throw Error("Social provider identity already belongs to another account");
      }
      await conn.query("COMMIT");return linked.rows[0];
    }
    if(linkUserId) {
      const owner=await conn.query(
        "SELECT * FROM identity_accounts WHERE id=$1 AND verified_at IS NOT NULL FOR UPDATE",
        [linkUserId]);
      if(!owner.rows[0]) throw Error("Existing account is not verified");
      await conn.query("INSERT INTO identity_social_accounts(provider,subject,user_id) VALUES($1,$2,$3)",
        [person.provider,person.subject,owner.rows[0].id]);
      await conn.query("COMMIT");
      return owner.rows[0];
    }
    // Verified Google-owned Gmail mailboxes may sign into the SAME already
    // verified Media God account as email/password. Never associate by an
    // unverified email, Facebook, or a third-party Google account address.
    // A provider subject already bound to another account is handled above
    // without silently moving its data or its existing sessions.
    const synthetic="social-"+sha(person.provider+":"+person.subject).slice(0,40)+"@login.media-god.invalid";
    let account=null;
    if(person.trustedGoogleMailbox && person.verifiedEmail) {
      await conn.query("SELECT pg_advisory_xact_lock(hashtext($1))",["trusted-google-email:"+person.verifiedEmail]);
      const existing=await conn.query(
        "SELECT * FROM identity_accounts WHERE email=$1 AND verified_at IS NOT NULL FOR UPDATE",
        [person.verifiedEmail]);
      account=existing.rows[0]||null;
    }
    if(!account && person.verifiedEmail) {
      const real=await conn.query(
        "INSERT INTO identity_accounts(id,email,password_hash,full_name,verified_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(email) DO NOTHING RETURNING *",
        [randomUUID(),person.verifiedEmail,"social-only:"+sha(safeToken()),person.fullName]);
      account=real.rows[0]||null;
    }
    if(!account) {
      const alternate=await conn.query(
        "INSERT INTO identity_accounts(id,email,password_hash,full_name,verified_at) VALUES($1,$2,$3,$4,NOW()) RETURNING *",
        [randomUUID(),synthetic,"social-only:"+sha(safeToken()),person.fullName]);
      account=alternate.rows[0];
    }
    await conn.query("INSERT INTO identity_social_accounts(provider,subject,user_id) VALUES($1,$2,$3)",
      [person.provider,person.subject,account.id]);
    await conn.query("COMMIT");
    return account;
  }catch(e){await conn.query("ROLLBACK");throw e;}
  finally{conn.release();}
}

export function createSocialOAuth({pool,issueSession,requireUser,limitRate}) {
  async function initialize() {
    await pool.query("CREATE TABLE IF NOT EXISTS identity_social_accounts(provider TEXT NOT NULL,subject TEXT NOT NULL,user_id UUID NOT NULL REFERENCES identity_accounts(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(provider,subject),UNIQUE(user_id,provider))");
    await pool.query("CREATE TABLE IF NOT EXISTS identity_oauth_states(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,provider TEXT NOT NULL,verifier TEXT NOT NULL,nonce TEXT NOT NULL,return_origin TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)");
    await pool.query("ALTER TABLE identity_oauth_states ADD COLUMN IF NOT EXISTS link_user_id UUID REFERENCES identity_accounts(id) ON DELETE CASCADE");
    await pool.query("CREATE TABLE IF NOT EXISTS identity_oauth_link_intents(token_hash TEXT PRIMARY KEY,user_id UUID NOT NULL REFERENCES identity_accounts(id) ON DELETE CASCADE,provider TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)");

    await pool.query("CREATE TABLE IF NOT EXISTS identity_oauth_tickets(ticket_hash TEXT PRIMARY KEY,user_id UUID NOT NULL REFERENCES identity_accounts(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL)");
    // Explicit approval binds an existing website session to a short-lived
    // random app token. The app never handles a Google OAuth WebView.
    await pool.query("CREATE TABLE IF NOT EXISTS identity_device_logins(token_hash TEXT PRIMARY KEY,code_hash TEXT UNIQUE NOT NULL,provider TEXT NOT NULL,approved_user UUID REFERENCES identity_accounts(id) ON DELETE CASCADE,approved_at TIMESTAMPTZ,expires_at TIMESTAMPTZ NOT NULL)");

  }
  const providers=()=>SOC.map(id=>({id,configured:configured(id)}));
  async function handle(req,res,path,body,origin,respond) {
    if(path==="/auth/providers"&&req.method==="GET") {
      return respond(res,200,{providers:providers()},origin);
    }
    if(path==="/auth/device/start"&&req.method==="POST") {
      const provider=String(body?.provider||"").trim().toLowerCase();
      if(!SOC.includes(provider)||!configured(provider)) {
        return respond(res,503,{error:"This social provider is not yet configured"},origin);
      }
      limitRate(req,"device-start");
      await pool.query("DELETE FROM identity_device_logins WHERE expires_at<NOW()");
      // A code has no permissions itself; only an authenticated owner on the
      // website can approve it. The unguessable token stays on the APK.
      for(let attempt=0;attempt<4;attempt++){
        const code=deviceCode(), deviceToken=safeToken();
        const added=await pool.query(
          "INSERT INTO identity_device_logins(token_hash,code_hash,provider,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes') ON CONFLICT DO NOTHING RETURNING token_hash",
          [sha(deviceToken),sha(code),provider]);
        if(added.rows.length) return respond(res,200,{
          user_code:code,device_token:deviceToken,expires_in:600,interval:3,
          verification_url:site+"/device-login",provider,
        },origin);
      }
      return respond(res,503,{error:"Could not reserve a sign-in code. Try again."},origin);
    }
    if(path==="/auth/device/status"&&req.method==="POST") {
      const deviceToken=String(body?.device_token||"");
      if(!/^[A-Za-z0-9_-]{40,100}$/.test(deviceToken)){
        return respond(res,400,{error:"Invalid sign-in session"},origin);
      }
      const consumed=await pool.query(
        "DELETE FROM identity_device_logins WHERE token_hash=$1 AND expires_at>NOW() AND approved_user IS NOT NULL RETURNING approved_user",
        [sha(deviceToken)]);
      if(consumed.rows[0]){
        const user=await pool.query("SELECT * FROM identity_accounts WHERE id=$1 AND verified_at IS NOT NULL",
          [consumed.rows[0].approved_user]);
        if(!user.rows[0]) return respond(res,401,{error:"Account not verified"},origin);
        return respond(res,200,{status:"approved",...(await issueSession(user.rows[0]))},origin);
      }
      // Approval can occur between the atomic DELETE and this lookup.
      // An unexpired token, even if just approved, must remain pollable.
      // Only DELETE above may consume it and issue a session.
      const pending=await pool.query(
        "SELECT provider FROM identity_device_logins WHERE token_hash=$1 AND expires_at>NOW()",
        [sha(deviceToken)]);
      if(pending.rows[0]) return respond(res,200,{status:"pending"},origin);
      return respond(res,410,{error:"Device sign-in expired or already completed"},origin);
    }
    if(path==="/auth/device/verify"&&req.method==="POST") {
      const owner=await requireUser(req);
      limitRate(req,"device-verify",owner.id);
      const code=normalDeviceCode(body?.user_code);
      if(!validDeviceCode(code)) return respond(res,400,{error:"Enter the eight-character code from Media God"},origin);
      const check=await pool.query(
        "SELECT provider FROM identity_device_logins WHERE code_hash=$1 AND approved_user IS NULL AND expires_at>NOW()",
        [sha(code)]);
      if(!check.rows[0]) return respond(res,404,{error:"Code not found or expired. Request a new code in the app."},origin);
      return respond(res,200,{ready:true,provider:check.rows[0].provider},origin);
    }
    if(path==="/auth/device/approve"&&req.method==="POST") {
      const owner=await requireUser(req);
      limitRate(req,"device-approve",owner.id);
      const code=normalDeviceCode(body?.user_code);
      if(!validDeviceCode(code)) return respond(res,400,{error:"Invalid device code"},origin);
      const claimed=await pool.query(
        "UPDATE identity_device_logins SET approved_user=$2,approved_at=NOW() WHERE code_hash=$1 AND approved_user IS NULL AND expires_at>NOW() RETURNING provider",
        [sha(code),owner.id]);
      if(!claimed.rows[0]) return respond(res,404,{error:"Code already used or expired"},origin);
      return respond(res,200,{ok:true,provider:claimed.rows[0].provider},origin);
    }
    if(path==="/auth/oauth/link/init"&&req.method==="POST") {
      const owner=await requireUser(req);
      limitRate(req,"social-link",owner.id);
      const provider=String(body?.provider||"").trim().toLowerCase();
      if(!SOC.includes(provider)||!configured(provider)) return respond(res,503,{error:"Social provider is not configured"},origin);
      const secret=safeToken();
      await pool.query("DELETE FROM identity_oauth_link_intents WHERE expires_at<NOW()");
      await pool.query(
        "INSERT INTO identity_oauth_link_intents(token_hash,user_id,provider,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '2 minutes')",
        [sha(secret),owner.id,provider]);
      const target=new URL("/auth/oauth/"+provider+"/start",identity);
      target.searchParams.set("return_to",site);
      target.searchParams.set("link_token",secret);
      return respond(res,200,{start_url:target.toString()},origin);
    }
    const routes=/^\/auth\/oauth\/(google|facebook|microsoft|apple)\/(start|callback)$/.exec(path);
    if(routes) {
      const [,provider,action]=routes;
      if(!configured(provider)) {
        if(action==="start") return errorResponse(res,site,"not_configured");
        return respond(res,503,{error:"Social provider not configured"},origin);
      }
      const cfg=providerConfig(provider);
      if(action==="start"&&req.method==="GET") {
        const requestUrl=new URL(req.url,"http://localhost");
        const target=safeReturn(requestUrl.searchParams.get("return_to"));
        // An explicit connect-account action starts with an authenticated,
        // short-lived POST in Settings. Its secret is consumed once before
        // third-party authorisation and binds this OAuth state to the owner.
        const linkToken=String(requestUrl.searchParams.get("link_token")||"");
        let linkUserId=null;
        if(linkToken) {
          if(!/^[A-Za-z0-9_-]{40,100}$/.test(linkToken)) return errorResponse(res,site,"invalid_session");
          const link=await pool.query(
            "DELETE FROM identity_oauth_link_intents WHERE token_hash=$1 AND provider=$2 AND expires_at>NOW() RETURNING user_id",
            [sha(linkToken),provider]);
          if(!link.rows[0]) return errorResponse(res,site,"invalid_session");
          linkUserId=link.rows[0].user_id;
        }
        const browser=safeToken(),state=safeToken(),nonce=safeToken(),verifier=safeToken()+safeToken();
        await pool.query("DELETE FROM identity_oauth_states WHERE expires_at<NOW()");
        await pool.query("INSERT INTO identity_oauth_states(state_hash,browser_hash,provider,verifier,nonce,return_origin,expires_at,link_user_id) VALUES($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '10 minutes',$7)",
          [sha(state),sha(browser),provider,verifier,nonce,target,linkUserId]);
        let authUrl;
        if(provider==="google")authUrl=new URL("https://accounts.google.com/o/oauth2/v2/auth");
        if(provider==="microsoft")authUrl=new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
        if(provider==="facebook")authUrl=new URL("https://www.facebook.com/v24.0/dialog/oauth");
        if(provider==="apple")authUrl=new URL("https://appleid.apple.com/auth/authorize");
        const params=authUrl.searchParams;
        params.set("response_type","code");
        params.set("client_id",cfg.clientId);
        params.set("redirect_uri",cfg.callback);
        params.set("scope",scopes[provider]);
        params.set("state",state);
        if(provider==="google"||provider==="microsoft"){
          params.set("code_challenge",b64u(verifier));
          params.set("code_challenge_method","S256");
          params.set("nonce",nonce);
        }
        if(provider==="apple"){
          params.set("response_mode","form_post");
          params.set("nonce",nonce);
        }
        setBrowserCookie(res,browser);
        return redirect(res,authUrl.toString());
      }
      if(action==="callback"&&(req.method==="GET" || (provider==="apple"&&req.method==="POST"))) {
        let params;
        if(req.method==="GET") params=new URL(req.url,"http://localhost").searchParams;
        else {
          const chunks=[];let length=0;
          for await(const item of req){length+=item.length;if(length>MAX_OAUTH_BODY)throw Error("OAuth callback too large");chunks.push(item);}
          params=new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
        }
        const state=String(params.get("state")||"");
        const code=String(params.get("code")||"");
        const cookie=browserCookie(req);
        if(!/^[A-Za-z0-9_-]{40,100}$/.test(state)||!cookie) return errorResponse(res,site,"invalid_session");
        // Consume the state once, including a failed or cancelled callback.
        const result=await pool.query("DELETE FROM identity_oauth_states WHERE state_hash=$1 AND provider=$2 AND expires_at>NOW() RETURNING *",[sha(state),provider]);
        const row=result.rows[0];
        if(!row||row.browser_hash!==sha(cookie)) return errorResponse(res,site,"invalid_session");
        if(params.has("error")||!code) return errorResponse(res,row.return_origin,"cancelled");
        try {
          const tokens=await exchangeCode(provider,code,row.verifier,cfg);
          const person=await verifiedIdentity(provider,tokens,cfg,row.nonce);
          const user=await associateSocialAccount(pool,person,row.link_user_id||"");
          const ticket=safeToken();
          await pool.query("DELETE FROM identity_oauth_tickets WHERE expires_at<NOW()");
          await pool.query("INSERT INTO identity_oauth_tickets(ticket_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '90 seconds')",[sha(ticket),user.id]);
          // The opaque, single-use exchange ticket is in a URL fragment,
          // never a server request, referral header, or access-token query.
          const target=new URL("/auth/callback",row.return_origin);
          target.hash="ticket="+encodeURIComponent(ticket);
          return redirect(res,target.toString());
        } catch {
          // Don't disclose third-party provider tokens, email or PII.
          return errorResponse(res,row.return_origin,"unavailable");
        }
      }
      return respond(res,405,{error:"Unsupported OAuth method"},origin);
    }
    if(path==="/auth/oauth/exchange"&&req.method==="POST") {
      const ticket=String(body?.ticket||"");
      if(!/^[A-Za-z0-9_-]{40,100}$/.test(ticket)) return respond(res,400,{error:"Invalid social login ticket"},origin);
      const {rows}=await pool.query("DELETE FROM identity_oauth_tickets WHERE ticket_hash=$1 AND expires_at>NOW() RETURNING user_id",[sha(ticket)]);
      if(!rows[0]) return respond(res,401,{error:"Social login expired. Try again."},origin);
      const account=await pool.query("SELECT * FROM identity_accounts WHERE id=$1 AND verified_at IS NOT NULL",[rows[0].user_id]);
      if(!account.rows[0]) return respond(res,401,{error:"Social identity not available"},origin);
      return respond(res,200,await issueSession(account.rows[0]),origin);
    }
    return null;
  }
  return {initialize,providers,handle};
}
