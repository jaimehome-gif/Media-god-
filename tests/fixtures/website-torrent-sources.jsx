import React from "react";
import { createRoot } from "react-dom/client";
import { base44 } from "../../src/api/base44Client";
import { PlayerProvider } from "../../src/components/mg/PlayerProvider";
import Sources from "../../src/components/mg/MediaStreamSourcesBox";

export function mountTorrentTitle({ url, mode, videoCodec, audioCodec }) {
  const hash = "ac".repeat(20);
  const magnet = "magnet:?xt=urn:btih:" + hash;
  const item = {
    filename: "Owned Test Clip 2025 " + new URL(url).pathname.split("/").pop(), id: "fixture-torrent", type: "rd", label: "Owned Test Clip 2025 English 1080p x264 AAC",
    infoHash: hash, src: magnet, url: magnet, magnet,
  };
  if (mode === "incompatible") item.label = "Owned Test Clip 2025 English 4K HDR HEVC";
  if (!["unknown","account-match"].includes(mode)) item.debridCached = true;
  if (mode.startsWith("cooldown") || mode === "library" || mode === "preparing") item.rdTorrentId = "owned-fixture-id";
  const ready = {
    media_info: {video_tracks:[{codec:videoCodec}],audio_tracks:[{codec:audioCodec}]}, status: "ready", torrent_id: "owned-fixture-id", filename: "Owned Test Clip 2025.mkv",
    stream_url: mode === "fallback" ? new URL("unavailable.mp4", url).href : url,
    fallback_stream_url: mode === "fallback" ? url : "",
  };

  if (mode === "format") {
    item.label = "Owned Test Clip 2025 English 1080p " + videoCodec + " " + audioCodec;
    item.videoCodec = videoCodec;
    item.rdTorrentId = ready.torrent_id;
    ready.media_info = {
      video_tracks: [{codec:videoCodec,height:1080}],
      audio_tracks: [{codec:audioCodec,language:"English"}],
    };
  }
  const streams = ["ranked","seedless"].includes(mode) ? [
    { ...item, id: "incompatible", label: "Owned Test Clip 2025 English 4K HDR HEVC",
      infoHash: "ef".repeat(20), rdTorrentId: "must-never-resolve" },
    { ...item, rdTorrentId: "broken" },
    { ...item, id: "second", label: "Owned Test Clip 2025 English 720p x264 AAC", infoHash: "bd".repeat(20),
      src: "magnet:?xt=urn:btih:" + "bd".repeat(20), url: "", magnet: "", rdTorrentId: "working" },
  ] : [item];
  window.fixtureLookups = 0;
  window.fixtureDebridActions = [];
  const invoke = base44.functions.invoke;
  if (mode.startsWith("cooldown")) {
    window.localStorage.setItem("mg:jaime-home-session:v1", "fixture");
    const originalFetch = window.fetch;
    window.fixtureResolutionCalls = [];
    window.fetch = async (url, options) => {
      if (!String(url).endsWith("/functions/realDebrid")) return originalFetch(url, options);
      const body = JSON.parse(options.body);
      window.fixtureResolutionCalls.push({id:body.torrent_id, time:Date.now()});
      return Response.json((mode === "cooldown-repeat" || window.fixtureResolutionCalls.length === 1)
        ? {status:"failed", upstream_status:429, retry_after:2, error:"too_many_requests"} : ready);
    };
  }
  base44.functions.invoke = async (name, params) => {
    if (name === "realDebridAuth") return { data: { connected: true, valid: true } };
    if (name === "fetchAddonStreams") {
      window.fixtureLookups++;
      return { data: { streams, addons_checked: 1 } };
    }
    if (name === "realDebrid") {
      window.fixtureDebridActions.push(params.action);
      if (mode === "account-match" && params.action === "find_cached") return {data:{
        ...ready, media_info:{video_tracks:[{codec:"h264",height:180}],audio_tracks:[{codec:"aac",language:"English"}]},
      }};
      if (mode.startsWith("cooldown")) return invoke(name, params);
      if (["ranked","seedless"].includes(mode) && params.action === "torrent_info") {
        window.fixtureDebridActions.push(params.torrent_id);
        if (mode === "seedless" && params.torrent_id === "broken") return {data:{
          status:"preparing", torrent_id:"broken", rd_status:"magnet_conversion",
          torrent_progress:{progress:0, seeders:0, speed_bps:0, downloaded_bytes:0, status:"magnet_conversion"},
        }};
        if (params.torrent_id === "broken") return { data: { ...ready, stream_url: new URL("unavailable.mp4", url).href } };
      }
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
