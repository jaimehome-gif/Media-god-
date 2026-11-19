import test from "node:test";
import assert from "node:assert/strict";
import {
  readPublicSection,
  savePublicSection,
  orderUpcomingReleases,
} from "../src/components/mg/publicSectionCache.js";

test("upcoming films preserve worldwide-first dates and rank English titles first on the same date", () => {
  const items = [
    { id: 1, title: "French film", original_language: "fr", release_date: "2026-11-27", popularity: 150 },
    { id: 2, title: "English film", original_language: "en", release_date: "2026-11-27", popularity: 5 },
    { id: 3, title: "Released worldwide already", original_language: "en", release_date: "2026-12-20", first_worldwide_release_date: "2026-11-01" },
    { id: 2, title: "Duplicate film", original_language: "en", release_date: "2026-11-27" },
    { id: 4, title: "Next month", original_language: "en", release_date: "2026-12-01" },
  ];
  const rows = orderUpcomingReleases(items, "movie", "2026-11-19");
  assert.deepEqual(rows.map(item => item.id), [2, 1, 4]);
  assert.equal(rows[0].status, "Listed release date");
  assert.equal(rows[0].media_type, "movie");
});

test("TV premieres have correct dates, without labelling new episodes as series premieres", () => {
  const rows = orderUpcomingReleases([
    { id: "a", title: "New programme", first_air_date: "2026-11-20", original_language: "en" },
    { id: "b", title: "Old programme", first_air_date: "2026-10-31" },
  ], "tv", "2026-11-19");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].release_date, "2026-11-20");
  assert.match(rows[0].status, /not a new episode/);
});

test("public section results are cached safely and expire", () => {
  const previous = globalThis.sessionStorage;
  const items = new Map();
  globalThis.sessionStorage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
  try {
    assert.equal(readPublicSection("news:tv"), null);
    savePublicSection("news:tv", { stories: [{ title: "TV headline" }] });
    assert.equal(readPublicSection("news:tv")?.data?.stories[0].title, "TV headline");
    assert.equal(readPublicSection("news:tv", -1), null);
    items.set("mg:public-discovery:v1:news:tv", "invalid-json");
    assert.equal(readPublicSection("news:tv"), null);
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous;
  }
});
