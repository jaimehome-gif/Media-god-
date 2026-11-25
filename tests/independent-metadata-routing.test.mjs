import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { base44 } from "../src/api/base44Client.js";
import {
  INDEPENDENT_METADATA_API_URL,
  invokeIndependentMetadata,
  invokeIndependentImdbResolver,
  invokeIndependentAddonSources,
  invokeIndependentPublicFeature,
} from "../src/api/independentMetadata.js";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const storage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    get length() { return values.size; },
    key: index => [...values.keys()][index] || null,
    keys: () => [...values.keys()],
  };
};


// Exercise the actual independent facade, with a signed-in synthetic user.
// The former SDK/rawInvoke/device fallback was deliberately retired.
async function withPublicFacade(run) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const calls = [];
  let offline = false;
  Object.defineProperty(globalThis, "window", {configurable:true,writable:true,
    value:{localStorage:storage(),sessionStorage:storage()}});
  base44.auth.setToken("SYNTHETIC_ACCOUNT_BEARER");
  globalThis.fetch = async (url, options) => {
    calls.push({url:String(url),options});
    if (offline) return {ok:false,status:503,json:async()=>({error:"Synthetic outage"})};
    const result = String(url).includes("resolve") ? {imdb_id:"tt1234567"} : {movies:[]};
    return {ok:true,status:200,json:async()=>result};
  };
  try { await run(calls, () => { offline = true; }); }
  finally {
    base44.auth.setToken("");
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis,"window",originalWindow);
    else delete globalThis.window;
  }
}
function assertPublicCall(call,name) {
  assert.equal(call.url, INDEPENDENT_METADATA_API_URL.replace("getTmdbMovies",name));
  assert.equal(call.options.method,"POST");
  assert.equal(call.options.credentials,"omit");
  assert.equal(call.options.headers.Authorization,undefined);
  assert.doesNotMatch(call.options.body,/SYNTHETIC_ACCOUNT_BEARER|SYNTHETIC_SECRET|rd_token|guest_device_key/);
}

test("public TMDB catalogue invokes independent Railway service without Base44 tokens", async () => {
  let url = "", options;
  const data = { movies: [{ id: 123, title: "Example" }] };
  const result = await invokeIndependentMetadata(
    { media_type: "movie", page: 1 },
    {
      fetchImpl: async (endpoint, init) => {
        url = endpoint;
        options = init;
        return { ok: true, json: async () => data };
      },
      storage: storage(),
    },
  );
  assert.equal(url, INDEPENDENT_METADATA_API_URL);
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "omit");
  assert.doesNotMatch(JSON.stringify(options), /authorization|rd_token|base44_access_token/i);
  assert.deepEqual(result.data, data);
});

test("public metadata cache survives a temporary endpoint outage without deleting history", async () => {
  const local = storage();
  const request = { media_type: "tv", page: 2 };
  const answer = { movies: [{ id: 321, name: "Example TV" }] };
  await invokeIndependentMetadata(request, {
    fetchImpl: async () => ({ ok: true, json: async () => answer }),
    storage: local,
  });
  const cached = await invokeIndependentMetadata(request, {
    fetchImpl: async () => { throw new Error("offline"); },
    storage: local,
  });
  assert.deepEqual(cached.data, answer);
  assert.equal(cached.stale, true);
  assert.ok(local.keys().every(key => key.startsWith("mg:public-tmdb-cache:")),
    "Never touch Continue Watching, login or user profile data");
});

test("no silent return to Base44 credits for public catalogue requests", async () => {
  const client = read("src/api/base44Client.js");
  assert.doesNotMatch(client, /@base44\/sdk|rawInvoke\(|railwayDeviceToken\(/);
  const metadata = read("src/api/independentMetadata.js");
  assert.doesNotMatch(metadata, /base44\.functions\.invoke|rd_token|asServiceRole/);
  await withPublicFacade(async (calls,goOffline) => {
    await base44.functions.invoke("getTmdbMovies", {media_type:"movie",page:1,rd_token:"SYNTHETIC_SECRET"});
    assert.equal(calls.length,1);
    assertPublicCall(calls[0],"getTmdbMovies");
    goOffline();
    await assert.rejects(base44.functions.invoke("getTmdbMovies",{media_type:"movie",page:2}),/temporarily unavailable/);
    assert.equal(calls.length,2,"no legacy network fallback");
    assertPublicCall(calls[1],"getTmdbMovies");
  });
});

test("standalone metadata port keeps original response and server-held secret", () => {
  const server = read("deploy/media-god-api/server.mjs");
  const handler = read("deploy/media-god-api/getTmdbMovies.mjs");
  assert.match(server, /\/functions\/getTmdbMovies/);
  assert.match(server, /ALLOWED_ORIGINS/);
  assert.match(server, /TMDB upstream/);
  assert.match(server, /BODY_LIMIT_BYTES/);
  assert.match(handler, /process\.env\[name\]/);
  assert.doesNotMatch(handler, /base44:runtime/);
  assert.match(handler, /movies:\s*items/);
});

test("independent IMDb resolvers pass only public movie/episode identity", async () => {
  let uri, init;
  const result = await invokeIndependentImdbResolver(
    "resolveTvImdb",
    { tmdb_id: 1399, title: "Example", year: 2011, rd_token: "never-send" },
    { fetchImpl: async (url, options) => {
        uri = url; init = options;
        return { ok: true, json: async () => ({ imdb_id: "tt0944947", media_type: "tv" }) };
      }, storage: storage() },
  );
  assert.match(uri, /\/functions\/resolveTvImdb$/);
  assert.equal(result.data.imdb_id, "tt0944947");
  assert.doesNotMatch(init.body, /never-send|rd_token|token/);
  assert.equal(init.credentials, "omit");
  await withPublicFacade(async calls => {
    for (const name of ["resolveImdb","resolveTvImdb"]) {
      const answer = await base44.functions.invoke(name,{tmdb_id:123,rd_token:"SYNTHETIC_SECRET"});
      assert.equal(answer.data.imdb_id,"tt1234567");
      assertPublicCall(calls.at(-1),name);
    }
    assert.equal(calls.length,2);
  });
});

test("independent backend ports IMDb logic without Base44 integration runtime", () => {
  const server = read("deploy/media-god-api/server.mjs");
  const imdb = read("deploy/media-god-api/resolveImdb.mjs");
  const tv = read("deploy/media-god-api/resolveTvImdb.mjs");
  assert.match(server, /"\/functions\/resolveImdb": resolveImdb/);
  assert.match(server, /"\/functions\/resolveTvImdb": resolveTvImdb/);
  assert.doesNotMatch(imdb, /base44:runtime/);
  assert.doesNotMatch(tv, /base44:runtime/);
  assert.match(imdb, /TMDB_API_KEY/);
  assert.match(tv, /TMDB_API_KEY/);
});

test("credit-independent public source lookup strips secret-bearing fields", async () => {
  let endpoint = "", body = "", options = {};
  const data = { streams: [], addons_checked: 2, diagnostics: [] };
  const response = await invokeIndependentAddonSources(
    { imdb_id: "tt1375666", media_type: "movie", rd_token: "SECRET",
      addon_manifest_url: "https://secret.example/api?token=SECRET" },
    { fetchImpl: async (url, init) => {
        endpoint = url; body = init.body; options = init;
        return { ok: true, json: async () => data };
      } },
  );
  assert.match(endpoint, /\/functions\/fetchAddonStreams$/);
  assert.deepEqual(response.data, data);
  assert.doesNotMatch(body, /SECRET|rd_token|addon_manifest_url/);
  assert.equal(options.credentials, "omit");
  const client = read("src/api/base44Client.js");
  assert.match(client, /name === 'fetchAddonStreams' && !payload\?\.action/);
  assert.match(client, /searchAddonSourcesWithPublicFallback\(payload/);
  assert.match(client, /searchPublic: invokeIndependentAddonSources/);
  const recovery = read("src/api/addonSourceRecovery.js");
  assert.match(recovery, /const recoverPublic = \(\) => withDeadline\(\(\) => searchPublic\(payload\), publicTimeoutMs\)/);
});

test("public source gateway never queries other viewers' configured addons", () => {
  const handler = read("deploy/media-god-api/fetchAddonStreams.mjs");
  const server = read("deploy/media-god-api/server.mjs");
  assert.match(handler, /auth: \{ me: async \(\) => null \}/);
  assert.match(handler, /Addon: \{ list: async \(\) => \[\] \}/);
  assert.match(handler, /BUILTIN_PUBLIC_PLAYBACK_ADDONS/);
  assert.match(server, /"\/functions\/fetchAddonStreams": fetchAddonStreams/);
});

test("news and skip metadata bypass Base44 and strip all account credentials", async () => {
  const seen = [];
  for (const [name, payload, expected] of [
    ["getEntertainmentNews", { section: "tv", forceRefresh: true, rd_token: "DO_NOT_FORWARD" }, { stories: [], updatedAt: "2026-11-03" }],
    ["getSkipSegments", { imdb_id: "tt0944947", season: 1, episode: 2, duration: 2700, rd_token: "DO_NOT_FORWARD" }, { markers: {}, providers: [] }],
    ["getFireTvApkLink", { token: "DO_NOT_FORWARD", user_id: "SECRET" }, { url: "https://release-assets.githubusercontent.com/signed" }],
  ]) {
    const result = await invokeIndependentPublicFeature(name, payload, {
      fetchImpl: async (url, options) => {
        seen.push({ url, options });
        return { ok: true, json: async () => expected };
      },
    });
    assert.deepEqual(result.data, expected);
  }
  assert.equal(seen.length, 3);
  for (const { url, options } of seen) {
    assert.match(url, /\/functions\/(?:getEntertainmentNews|getSkipSegments|getFireTvApkLink)$/);
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "omit");
    assert.doesNotMatch(options.body, /DO_NOT_FORWARD|rd_token|user_id|SECRET/);
  }
  assert.equal(seen[2].options.body, "{}");
});

test("the three independently hosted public handlers are wired and never fall back to credit-limited functions", async () => {
  await withPublicFacade(async (calls,goOffline) => {
    for (const name of ["getEntertainmentNews","getSkipSegments","getFireTvApkLink"]) {
      await base44.functions.invoke(name,{rd_token:"SYNTHETIC_SECRET"});
      assertPublicCall(calls.at(-1),name);
    }
    assert.equal(calls.length,3);
    goOffline();
    for (const name of ["getEntertainmentNews","getSkipSegments","getFireTvApkLink"]) {
      await assert.rejects(base44.functions.invoke(name,{}),/returned 503/);
      assertPublicCall(calls.at(-1),name);
    }
    assert.equal(calls.length,6,"no legacy network fallback on outage");
  });
  const server = read("deploy/media-god-api/server.mjs");
  const docker = read("deploy/media-god-api/Dockerfile");
  for (const name of ["getEntertainmentNews", "getSkipSegments", "getFireTvApkLink"]) {
    assert.match(server, new RegExp('"/functions/' + name + '": ' + name));
    assert.match(docker, new RegExp(name + '\\.mjs'));
  }
  // GitHub's temporary signed APK URLs must not be served from the
  // 5-minute request cache, even when news and skip metadata are cached.
  assert.match(server, /route !== "\/functions\/getFireTvApkLink"/);
});
