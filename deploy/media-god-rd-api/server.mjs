import http from "node:http";
import { createHmac } from "node:crypto";
import { deviceClient } from "./deviceClient.mjs";
import realDebrid from "./realDebrid.mjs";
import realDebridAuth from "./realDebridAuth.mjs";
import findRdLibrary from "./findRdLibrary.mjs";
import multiDebrid from "./multiDebrid.mjs";
import fetchAddonStreams from "./fetchAddonStreams.mjs";

const VERIFY_URL = process.env.IDENTITY_VERIFY_URL;
const ACCOUNT_KEY = process.env.RD_ACCOUNT_DERIVATION_KEY;
const allowed = new Set(
  String(process.env.ALLOWED_ORIGINS || "https://underworldhub.co.uk,https://www.underworldhub.co.uk")
    .split(",").map(x=>x.trim()).filter(Boolean)
);
if (!VERIFY_URL || !ACCOUNT_KEY || ACCOUNT_KEY.length<32) {
  throw new Error("Identity verifier and account derivation secret are required");
}
const handlers = Object.freeze({
  "/functions/realDebrid": realDebrid,
  "/functions/realDebridAuth": realDebridAuth,
  "/functions/findRdLibrary": findRdLibrary,
  "/functions/multiDebrid": multiDebrid,
  "/functions/fetchAddonStreams": fetchAddonStreams,
});
const rate = new Map();
const pending = new Map();
const LIMIT = 220;
const WINDOW = 60000;

function reply(res,status,data,origin="") {
  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin",origin);
    res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age","120");
    res.setHeader("Vary","Origin");
  }
  res.setHeader("Cache-Control","private,no-store");
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.writeHead(status);
  res.end(status===204?"":JSON.stringify(data));
}
function limited(key) {
  const now=Date.now(), prev=rate.get(key);
  const next=prev&&prev.until>now?prev:{count:0,until:now+WINDOW};
  next.count++;
  rate.set(key,next);
  if (rate.size>5000) for(const [k,v] of rate) if(v.until<=now)rate.delete(k);
  return next.count>LIMIT;
}
async function verifyIdentity(header) {
  const match=/^Bearer ([A-Za-z0-9_-]{30,200})$/.exec(String(header||""));
  if (!match) return null;
  try {
    const response=await fetch(VERIFY_URL,{
      method:"GET",
      headers:{Authorization:"Bearer "+match[1]},
      signal:AbortSignal.timeout(5000),
      cache:"no-store"
    });
    if (response.status===401 || response.status===403) return null;
    if (!response.ok) throw Error("Identity service unavailable");
    const user=await response.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(user?.id||""))) return null;
    // The independently verified account receives one stable encrypted
    // Real-Debrid credential store across all of its devices. Its private
    // capability never goes to the client and is not logged.
    const capability=createHmac("sha256",ACCOUNT_KEY)
      .update("mg-account-rd-v1:"+user.id).digest("hex");
    return await deviceClient("Device "+capability);
  }catch {
    throw Error("Account verification temporarily unavailable");
  }
}
async function exclusive(id,work) {
  const previous=pending.get(id)||Promise.resolve();
  let release;
  const current=new Promise(resolve=>release=resolve);
  pending.set(id,current);
  await previous;
  try{return await work();}
  finally{release();if(pending.get(id)===current)pending.delete(id);}
}
async function serve(req,res) {
  const origin=String(req.headers.origin||"");
  if (origin&&!allowed.has(origin)) return reply(res,403,{error:"Origin not allowed"});
  const path=String(req.url||"/").split("?")[0];
  if (path==="/health"&&req.method==="GET") {
    return reply(res,200,{status:"ready",service:"media-god-rd-independent",auth:"jaime-home"},origin);
  }
  if (!Object.hasOwn(handlers,path)) return reply(res,404,{error:"Not found"},origin);
  if (req.method==="OPTIONS") return reply(res,204,{},origin);
  if (req.method!=="POST") return reply(res,405,{error:"POST required"},origin);
  let verified;
  try { verified=await verifyIdentity(req.headers.authorization); }
  catch { return reply(res,503,{error:"Account verification temporarily unavailable"},origin); }
  if (!verified) return reply(res,401,{error:"Sign in to your new Media God account"},origin);
  if (limited(verified.user.id)) return reply(res,429,{error:"Too many requests. Try shortly."},origin);
  let size=0,parts=[],body;
  try {
    for await(const item of req) {
      size+=item.length;
      if (size>131072) return reply(res,413,{error:"Request too large"},origin);
      parts.push(item);
    }
    body=JSON.parse(Buffer.concat(parts).toString("utf8")||"{}");
    if (!body||typeof body!=="object"||Array.isArray(body)) throw Error("Invalid JSON");
  }catch{return reply(res,400,{error:"Invalid JSON"},origin);}
  if (["rd_token","rd_refresh_token","rd_client_secret","user_id","guest_device_key","authorization","access_token"].some(k=>k in body)) {
    return reply(res,400,{error:"Credentials cannot be supplied in requests"},origin);
  }
  const action=/^[a-z_]{1,40}$/i.test(String(body.action||""))?body.action:"unknown";
  try {
    const request=new Request("http://127.0.0.1"+path,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    const result=await exclusive(verified.user.id,async () => {
      const currentUser = await verified.client.auth.me();
      Object.defineProperties(request,{
        __mediaGodVerifiedClient:{value:verified.client},
        __mediaGodVerifiedUserId:{value:verified.user.id},
        __mediaGodVerifiedUser:{value:currentUser}
      });
      return handlers[path](request);
    });
    if (result.status===401||result.status>=500) {
      console.warn("[rd-independent] request rejected",{action,function:path.slice(11),status:result.status});
    }
    const raw=await result.text();
    if (raw.length>2000000) return reply(res,502,{error:"Response too large"},origin);
    let data;
    try{data=JSON.parse(raw||"{}");}
    catch{return reply(res,502,{error:"Unexpected provider response"},origin);}
    return reply(res,result.status,data,origin);
  }catch{
    return reply(res,502,{error:"Real-Debrid request unavailable. Retry or reconnect this account."},origin);
  }
}
http.createServer((req,res)=>{
  res.setTimeout(125000);
  void serve(req,res).catch(()=>reply(res,500,{error:"Server error"},String(req.headers.origin||"")));
}).listen(Number(process.env.PORT||3000),"0.0.0.0");
