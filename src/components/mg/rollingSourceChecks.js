/* Continuous, small foreground discovery batches. Do not run an unlimited
 * scraper loop or a timer while the application is backgrounded. */
import { isLowCapacityTvDevice } from "./deviceCapacity.js";
import { isFireTvRuntime } from "./runtimePlatform.js";

export const ROLLING_SOURCE_CHECK_MS = 45_000;
export const ROLLING_SOURCE_BATCH = 4;
export function createRollingSourceChecks(getItems, check, {
  windowObject = window, documentObject = document,
  // A low-capacity Android box cannot afford a full batch every 45 seconds.
  intervalMs = isLowCapacityTvDevice() ? ROLLING_SOURCE_CHECK_MS * 2 : ROLLING_SOURCE_CHECK_MS,
  batchSize = isLowCapacityTvDevice() ? 2 : ROLLING_SOURCE_BATCH,
  // Optional catalogue verification must not compete with initial rendering
  // or rapid D-pad navigation on TV. Phones and browsers keep their normal scan.
  initialDelayMs = isFireTvRuntime() ? 20_000 : 0,
  quietPeriodMs = isFireTvRuntime() ? 1_800 : 0,
} = {}) {
  let cursor = 0;
  let stopped = false;
  let warmed = initialDelayMs <= 0;
  let lastNavigationAt = -Infinity;
  let startupTimer = null;
  const pending = new Set();
  const limit = Math.max(1, Math.floor(Number(batchSize) || ROLLING_SOURCE_BATCH));
  // Catalogue evidence checks are opportunistic, never a playback dependency.
  // The native/web player stays mounted inside the same document on Android
  // boxes, so visibilityState alone does not stop these background requests.
  // Avoid competing with an active video for bandwidth/CPU and let the next
  // normal foreground scan resume after the player closes.
  const playerActive = () => Boolean(
    documentObject.querySelector?.('[data-mg-player-root="true"]')
  );
  const canScan = () => !stopped && warmed && documentObject.visibilityState !== 'hidden' &&
    windowObject.navigator?.onLine !== false && !playerActive() &&
    (quietPeriodMs <= 0 || Date.now() - lastNavigationAt >= quietPeriodMs);
  const identity = item => {
    const id = item?.tmdb_id ?? item?.tmdbId ?? item?.id;
    // Browse rows may use media_type, mediaType or type depending on their
    // source. Without this normalisation, a TV series and a film with the
    // same numeric TMDB ID can share a pending slot on generic TV boxes,
    // while the same film can be checked twice under its object aliases.
    const rawType = String(item?.media_type || item?.mediaType || item?.type || 'movie').toLowerCase();
    const type = ['tv', 'series', 'show', 'episode'].includes(rawType) ? 'tv' : 'movie';
    return id == null ? item : JSON.stringify([type, String(id), String(item.year || '')]);
  };
  const scan = () => {
    if (!canScan()) return;
    let items;
    try {
      items = getItems().filter(Boolean);
    } catch {
      return; // A temporarily unavailable catalogue must not break the timer.
    }
    if (!items.length || pending.size >= limit) return;

    // Do not pile up requests when a TV box has a slow network connection.
    // Each title can have only one outstanding check; use free slots only.
    let inspected = 0;
    while (inspected < items.length && pending.size < limit) {
      const item = items[cursor % items.length];
      cursor = (cursor + 1) % items.length;
      inspected += 1;
      const key = identity(item);
      if (pending.has(key)) continue;
      pending.add(key);
      Promise.resolve()
        // Visibility/connectivity may change after scheduling this microtask.
        .then(() => canScan() ? check(item) : undefined)
        .catch(() => {})
        .finally(() => pending.delete(key));
    }
  };
  const timer = windowObject.setInterval(scan, intervalMs);
  const onReturn = () => scan();
  const onRemoteKey = (event) => {
    // Reading an event's key has negligible cost; avoid optional network work
    // while the viewer is actively moving through a long poster catalogue.
    if (/^(?:ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(String(event?.key || '')) ||
        [19, 20, 21, 22, 37, 38, 39, 40].includes(Number(event?.keyCode || 0))) {
      lastNavigationAt = Date.now();
    }
  };
  windowObject.addEventListener('focus', onReturn);
  windowObject.addEventListener('online', onReturn);
  documentObject.addEventListener('visibilitychange', onReturn);
  if (quietPeriodMs > 0) windowObject.addEventListener('keydown', onRemoteKey, true);
  if (warmed) scan();
  else startupTimer = windowObject.setTimeout(() => {
    warmed = true;
    startupTimer = null;
    scan();
  }, initialDelayMs);
  return () => {
    stopped = true;
    windowObject.clearInterval(timer);
    if (startupTimer !== null) windowObject.clearTimeout(startupTimer);
    windowObject.removeEventListener('focus', onReturn);
    windowObject.removeEventListener('online', onReturn);
    documentObject.removeEventListener('visibilitychange', onReturn);
    if (quietPeriodMs > 0) windowObject.removeEventListener('keydown', onRemoteKey, true);
  };
}