import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
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

// Exercise the independent compatibility facade rather than requiring the
// retired Base44 SDK call and legacy device token to remain in production.
function publicFacadeHarness({ session = "synthetic-account-session", networkResponse } = {}) {
  const calls = [];
  const network = [];
  const route = name => async (...args) => {
    calls.push({ name, args });
    return { data: { public: true } };
  };
  const source = read("src/api/base44Client.js")
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];/gm, "")
    .replace(/^export\s+/gm, "");
  const localStorage = { getItem: () => session };
  const client = vm.runInNewContext(source + "\nbase44;", {
    window: { localStorage }, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => { network.push(args); if (networkResponse) return networkResponse(); throw Error("Unexpected network fallback"); },
    invokeIndependentAddonSources: route("public-discovery"),
    invokeIndependentMetadata: route("catalogue"),
    invokeIndependentImdbResolver: route("identity"),
    invokeIndependentPublicFeature: route("feature"),
  });
  return { client, calls, network };
}

test("no silent return to Base44 credits for public catalogue requests", async () => {
  const { client, calls, network } = publicFacadeHarness();
  const payload = { media_type: "movie", page: 1 };
  assert.equal((await client.functions.invoke("getTmdbMovies", payload)).data.public, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "catalogue");
  assert.equal(calls[0].args.length, 1);
  assert.equal(calls[0].args[0], payload);
  await assert.rejects(client.functions.invoke("notMigrated"), error => error.code === "MIGRATION_PENDING_FUNCTION");
  assert.equal(network.length, 0);
  assert.doesNotMatch(read("src/api/independentMetadata.js"), /base44\.functions\.invoke|rd_token|asServiceRole/);
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
  const { client, calls, network } = publicFacadeHarness();
  for (const name of ["resolveImdb", "resolveTvImdb"]) {
    const payload = { tmdb_id: 123 };
    await client.functions.invoke(name, payload);
    assert.equal(calls.at(-1).name, "identity");
    assert.equal(calls.at(-1).args[0], name);
    assert.equal(calls.at(-1).args[1], payload);
    assert.equal(calls.at(-1).args.length, 2);
  }
  assert.equal(network.length, 0);
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
  const anonymous = publicFacadeHarness({ session: "" });
  await assert.rejects(anonymous.client.functions.invoke("fetchAddonStreams", { action: "status" }), error => error.status === 401);
  assert.equal(anonymous.network.length, 0);
  assert.equal(anonymous.calls.length, 0);
  const rejected = publicFacadeHarness({
    networkResponse: () => Response.json({ error: "Denied" }, { status: 401 }),
  });
  await assert.rejects(rejected.client.functions.invoke("fetchAddonStreams", { action: "status" }), error => error.status === 401);
  assert.equal(rejected.network.length, 1);
  assert.match(rejected.network[0][0], /\/functions\/fetchAddonStreams$/);
  assert.equal(rejected.network[0][1].headers.Authorization, "Bearer synthetic-account-session");
  assert.equal(rejected.calls.length, 0, "Private actions must not fall back to anonymous routes");
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
  const { client, calls, network } = publicFacadeHarness();
  for (const name of ["getEntertainmentNews", "getSkipSegments", "getFireTvApkLink"]) {
    const payload = {};
    await client.functions.invoke(name, payload);
    assert.equal(calls.at(-1).name, "feature");
    assert.equal(calls.at(-1).args[0], name);
    assert.equal(calls.at(-1).args[1], payload);
    assert.equal(calls.at(-1).args.length, 2);
  }
  assert.equal(network.length, 0);
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

test("public catalogue requests and cache retain only public query data", async () => {
  const local = storage();
  let sent;
  const payload = {
    category: "upcoming", region: "GB", page: 1,
    provider_ids: [8, "9", { secret: "DO_NOT_FORWARD" }],
    release_alerts: [{ id: 123, media_type: "tv", email: "DO_NOT_FORWARD" }],
    access_token: "DO_NOT_FORWARD", account: { email: "DO_NOT_FORWARD" },
  };
  await invokeIndependentMetadata(payload, {
    fetchImpl: async (_url, options) => {
      sent = options.body;
      return { ok: true, json: async () => ({ movies: [] }) };
    },
    storage: local,
  });
  assert.deepEqual(JSON.parse(sent), {
    category: "upcoming", region: "GB", page: 1,
    provider_ids: [8, "9"], release_alerts: [{ tmdb_id: "123", media_type: "tv" }],
  });
  assert.doesNotMatch(sent, /DO_NOT_FORWARD/);
  assert.ok(local.keys().length > 0);
  for (const key of local.keys()) assert.doesNotMatch(local.getItem(key), /DO_NOT_FORWARD/);
});

test("invalid release response does not overwrite a usable catalogue cache", async () => {
  const local = storage();
  const request = { category: "upcoming", media_type: "movie" };
  const data = { movies: [{ id: 1, title: "Synthetic release" }] };
  await invokeIndependentMetadata(request, {
    storage: local, fetchImpl: async () => ({ ok: true, json: async () => data }),
  });
  const response = await invokeIndependentMetadata(request, {
    storage: local, fetchImpl: async () => ({ ok: true, json: async () => ({ unexpected: true }) }),
  });
  assert.deepEqual(response, { data, stale: true });
  assert.deepEqual(JSON.parse(local.getItem(local.keys()[0])).data, data);
});

test("invalid or future cache timestamps cannot make public results indefinitely fresh", async () => {
  const request = { category: "upcoming", media_type: "movie" };
  for (const savedAt of ["not-a-timestamp", Date.now() + 86400000]) {
    const local = storage();
    await invokeIndependentMetadata(request, {
      storage: local, fetchImpl: async () => ({ ok: true, json: async () => ({ movies: [] }) }),
    });
    const key = local.keys()[0];
    local.setItem(key, JSON.stringify({ ...JSON.parse(local.getItem(key)), savedAt }));
    await assert.rejects(invokeIndependentMetadata(request, {
      storage: local, fetchImpl: async () => { throw new Error("offline"); },
    }), /Catalogue temporarily unavailable/);
  }
});

test("nested account information cannot be forwarded inside public metadata fields", async () => {
  const secret = { access_token: "SYNTHETIC_PRIVATE_VALUE" };
  const seen = [];
  const fetchImpl = async (_url, options) => {
    seen.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ imdb_id: "tt1234567" }) };
  };
  await invokeIndependentImdbResolver("resolveImdb", { title: secret, tmdb_id: 123 }, {
    fetchImpl, storage: storage(),
  });
  await invokeIndependentPublicFeature("getEntertainmentNews", {
    section: secret, forceRefresh: true,
  }, { fetchImpl });
  assert.deepEqual(seen, [{ tmdb_id: 123 }, { forceRefresh: true }]);
  assert.doesNotMatch(JSON.stringify(seen), /SYNTHETIC_PRIVATE_VALUE/);
});
