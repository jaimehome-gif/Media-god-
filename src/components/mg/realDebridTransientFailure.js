/*
 * Transport and account failures are not proof a torrent/source is bad.
 * Keep the current source available for Retry instead of cascading through
 * many unrelated candidates when the backend is temporarily unavailable.
 */
export const isTransientRealDebridServiceFailure = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  if ([401, 403, 408, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  if (status > 0) return false;
  const code = String(error?.code || "").trim().toUpperCase();
  if ([
    "RD_REQUEST_TIMEOUT", "NO_ACCOUNT_SESSION", "RD_CREDENTIAL_EXPIRED",
    "RD_RATE_LIMITED", "RD_DISCOVERY_RATE_LIMITED",
    "NETWORK_ERROR", "ERR_NETWORK", "ETIMEDOUT", "ECONNRESET",
  ].includes(code)) {
    return true;
  }
  return error instanceof TypeError &&
    /failed to fetch|network|load failed/i.test(String(error.message || ""));
};

export const transientRealDebridMessage = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  if (String(error?.code || "").toUpperCase() === "RD_CREDENTIAL_EXPIRED") {
    return "Real-Debrid rejected the saved connection. Media God tried to refresh it automatically. " +
      "If the connection has expired or was revoked, reconnect Real-Debrid in Settings; " +
      "the selected source has not been marked bad.";
  }
  if (status === 401 || error?.code === "NO_ACCOUNT_SESSION") {
    return "Media God could not verify the current account session for this request. " +
      "Your Real-Debrid sources were not marked bad; retry the request.";
  }
  if (status === 403) {
    return "The playback server denied this request. Your source was not marked bad. " +
      "Retry after the connection is corrected.";
  }
  if (String(error?.code || "").toUpperCase() === "RD_RATE_LIMITED" ||
      String(error?.code || "").toUpperCase() === "RD_DISCOVERY_RATE_LIMITED") {
    return "Real-Debrid is temporarily rate limiting playback lookups. " +
      "Media God kept the selected torrent and stopped automatic retries to avoid more requests. " +
      "Try it again after the limit resets, or choose an already-ready source.";
  }
  if (status === 429) {
    return "Real-Debrid is temporarily rate-limiting requests. " +
      "Your selected source is still available; retry shortly.";
  }
  return "The playback service could not prepare this source just now. " +
    "Media God kept your selected source available instead of rejecting it. Please retry.";
};
