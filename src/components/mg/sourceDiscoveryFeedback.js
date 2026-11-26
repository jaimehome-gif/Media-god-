export const canonicalImdbLookupFields = (request = {}) => ({
  title: request?.rdTitle || request?.title || "",
  year: request?.rdYear ?? request?.year ?? "",
});

export const sourceAddonFailure = (diagnostics = []) =>
  (Array.isArray(diagnostics) ? diagnostics : []).find((item) =>
    ["http_403", "http_429", "unreachable"].includes(
      String(item?.status || "").toLowerCase()
    )
  ) || null;

export const sourceLookupFailed = (data = {}) => {
  if (data?.error) return true;
  if (Array.isArray(data?.streams) && data.streams.length > 0) return false;

  const diagnostics = Array.isArray(data?.diagnostics) ? data.diagnostics : [];
  return Boolean(
    sourceAddonFailure(diagnostics) &&
    diagnostics.every((item) =>
      !["ok", "browser_ok"].includes(String(item?.status || "").toLowerCase())
    )
  );
};

export const emptyPlaybackSourceMessage = (diagnostics = {}) => {
  const failure = sourceAddonFailure(diagnostics?.diagnostics);
  const status = String(failure?.status || "").toLowerCase();

  if (status === "http_403" || status === "http_429") {
    const debridDetail = diagnostics?.rdConnected
      ? "Real-Debrid is connected, but no video link was found."
      : "No video link was found.";
    return `The source addon refused the search (HTTP ${status.slice(5)}). ${debridDetail} Try another addon in Addons or come back later.`;
  }

  if (status === "unreachable") {
    return "The source addon could not be reached. Check the connection or try another addon in Addons.";
  }

  if (diagnostics?.imdbStatus === "FAILED") {
    return "Media God could not identify this title for its source addons. Check the title details or try again later.";
  }

  const candidates = Number(diagnostics?.cacheCandidateCount || 0);
  if (candidates > 0) {
    return `Found ${candidates} torrent candidate${candidates === 1 ? "" : "s"}. No playable video link is available yet. Verified cached: ${Number(diagnostics?.cachedSourceCount || 0)}. Pending or uncached: ${Number(diagnostics?.pendingSourceCount || 0)}.`;
  }

  return "No video source was returned for this title. Check Addons for another source or try again later.";
};
