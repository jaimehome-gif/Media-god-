import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/components/mg/WatchmodeHub.jsx", import.meta.url), "utf8");

test("What to Watch starts on catalogue releases and retains the other public guides", () => {
  assert.match(source, /const \[tab, setTab\] = useState\("releases"\)/);
  for (const tab of ["sports", "tv", "releases"]) assert.ok(source.includes('id: "' + tab + '"'));
});

async function runLoad(stale, items, savedRows = []) {
  const rows = [];
  const errors = [];
  const saves = [];
  const start = source.indexOf("async (signal) => {", source.indexOf("const load = useCallback"));
  const end = source.indexOf("}, [tab, region, releaseType, cacheKey]);", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    tab: "releases", releaseType: "movie", region: "GB", cacheKey: "test",
    TODAY: () => "2026-11-24",
    readPublicSection: () => savedRows.length ? { data: { rows: savedRows } } : null,
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

test("empty stale metadata retains useful previously saved releases without renewing cache", async () => {
  const saved = [{ id: 2, title: "Previously saved release" }];
  const result = await runLoad(true, [], saved);
  assert.equal(result.rows.at(-1), saved);
  assert.match(result.errors.at(-1), /previously saved releases/);
  assert.equal(result.saves.length, 0);
});

test("fresh empty metadata clears prior results", async () => {
  const saved = [{ id: 2, title: "Previously saved release" }];
  const fresh = [];
  const result = await runLoad(false, fresh, saved);
  assert.equal(result.rows.at(-1), fresh);
  assert.equal(result.errors.at(-1), "");
  assert.equal(result.saves.length, 1);
});
