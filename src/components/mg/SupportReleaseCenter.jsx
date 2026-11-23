import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, Download, ExternalLink, History, Loader2,
  RefreshCw, ShieldCheck, Smartphone, Tv
} from "lucide-react";
import { fetchLatestNativeRelease } from "@/components/mg/nativeReleaseInfo";

const RELEASES_URL = "https://github.com/jaimehome-gif/Media-god-/releases";
const RELEASES_API = "https://api.github.com/repos/jaimehome-gif/Media-god-/releases?per_page=30";
const PLATFORM = [
  { id: "android-mobile", name: "Android phones & tablets", icon: Smartphone },
  { id: "fire-tv", name: "Amazon Fire TV & Android TV", icon: Tv }
];

const formatDate = value => {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
};

const validPublishedPair = release => {
  if (!release || release.draft || release.prerelease || !release.published_at) return false;
  if (!/^stable-[a-z0-9]+$/i.test(String(release.tag_name || ""))) return false;
  const files = Array.isArray(release.assets) ? release.assets : [];
  return ["Media-God-Android-Mobile.apk", "Media-God-Fire-TV.apk"].every(
    name => files.some(file => file.name === name && file.state === "uploaded" && Number(file.size) > 1_000_000)
  );
};

async function publishedHistory() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Published release history is unavailable");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid release history");
    return data.filter(validPublishedPair)
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
      .slice(0, 5)
      .map(release => ({
        tag: release.tag_name,
        name: release.name || "Media God verified APK release",
        date: release.published_at,
        url: release.html_url
      }));
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function SupportReleaseCenter() {
  const [releases, setReleases] = useState({});
  const [history, setHistory] = useState([]);
  const [checking, setChecking] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);

  const refresh = useCallback(async (force = false) => {
    setChecking(true);
    const [mobile, fireTv, recent] = await Promise.allSettled([
      fetchLatestNativeRelease("android-mobile", { force }),
      fetchLatestNativeRelease("fire-tv", { force }),
      publishedHistory()
    ]);
    setReleases({
      "android-mobile": mobile.status === "fulfilled" ? mobile.value : null,
      "fire-tv": fireTv.status === "fulfilled" ? fireTv.value : null
    });
    if (recent.status === "fulfilled") {
      setHistory(recent.value);
      setHistoryError(false);
    } else {
      setHistoryError(true);
    }
    setCheckedAt(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
    const checkVisible = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refresh(true);
    }, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", checkVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkVisible);
    };
  }, [refresh]);

  return (
    <section id="support-downloads" aria-labelledby="support-downloads-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="support-downloads-title" className="text-xl font-bold text-white">
            Latest official downloads
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Direct links to verified Media God APK releases. They update automatically when a new signed release is published.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh(true)}
          disabled={checking}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mg-green disabled:opacity-60"
        >
          <RefreshCw className={"h-4 w-4 " + (checking ? "animate-spin" : "")} />
          Check for new releases
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORM.map(platform => {
          const Icon = platform.icon;
          const release = releases[platform.id];
          return (
            <article key={platform.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-mg-green/30 bg-mg-green/10 text-mg-green">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-semibold text-white">{platform.name}</h3>
                  <p className="text-xs text-white/55">
                    {release ? "Verified published installer" : checking ? "Checking signed release…" : "Release cannot be verified right now"}
                  </p>
                </div>
              </div>
              {release ? (
                <>
                  <div className="mt-4 flex items-center gap-2 text-sm text-mg-green">
                    <CheckCircle2 className="h-4 w-4" />
                    Version {release.versionName} <span className="text-white/40">(build {release.versionCode})</span>
                  </div>
                  <p className="mt-2 min-h-16 whitespace-pre-wrap text-sm leading-6 text-white/65">
                    {release.message || "Published and verified Media God release."}
                  </p>
                  <a
                    href={release.apkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-mg-green px-4 py-2 text-center text-sm font-bold text-black hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Download className="h-5 w-5" /> Download APK
                  </a>
                  {release.downloaderCode && (
                    <p className="mt-3 text-xs text-white/60">
                      Downloader code: <span className="font-bold text-white">{release.downloaderCode}</span>
                    </p>
                  )}
                  <a href={release.releaseUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-mg-green hover:underline">
                    View release details <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm leading-6 text-white/60">
                    We won't offer an unverified installer. Use the official release page or try checking again.
                  </p>
                  <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-mg-green hover:underline">
                    Official releases <ExternalLink className="h-4 w-4"/>
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-start gap-2 text-xs text-white/55">
        <ShieldCheck className="h-4 w-4 shrink-0 text-mg-green" />
        <span>
          We show download buttons only after the published installer, its SHA-256 verification and matching release manifest pass checks.
          {checkedAt && <> Last checked: {checkedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</>}
        </span>
      </div>
      <div id="support-release-history" className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-mg-green" />
          <h3 className="text-lg font-semibold text-white">Recent published updates</h3>
        </div>
        <p className="mt-1 text-sm text-white/55">Automatically collected from the official Media God releases, newest first.</p>
        {history.length ? (
          <ul className="mt-4 divide-y divide-white/10">
            {history.map(item => (
              <li key={item.tag} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.name}</p>
                  <p className="text-xs text-white/45">{formatDate(item.date)}</p>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs text-mg-green hover:underline">
                  Release notes <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-white/55">{checking ? "Loading release history…" : historyError ? "Release history is temporarily unavailable." : "No matching published release history found."}</p>}
        <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-mg-green hover:underline">
          View all official updates <ExternalLink className="h-4 w-4"/>
        </a>
      </div>
    </section>
  );
}
