// Public, non-personal news and discovery results only. Never cache tokens or account data.
const PREFIX = "mg:public-discovery:v1:";
const MAX_BYTES = 250_000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export function readPublicSection(key, maxAgeMs = ONE_DAY) {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const entry = JSON.parse(sessionStorage.getItem(PREFIX + key) || "null");
    if (!entry || !Number.isFinite(entry.savedAt) || Date.now() - entry.savedAt < 0 ||
        Date.now() - entry.savedAt > maxAgeMs || !entry.data || typeof entry.data !== "object") {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function savePublicSection(key, data) {
  if (!data || typeof data !== "object") return;
  try {
    if (typeof sessionStorage === "undefined") return;
    const serialised = JSON.stringify({ savedAt: Date.now(), data });
    if (serialised.length <= MAX_BYTES) sessionStorage.setItem(PREFIX + key, serialised);
  } catch {
    // Disabled or full storage must never prevent news and discovery from loading.
  }
}

export function orderUpcomingReleases(items, mediaType, today) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.map(item => ({
    ...item,
    media_type: mediaType,
    release_date: String(mediaType === "movie"
      ? (item.first_worldwide_release_date || item.global_release_date || item.release_date || "")
      : (item.first_air_date || item.release_date || "")),
    source_name: mediaType === "movie" ? "TMDB · Film" : "TMDB · TV",
    status: mediaType === "movie" ? "Listed release date" : "Series premiere (not a new episode)",
  })).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.release_date) && item.release_date >= today)
    .sort((a, b) => a.release_date.localeCompare(b.release_date)
      || Number(b.original_language === "en") - Number(a.original_language === "en")
      || Number(b.popularity || 0) - Number(a.popularity || 0)
      || String(a.title || "").localeCompare(String(b.title || "")))
    .filter(item => {
      const key = String(item.tmdb_id || item.id || item.title || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}
