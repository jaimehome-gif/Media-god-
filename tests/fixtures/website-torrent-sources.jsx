import React from "react";
import { createRoot } from "react-dom/client";
import { base44 } from "../../src/api/base44Client";
import { PlayerProvider } from "../../src/components/mg/PlayerProvider";
import Sources from "../../src/components/mg/MediaStreamSourcesBox";

export function mountTorrentTitle({ url, mode }) {
  const hash = "ac".repeat(20);
  const magnet = "magnet:?xt=urn:btih:" + hash;
  const item = {
    id: "fixture-torrent", type: "rd", label: "Owned Test Clip 2025 English 1080p",
    infoHash: hash, src: magnet, url: magnet, magnet,
  };
  if (mode !== "unknown") item.debridCached = true;
  if (mode === "library" || mode === "preparing") item.rdTorrentId = "owned-fixture-id";
  const ready = {
    status: "ready", torrent_id: "owned-fixture-id", filename: "Owned Test Clip 2025.mkv",
    stream_url: mode === "fallback" ? new URL("unavailable.mp4", url).href : url,
    fallback_stream_url: mode === "fallback" ? url : "",
  };

  window.fixtureDebridActions = [];
  base44.functions.invoke = async (name, params) => {
    if (name === "realDebridAuth") return { data: { connected: true, valid: true } };
    if (name === "fetchAddonStreams") return { data: { streams: [item], addons_checked: 1 } };
    if (name === "realDebrid") {
      window.fixtureDebridActions.push(params.action);
      if (mode === "preparing" && params.action === "torrent_info" &&
          window.fixtureDebridActions.filter(action => action === "torrent_info").length === 1) {
        return { data: { status: "preparing", torrent_id: ready.torrent_id, rd_status: "downloading",
          torrent_progress: { progress: 95, status: "downloading" } } };
      }
      if (["torrent_info", "resolve_best", "adopt_hash"].includes(params.action)) {
        return { data: ready };
      }
    }
    return { data: {} };
  };
  createRoot(document.querySelector("#root")).render(
    <PlayerProvider>
      <Sources title="Owned Test Clip" imdbId="tt9999999" tmdbId={9999999} rdYear={2025} mediaType="movie" />
    </PlayerProvider>
  );
}
