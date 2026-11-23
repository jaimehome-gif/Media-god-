import { test } from "node:test";
import assert from "node:assert/strict";
import { createSocialOAuth, associateSocialAccount } from "./socialOAuth.mjs";

function response(){
  return {
    headers:{},status:0,body:"",
    setHeader(name,value){this.headers[name]=value;},
    writeHead(status){this.status=status;},
    end(data=""){this.body=data;},
  };
}
function apiResponse(res,status,data){
  res.status=status;res.payload=data;
}
function fakePool() {
  const queries=[];
  return {
    queries,
    async query(sql,values=[]){queries.push({sql,values});return {rows:[]};},
  };
}
const noSession=async()=>{throw Error("Must not create a session");};
const getRequest=url=>({method:"GET",url,headers:{origin:""}});
const postRequest=()=>({method:"POST",url:"/auth/oauth/exchange",headers:{origin:""}});
const setProvider=(provider,clientId="test-client",clientSecret="test-secret")=>{
  const prefix=provider.toUpperCase();
  process.env[prefix+"_CLIENT_ID"]=clientId;
  process.env[prefix+"_CLIENT_SECRET"]=clientSecret;
};
const unsetProvider=provider=>{
  const prefix=provider.toUpperCase();
  delete process.env[prefix+"_CLIENT_ID"];
  delete process.env[prefix+"_CLIENT_SECRET"];
};

test("the original four social providers appear even when no credentials are configured",async()=>{
  const pool=fakePool();
  const oauth=createSocialOAuth({pool,issueSession:noSession});
  const res=response();
  await oauth.handle(getRequest("/auth/providers"),res,"/auth/providers",{},"",apiResponse);
  assert.equal(res.status,200);
  assert.deepEqual(res.payload.providers.map(p=>p.id),["google","facebook","microsoft","apple"]);
  assert.ok(res.payload.providers.every(p=>typeof p.configured==="boolean"));
});

test("provider start is disabled safely without configured OAuth client",async()=>{
  unsetProvider("google");
  const oauth=createSocialOAuth({pool:fakePool(),issueSession:noSession});
  const res=response();
  await oauth.handle(getRequest("/auth/oauth/google/start"),res,"/auth/oauth/google/start",{},"",apiResponse);
  assert.equal(res.status,303);
  assert.match(res.headers.Location,/^https:\/\/www\.underworldhub\.co\.uk\/login\?social_error=not_configured$/);
});

test("Google OAuth start uses server-stored state, PKCE, nonce, browser-binding cookie and a fixed callback",async()=>{
  setProvider("google");
  try{
    const pool=fakePool();
    const oauth=createSocialOAuth({pool,issueSession:noSession});
    const res=response();
    await oauth.handle(getRequest("/auth/oauth/google/start?return_to=https%3A%2F%2Fevil.example%2Flogin"),
      res,"/auth/oauth/google/start",{},"",apiResponse);
    assert.equal(res.status,303);
    const url=new URL(res.headers.Location);
    assert.equal(url.origin,"https://accounts.google.com");
    assert.equal(url.searchParams.get("client_id"),"test-client");
    assert.equal(url.searchParams.get("redirect_uri"),"https://media-god-identity-api-production.up.railway.app/auth/oauth/google/callback");
    assert.equal(url.searchParams.get("code_challenge_method"),"S256");
    assert.ok(url.searchParams.get("code_challenge")?.length>=40);
    assert.ok(url.searchParams.get("nonce")?.length>=40);
    assert.match(res.headers["Set-Cookie"],/HttpOnly; Secure; SameSite=None/);
    const inserted=pool.queries.find(q=>q.sql.startsWith("INSERT INTO identity_oauth_states"));
    assert.ok(inserted,"OAuth state stored in PostgreSQL");
    assert.equal(inserted.values[5],"https://www.underworldhub.co.uk","external redirect rejected");
    assert.notEqual(inserted.values[0],url.searchParams.get("state"),"raw OAuth state is never stored");
  }finally{unsetProvider("google");}
});

test("Facebook OAuth uses only its configured client and server callback",async()=>{
  setProvider("facebook");
  try{
    const pool=fakePool(),res=response();
    const oauth=createSocialOAuth({pool,issueSession:noSession});
    await oauth.handle(getRequest("/auth/oauth/facebook/start"),res,"/auth/oauth/facebook/start",{},"",apiResponse);
    const url=new URL(res.headers.Location);
    assert.equal(url.origin,"https://www.facebook.com");
    assert.equal(url.searchParams.get("client_id"),"test-client");
    assert.equal(url.searchParams.get("redirect_uri"),"https://media-god-identity-api-production.up.railway.app/auth/oauth/facebook/callback");
    assert.ok(url.searchParams.has("state"));
  }finally{unsetProvider("facebook");}
});

test("Microsoft OAuth uses PKCE and nonce before any account can sign in",async()=>{
  setProvider("microsoft");
  try{
    const res=response();
    const oauth=createSocialOAuth({pool:fakePool(),issueSession:noSession});
    await oauth.handle(getRequest("/auth/oauth/microsoft/start"),res,"/auth/oauth/microsoft/start",{},"",apiResponse);
    const url=new URL(res.headers.Location);
    assert.match(url.pathname,/\/common\/oauth2\/v2\.0\/authorize$/);
    assert.equal(url.searchParams.get("code_challenge_method"),"S256");
    assert.ok(url.searchParams.get("nonce"));
  }finally{unsetProvider("microsoft");}
});

test("invalid OAuth ticket cannot establish an account session",async()=>{
  const res=response();
  const oauth=createSocialOAuth({pool:fakePool(),issueSession:noSession});
  await oauth.handle(postRequest(),res,"/auth/oauth/exchange",{ticket:"invalid"},"",apiResponse);
  assert.equal(res.status,400);
  assert.match(res.payload.error,/Invalid social login ticket/);
});

test("callback without the correct browser cookie is rejected, never exchanged",async()=>{
  setProvider("google");
  try{
    const res=response(),pool=fakePool();
    const oauth=createSocialOAuth({pool,issueSession:noSession});
    await oauth.handle(getRequest("/auth/oauth/google/callback?state=abcdef&code=123"),
      res,"/auth/oauth/google/callback",{},"",apiResponse);
    assert.equal(res.status,303);
    assert.match(res.headers.Location,/social_error=invalid_session/);
    assert.equal(pool.queries.length,0);
  }finally{unsetProvider("google");}
});

function accountPool({emailAccount=null,existingProviderAccount=null}={}) {
  const queries=[], links=[];
  let insertedAccounts=0;
  const conn={
    async query(sql,args=[]) {
      queries.push({sql,args});
      if(sql.startsWith("SELECT a.* FROM identity_social_accounts")) {
        return {rows:existingProviderAccount?[existingProviderAccount]:[]};
      }
      if(sql.startsWith("SELECT * FROM identity_accounts WHERE email=$1")) {
        return {rows:emailAccount?[emailAccount]:[]};
      }
      if(sql.startsWith("INSERT INTO identity_accounts")) {
        if(sql.includes("ON CONFLICT(email)") && emailAccount) return {rows:[]};
        insertedAccounts++;
        return {rows:[{id:"new-"+insertedAccounts,email:args[1],verified_at:new Date()}]};
      }
      if(sql.startsWith("INSERT INTO identity_social_accounts")) links.push(args);
      return {rows:[]};
    },
    release(){}
  };
  return {
    queries,links,
    get insertedAccounts(){return insertedAccounts;},
    async connect(){return conn;}
  };
}

test("Google verified Gmail signs into the same independently verified email account",async()=>{
  const canonical={id:"independent-user",email:"test@gmail.com",verified_at:new Date(),password_hash:"existing-hash"};
  const pool=accountPool({emailAccount:canonical});
  const user=await associateSocialAccount(pool,{
    provider:"google",subject:"google-sub-1",verifiedEmail:"test@gmail.com",
    fullName:"Test",trustedGoogleMailbox:true,
  });
  assert.equal(user.id,canonical.id);
  assert.equal(user.password_hash,canonical.password_hash);
  assert.equal(pool.insertedAccounts,0,"never create a duplicate account");
  assert.deepEqual(pool.links,[["google","google-sub-1",canonical.id]]);
  assert.ok(pool.queries.some(x=>x.sql.includes("verified_at IS NOT NULL FOR UPDATE")));
});

test("Unverified or third-party Google-email claims cannot attach an existing account",async()=>{
  const canonical={id:"real-user",email:"test@example.net",verified_at:new Date()};
  const pool=accountPool({emailAccount:canonical});
  const user=await associateSocialAccount(pool,{
    provider:"google",subject:"google-sub-2",verifiedEmail:"test@example.net",
    fullName:"Test",trustedGoogleMailbox:false,
  });
  assert.notEqual(user.id,canonical.id);
  assert.match(user.email,/^social-[a-f0-9]{40}@login\.media-god\.invalid$/);
  assert.deepEqual(pool.links,[["google","google-sub-2",user.id]]);
});

test("Already linked Google profiles are never overwritten or silently merged",async()=>{
  const old={id:"existing-provider-profile",email:"social-existing@login.media-god.invalid"};
  const pool=accountPool({emailAccount:{id:"new-email-account"},existingProviderAccount:old});
  const user=await associateSocialAccount(pool,{
    provider:"google",subject:"previously-bound",verifiedEmail:"test@gmail.com",
    fullName:"Test",trustedGoogleMailbox:true,
  });
  assert.equal(user.id,old.id);
  assert.equal(pool.links.length,0);
  assert.equal(pool.insertedAccounts,0);
  assert.ok(!pool.queries.some(x=>x.sql.startsWith("SELECT * FROM identity_accounts WHERE email=$1")));
});

test("All social accounts still require a verified provider subject",async()=>{
  const social=await import("./socialOAuth.mjs");
  const source=String(social.associateSocialAccount);
  assert.match(source,/SELECT a\.\* FROM identity_social_accounts/);
  assert.match(source,/person\.trustedGoogleMailbox && person\.verifiedEmail/);
});

test("verified existing account may explicitly connect another social provider without replacing its history",async()=>{
  const existing={id:"owner-verified",email:"owner@gmail.com",verified_at:new Date(),password_hash:"unchanged"};
  const queries=[],links=[];
  const db={
    async connect(){
      return {
        async query(sql,args=[]){
          queries.push({sql,args});
          if(sql.startsWith("SELECT a.* FROM identity_social_accounts")) return {rows:[]};
          if(sql.startsWith("SELECT * FROM identity_accounts WHERE id=$1 AND verified_at")) return {rows:[existing]};
          if(sql.startsWith("INSERT INTO identity_social_accounts")) links.push(args);
          return {rows:[]};
        },
        release(){}
      };
    }
  };
  const user=await associateSocialAccount(db,{
    provider:"microsoft",subject:"verified-ms-subject",verifiedEmail:"",
    fullName:"Owner",trustedGoogleMailbox:false,
  },existing.id);
  assert.equal(user.id,existing.id);
  assert.equal(user.password_hash,"unchanged");
  assert.deepEqual(links,[["microsoft","verified-ms-subject",existing.id]]);
  assert.ok(!queries.some(x=>x.sql.startsWith("INSERT INTO identity_accounts")));
});

test("social link cannot seize an identity already connected to another account",async()=>{
  const owner={id:"different-user",email:"private@example.net"};
  const pool=accountPool({existingProviderAccount:owner});
  await assert.rejects(
    () => associateSocialAccount(pool,{
      provider:"facebook",subject:"facebook-existing",verifiedEmail:"",
      fullName:"Different",trustedGoogleMailbox:false,
    },"owner-verified"),/already belongs to another account/);
  assert.equal(pool.links.length,0);
});

test("authenticated one-time social connection intent returns only an approved backend URL",async()=>{
  setProvider("microsoft");
  try{
    const queries=[];
    const pool={
      async query(sql,args=[]){queries.push({sql,args});return {rows:[]};}
    };
    const oauth=createSocialOAuth({
      pool,issueSession:noSession,
      requireUser:async()=>({id:"owner-user",email:"owner@gmail.com"}),
      limitRate:()=>{}
    });
    const res=response();
    await oauth.handle(postRequest(),res,"/auth/oauth/link/init",
      {provider:"microsoft"},"",apiResponse);
    assert.equal(res.status,200);
    const target=new URL(res.payload.start_url);
    assert.equal(target.origin,"https://media-god-identity-api-production.up.railway.app");
    assert.equal(target.pathname,"/auth/oauth/microsoft/start");
    assert.ok(target.searchParams.get("link_token")?.length>=40);
    assert.ok(queries.some(x=>x.sql.startsWith("INSERT INTO identity_oauth_link_intents") &&
      x.args[1]==="owner-user" && x.args[2]==="microsoft"));
  }finally{unsetProvider("microsoft");}
});

test("Apple independent callback uses verified dedicated subdomain only when configured",async()=>{
  const previous=process.env.APPLE_REDIRECT_URI;
  process.env.APPLE_CLIENT_ID="test-services-id";
  process.env.APPLE_TEAM_ID="test-team";
  process.env.APPLE_KEY_ID="test-key";
  process.env.APPLE_PRIVATE_KEY="test-private-key";
  try{
    process.env.APPLE_REDIRECT_URI="https://auth.underworldhub.co.uk/auth/oauth/apple/callback";
    const pool=fakePool(), res=response(), oauth=createSocialOAuth({pool,issueSession:noSession});
    await oauth.handle(getRequest("/auth/oauth/apple/start"),res,"/auth/oauth/apple/start",{},"",apiResponse);
    const target=new URL(res.headers.Location);
    assert.equal(target.origin,"https://appleid.apple.com");
    assert.equal(target.searchParams.get("redirect_uri"),process.env.APPLE_REDIRECT_URI);
    assert.equal(target.searchParams.get("response_mode"),"form_post");
    assert.ok(target.searchParams.has("nonce"));
  }finally{
    if(previous===undefined)delete process.env.APPLE_REDIRECT_URI;
    else process.env.APPLE_REDIRECT_URI=previous;
    for(const key of ["APPLE_CLIENT_ID","APPLE_TEAM_ID","APPLE_KEY_ID","APPLE_PRIVATE_KEY"])delete process.env[key];
  }
});
