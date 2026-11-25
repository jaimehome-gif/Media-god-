/**
 * Compatibility facade for the independent Jaime Home service.
 * The export name "base44" is retained temporarily so existing Media God
 * components can migrate without rewriting every import in one release.
 * This module does NOT import the Base44 SDK or call a Base44 endpoint.
 */
import {
  invokeIndependentMetadata,
  invokeIndependentImdbResolver,
  invokeIndependentAddonSources,
  invokeIndependentPublicFeature,
} from "./independentMetadata.js";

export const IDENTITY_API = "https://media-god-identity-api-production.up.railway.app";
export const RD_API = "https://media-god-rd-independent-api-production.up.railway.app";
const SESSION_KEY = "mg:jaime-home-session:v1";
const AUTH_ERROR = "Please sign in to Media God again. Your existing verified email address is still valid; there is no need to create a different account.";
const PUBLIC_FUNCTIONS = new Set(["getTmdbMovies","resolveImdb","resolveTvImdb","fetchAddonStreams","getEntertainmentNews","getSkipSegments","getFireTvApkLink"]);
const PRIVATE_FUNCTIONS = new Set(["realDebrid","realDebridAuth","multiDebrid","findRdLibrary"]);
const cleanName = n => String(n||"").trim();
const storage = () => {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
};
export const getIndependentSessionToken = () => storage()?.getItem(SESSION_KEY) || "";
export const saveIndependentSessionToken = value => {
  if (value) storage()?.setItem(SESSION_KEY,String(value));
  else storage()?.removeItem(SESSION_KEY);
};
const asError = (response, data) => {
  const error = new Error(String(data?.error || data?.message || "Media God service request failed"));
  error.status = response.status;
  error.code = data?.code || "REQUEST_FAILED";
  error.response = { status: response.status, data };
  return error;
};
// A gateway rate limit applies across torrent choices in the same session.
let playbackCooldown = { session: "", until: 0 };
const playbackRateLimitError = seconds => {
  const error = new Error(`Real-Debrid is busy. Try again in ${seconds} seconds.`);
  error.status = 429;
  error.code = "RD_RATE_LIMITED";
  error.response = { status: 429, data: { retry_after: seconds } };
  return error;
};
const call = async (endpoint, path, { method="GET", body, token=getIndependentSessionToken(), timeoutMs=20000 }={}) => {
  const playbackRequest = endpoint === RD_API && path === "/functions/realDebrid";
  if (playbackRequest && playbackCooldown.session === token && playbackCooldown.until > Date.now()) {
    throw playbackRateLimitError(Math.ceil((playbackCooldown.until - Date.now()) / 1000));
  }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response = await fetch(endpoint+path,{
      method,
      headers:{
        ...(body!==undefined?{"Content-Type":"application/json"}:{}),
        ...(token?{"Authorization":"Bearer "+token}:{})
      },
      ...(body!==undefined?{body:JSON.stringify(body)}:{}),
      credentials:"omit",cache:"no-store",signal:controller.signal
    });
    const data = await response.json().catch(()=>({}));
    if (playbackRequest && response.status === 429) {
      const delay = response.headers?.get?.("Retry-After") || data?.retry_after;
      const seconds = Number(delay) > 0 ? Number(delay) : (Date.parse(delay) - Date.now()) / 1000;
      const wait = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
      const until = Date.now() + wait * 1000;
      playbackCooldown = { session: token, until: Math.max(until, playbackCooldown.session === token ? playbackCooldown.until : 0) };
      throw playbackRateLimitError(Math.ceil((playbackCooldown.until - Date.now()) / 1000));
    }
    if (!response.ok) throw asError(response,data);
    return data;
  } catch(error) {
    if (error?.name==="AbortError") {
      const e = new Error("Media God request timed out. Please retry.");
      e.code="NETWORK_TIMEOUT";
      throw e;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
const auth = {
  // Legacy-account linking and recovery need the independent session helpers.
  // Keep the verified Railway session separate from Base44 provider tokens.
  getAccessToken: getIndependentSessionToken,
  setToken: saveIndependentSessionToken,
  async getRegistrationConfig() {
    return call(IDENTITY_API,"/auth/config",{token:"",timeoutMs:8000});
  },
  async getSocialProviders() {
    return call(IDENTITY_API,"/auth/providers",{token:"",timeoutMs:8000});
  },
  async startDeviceSocialLogin(provider) {
    return call(IDENTITY_API,"/auth/device/start",{
      method:"POST",body:{provider},token:"",timeoutMs:15000
    });
  },
  async pollDeviceSocialLogin(deviceToken) {
    const result=await call(IDENTITY_API,"/auth/device/status",{
      method:"POST",body:{device_token:deviceToken},token:"",timeoutMs:12000
    });
    if(result.status==="approved" && result.access_token){
      saveIndependentSessionToken(result.access_token);
    }
    return result;
  },
  async verifyDeviceSocialLogin(userCode) {
    return call(IDENTITY_API,"/auth/device/verify",{
      method:"POST",body:{user_code:userCode},timeoutMs:10000
    });
  },
  async approveDeviceSocialLogin(userCode) {
    return call(IDENTITY_API,"/auth/device/approve",{
      method:"POST",body:{user_code:userCode},timeoutMs:10000
    });
  },
  async connectSocialProvider(provider) {
    if(!["google","facebook","microsoft","apple"].includes(provider)) {
      throw new Error("Unknown sign-in provider");
    }
    const result=await call(IDENTITY_API,"/auth/oauth/link/init",{
      method:"POST",body:{provider},timeoutMs:12000
    });
    const redirect=new URL(result.start_url || "");
    if(redirect.origin!==IDENTITY_API ||
       redirect.pathname!=="/auth/oauth/"+provider+"/start") {
      throw new Error("Untrusted social connection destination");
    }
    if(typeof window==="undefined") throw new Error("Browser required");
    window.location.assign(redirect.toString());
  },
  loginWithProvider(provider,returnTo) {
    if(!["google","facebook","microsoft","apple"].includes(provider)) {
      throw new Error("Unsupported social login provider");
    }
    if(typeof window==="undefined") throw new Error("Social login requires a browser");
    const start=new URL("/auth/oauth/"+provider+"/start",IDENTITY_API);
    // The backend allows only the independently hosted app's fixed origins.
    start.searchParams.set("return_to",returnTo || window.location.origin);
    window.location.assign(start.toString());
  },
  async exchangeSocialTicket(ticket) {
    if(typeof ticket!=="string" || ticket.length<40 || ticket.length>100) {
      throw new Error("Missing social sign-in ticket");
    }
    const result=await call(IDENTITY_API,"/auth/oauth/exchange",{
      method:"POST",body:{ticket},token:"",timeoutMs:12000
    });
    saveIndependentSessionToken(result.access_token);
    return result;
  },
  async loginViaEmailPassword(email,password) {
    const result = await call(IDENTITY_API,"/auth/login",{method:"POST",body:{email,password},token:""});
    saveIndependentSessionToken(result.access_token);
    return result;
  },
  async register({email,password,name}={}) {
    return call(IDENTITY_API,"/auth/register",{method:"POST",body:{email,password,name},token:""});
  },
  async verifyEmail(verifyToken) {
    return call(IDENTITY_API,"/auth/verify",{method:"POST",body:{token:verifyToken},token:""});
  },
  async resendOtp(email) {
    return call(IDENTITY_API,"/auth/resend-verification",{method:"POST",body:{email},token:""});
  },
  async me() {
    if (!getIndependentSessionToken()) {
      const e=new Error(AUTH_ERROR);
      e.status=401;
      throw e;
    }
    return call(IDENTITY_API,"/auth/me");
  },
  async isAuthenticated() {
    try { await auth.me(); return true; }
    catch { return false; }
  },
  // Works only with a currently valid authenticated session; unlocks
  // failed sign-in attempts for this account on the user's other devices.
  async unlockLogin() {
    return call(IDENTITY_API,"/auth/unlock-login",{method:"POST",body:{}});
  },
  async updateMe(patch={}) {
    return call(IDENTITY_API,"/auth/me",{method:"PATCH",body:patch});
  },
  async logout(returnTo) {
    // Clear the old session immediately. A delayed revocation response must
    // never erase a different session created by a subsequent login.
    const previousToken=getIndependentSessionToken();
    saveIndependentSessionToken("");
    try {
      if (previousToken) await call(IDENTITY_API,"/auth/logout",{method:"POST",body:{},token:previousToken});
    } catch { /* Local sign-out still succeeds when the network is down. */ }
    if (returnTo && typeof window!=="undefined" && !getIndependentSessionToken()) window.location.assign(returnTo);
  },
  setToken: saveIndependentSessionToken,
  getAccessToken: getIndependentSessionToken,
  async resetPasswordRequest(email) {
    return call(IDENTITY_API,"/auth/reset-request",{method:"POST",body:{email},token:""});
  },
  async resetPassword({resetToken,newPassword}) {
    return call(IDENTITY_API,"/auth/reset",{method:"POST",body:{token:resetToken,password:newPassword},token:""});
  },

};
function requireSession() {
  if (getIndependentSessionToken()) return;
  const error=new Error(AUTH_ERROR);
  error.status=401;
  throw error;
}
function entityAccess(entity) {
  const name = cleanName(entity);
  const endpoint = "/entities/"+encodeURIComponent(name);
  const list = async (filter={},sort="-updated_date",limit=100,skip=0) => {
    requireSession();
    const query = new URLSearchParams({
      filter: JSON.stringify(filter||{}),
      sort: String(sort||"-updated_date"),
      limit: String(Math.min(500,Number(limit)||100)),
      skip: String(Math.max(0,Number(skip)||0))
    });
    return call(IDENTITY_API,endpoint+"?"+query.toString());
  };
  return {
    list: (sort="-updated_date",limit=100,skip=0) => list({},sort,limit,skip),
    filter: (filter={},sort="-updated_date",limit=100,skip=0) => list(filter,sort,limit,skip),
    get: id => {
      requireSession();
      return call(IDENTITY_API,endpoint+"/"+encodeURIComponent(id));
    },
    create: data => { requireSession(); return call(IDENTITY_API,endpoint,{method:"POST",body:data}); },
    update: (id,data) => { requireSession(); return call(IDENTITY_API,endpoint+"/"+encodeURIComponent(id),{method:"PATCH",body:data}); },
    delete: id => { requireSession(); return call(IDENTITY_API,endpoint+"/"+encodeURIComponent(id),{method:"DELETE"}); },
    bulkCreate: async rows => Promise.all((rows||[]).map(data=>entityAccess(name).create(data))),
    // Shared real-time watch-party entities will need an independent
    // authenticated subscription service before the new site is promoted.
    subscribe: () => () => {},
  };
}
const entities = new Proxy({}, {
  get: (_target,name) => typeof name==="string" ? entityAccess(name) : undefined
});
async function invoke(name,payload={}) {
  const functionName=cleanName(name);
  if (functionName==="getTmdbMovies") return invokeIndependentMetadata(payload);
  if (functionName==="resolveImdb"||functionName==="resolveTvImdb") {
    return invokeIndependentImdbResolver(functionName,payload);
  }
  if (functionName==="getEntertainmentNews"||functionName==="getSkipSegments"||functionName==="getFireTvApkLink") {
    return invokeIndependentPublicFeature(functionName,payload);
  }
  if (functionName==="fetchAddonStreams") {
    if (getIndependentSessionToken()) {
      try {
        const data=await call(RD_API,"/functions/fetchAddonStreams",{method:"POST",body:payload,timeoutMs:30000});
        return {data};
      } catch(error) {
        if (![401,403,429,500,502,503,504].includes(error.status)) throw error;
      }
    }
    return invokeIndependentAddonSources(payload);
  }
  if (PRIVATE_FUNCTIONS.has(functionName)) {
    requireSession();
    const accountPayload = { ...payload };
    delete accountPayload.guest_device_key;
    const data=await call(RD_API,"/functions/"+functionName,{method:"POST",body:accountPayload,timeoutMs:125000});
    return {data};
  }
  if (!PUBLIC_FUNCTIONS.has(functionName)) {
    const error=new Error(functionName+" is not yet available on the independent Media God backend.");
    error.code="MIGRATION_PENDING_FUNCTION";
    throw error;
  }
  throw new Error("Unsupported Media God function");
}
const support = {
  createTicket: details => call(IDENTITY_API,"/support/tickets",{method:"POST",body:details,token:""}),
  ticket: (id,key) => call(IDENTITY_API,"/support/tickets/"+encodeURIComponent(id)+"?key="+encodeURIComponent(key),{token:""}),
  customerReply: (id,key,message) => call(IDENTITY_API,"/support/tickets/"+encodeURIComponent(id)+"/reply",{method:"POST",body:{key,message},token:""}),
  staffTickets: () => call(IDENTITY_API,"/support/admin/tickets"),
  staffTicket: id => call(IDENTITY_API,"/support/admin/tickets/"+encodeURIComponent(id)),
  staffReply: (id,message) => call(IDENTITY_API,"/support/admin/tickets/"+encodeURIComponent(id)+"/reply",{method:"POST",body:{message}}),
  staffStatus: (id,status) => call(IDENTITY_API,"/support/admin/tickets/"+encodeURIComponent(id)+"/status",{method:"POST",body:{status}})
};
export const base44 = { auth, entities, functions:{invoke}, support };
