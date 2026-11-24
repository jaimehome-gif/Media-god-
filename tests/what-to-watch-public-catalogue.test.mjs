import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/components/mg/WatchmodeHub.jsx", import.meta.url), "utf8");

test("What to Watch starts on catalogue releases and retains the other public guides", () => {
  assert.match(source, /const \[tab, setTab\] = useState\("releases"\)/);
  for (const tab of ["sports", "tv", "releases"]) assert.ok(source.includes('id: "' + tab + '"'));
});

async function runLoad(stale, items, savedRows = null) {
  const rows = [];
  const errors = [];
  const saves = [];
  const start = source.indexOf("async (signal) => {", source.indexOf("const load = useCallback"));
  const end = source.indexOf("}, [tab, region, releaseType, cacheKey]);", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    tab: "releases", releaseType: "movie", region: "GB", cacheKey: "test",
    TODAY: () => "2026-11-24",
    readPublicSection: () => savedRows ? { data: { rows: savedRows } } : null,
    setRows: x => rows.push(x),
    setError: x => errors.push(x),
    setLoading: () => {},
    setRefreshing: () => {},
    base44: { functions: { invoke: async () => ({ data: { movies: items }, stale }) } },
    orderUpcomingReleases: x => x,
    savePublicSection: (...args) => saves.push(args),
    signal: { aborted: false },
  };
  await vm.runInNewContext("(" + source.slice(start, end) + "})(signal)", context);
  return { rows, errors, saves };
}

test("fresh releases update the public cache", async () => {
  const items = [{ id: 1, title: "Synthetic release" }];
  const result = await runLoad(false, items);
  assert.equal(result.rows.at(-1), items);
  assert.equal(result.errors.at(-1), "");
  assert.equal(result.saves.length, 1);
});

test("stale releases are displayed with a warning without renewing their cache lifetime", async () => {
  const items = [{ id: 1, title: "Synthetic release" }];
  const result = await runLoad(true, items);
  assert.equal(result.rows.at(-1), items);
  assert.match(result.errors.at(-1), /previously saved releases/);
  assert.equal(result.saves.length, 0);
});

test("an empty stale response shows an unavailable state", async () => {
  const result = await runLoad(true, []);
  assert.match(result.errors.at(-1), /temporarily unavailable/);
  assert.equal(result.saves.length, 0);
});

test("an empty stale response preserves the last saved release list", async () => {
  const saved = [{ id: 2, title: "Previously saved synthetic release" }];
  const result = await runLoad(true, [], saved);
  assert.equal(result.rows.at(-1), saved);
  assert.match(result.errors.at(-1), /previously saved releases/);
  assert.equal(result.saves.length, 0);
});

function runDiscovery(fetchImpl, timeoutImmediately = false) {
  const start = source.indexOf("async function discovery(");
  const end = source.indexOf("export default function WatchmodeHub", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    API: "https://example.invalid/publicDiscovery",
    fetch: fetchImpl,
    AbortController,
    signal: new AbortController().signal,
    setTimeout: (callback, delay) => setTimeout(callback, timeoutImmediately ? 0 : delay),
    clearTimeout,
  };
  return vm.runInNewContext("(" + source.slice(start, end).trim() + ")('tv', 'GB', signal, '2026-11-24')", context);
}

test("malformed public guide results are errors rather than a cacheable empty list", async () => {
  await assert.rejects(runDiscovery(async () => ({
    ok: true, json: async () => ({ unexpected: true }),
  })), /Discovery service unavailable/);
});

test("a stalled public guide request exits with a retryable timeout", async () => {
  await assert.rejects(runDiscovery(async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), true), /timed out/);
});

test("public guide requests use the selected local date as part of the server cache key", async () => {
  let request;
  await runDiscovery(async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ results: [] }) };
  });
  assert.equal(request.date, "2026-11-24");
  assert.equal(request.region, "GB");
});

const serverSource = readFileSync(new URL("../deploy/media-god-api/server.mjs", import.meta.url), "utf8");

function runServerGuide(action, providerResponse) {
  const start = serverSource.indexOf("const json = (data, status");
  const end = serverSource.indexOf("async function publicDiscovery(req)", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    Response, Request, URL, Date,
    fetch: async () => ({ ok: true, json: async () => providerResponse }),
    AbortSignal,
    request: new Request("https://example.invalid/functions/publicDiscovery", {
      method: "POST",
      body: JSON.stringify({ action, region: "GB", date: "2026-11-24" }),
    }),
  };
  return vm.runInNewContext(serverSource.slice(start) + "\npublicDiscovery(request)", context);
}

test("malformed TV provider responses are not successful empty schedules", async () => {
  const result = await runServerGuide("tv", { error: "unexpected envelope" });
  assert.equal(result.status, 502);
  assert.match((await result.json()).error, /temporarily unavailable/);
});

test("malformed sports provider responses are not successful empty schedules", async () => {
  const result = await runServerGuide("sports", { error: "unexpected envelope" });
  assert.equal(result.status, 502);
});

test("an explicitly empty sports schedule is still a valid response", async () => {
  const result = await runServerGuide("sports", { events: null });
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).results, []);
});
