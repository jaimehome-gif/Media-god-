import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Radio, Tv, Film, AlertCircle, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { INDEPENDENT_METADATA_API_URL } from "@/api/independentMetadata.js";
import { readPublicSection, savePublicSection, orderUpcomingReleases } from "./publicSectionCache.js";

const API = new URL("/functions/publicDiscovery", INDEPENDENT_METADATA_API_URL).href;
const TODAY = () => { const now=new Date(); return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-"); };
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||"")) ? value : "";
const tabs = [
  { id: "releases", label: "Film & TV releases", icon: Film },
  { id: "tv", label: "TV schedule", icon: Tv },
  { id: "sports", label: "Sports fixtures", icon: Radio },
];
const normalise = item => ({
  id: item?.id || item?.tmdb_id || item?.title,
  title: item?.title || item?.name || "Untitled",
  description: item?.description || item?.overview || "",
  start_time: item?.start_time || item?.release_date || item?.first_air_date || "",
  poster_url: item?.poster_url || item?.image_url || "",
  source_name: item?.source_name || "",
  web_url: item?.web_url || "",
  status: item?.status || "",
});
function DiscoveryCard({ item }) {
  const row = normalise(item);
  let when = "";
  if (row.start_time) {
    const date = new Date(row.start_time);
    when = dateOnly(row.start_time) ? row.start_time.split("-").reverse().join("/") : Number.isNaN(date.getTime()) ? row.start_time : date.toLocaleString("en-GB", {dateStyle:"medium", ...(row.start_time.includes("T") ? {timeStyle:"short"} : {})});
  }
  return <article className="flex gap-3 rounded-xl border border-white/10 bg-mg-card p-3">
    {row.poster_url ? <img className="h-24 w-16 shrink-0 rounded object-cover" src={row.poster_url} loading="lazy" alt="" /> : <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-white/5"><Tv className="h-5 w-5 text-mg-green" /></div>}
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-white">{row.title}</h3>
      {when && <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60"><CalendarDays className="h-3.5 w-3.5" />{when}</p>}
      {row.description && <p className="mt-2 line-clamp-3 text-sm text-white/60">{row.description}</p>}
      {(row.source_name || row.status) && <p className="mt-2 text-xs text-mg-green">{[row.source_name,row.status].filter(Boolean).join(" · ")}</p>}
      {/^https:\/\//i.test(row.web_url) && <a href={row.web_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-mg-green/30 px-3 py-1 text-xs font-semibold text-mg-green">Details <ExternalLink className="h-3 w-3" /></a>}
    </div>
  </article>;
}
async function discovery(action, region, signal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  else signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 25000);
  try {
    const response = await fetch(API, {
      method: "POST", credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, region, date: TODAY() }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data?.error || !Array.isArray(data?.results)) {
      throw new Error(data?.error || "Discovery service unavailable");
    }
    return data.results;
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) {
      throw new Error("Discovery request timed out. Please try Refresh.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
export default function WatchmodeHub() {
  const [tab, setTab] = useState("releases");
  const [region, setRegion] = useState("GB");
  const [releaseType, setReleaseType] = useState("movie");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const cacheKey = ["watch-next", tab, region, tab === "releases" ? releaseType : "", TODAY()].join(":");
  const load = useCallback(async (signal) => {
    // Keep previously viewed public schedules visible while refreshing.
    const maxAge = tab === "releases" ? 12 * 60 * 60_000 : 4 * 60 * 60_000;
    const cached = readPublicSection(cacheKey, maxAge);
    const savedRows = Array.isArray(cached?.data?.rows) ? cached.data.rows : [];
    setRows(savedRows);
    setError("");
    setLoading(!cached);
    setRefreshing(Boolean(cached));
    try {
      let nextRows;
      let stale = false;
      if (tab === "releases") {
        // Only request the selected release type. Previously each tab switch
        // waited for both film and TV lookups, doubling network traffic.
        const response = await base44.functions.invoke("getTmdbMovies", {
          category: releaseType === "movie" ? "upcoming" : "tv_upcoming",
          media_type: releaseType, region, date: TODAY(),
          ...(releaseType === "movie" ? { include_global_releases: true } : {}),
        });
        if (signal.aborted) return;
        const items = response?.data?.movies || response?.movies;
        if (!Array.isArray(items)) throw new Error("Film and TV release data is temporarily unavailable");
        nextRows = orderUpcomingReleases(items, releaseType, TODAY());
        stale = response?.stale === true;
      } else {
        nextRows = await discovery(tab, region, signal);
      }
      if (signal.aborted) return;
      setRows(nextRows);
      if (stale) {
        setError(nextRows.length
          ? "The live catalogue could not be refreshed. Showing previously saved releases; try again shortly."
          : "The live catalogue is temporarily unavailable. Please try Refresh.");
      } else {
        savePublicSection(cacheKey, { rows: nextRows });
      }
    } catch (e) {
      if (!signal.aborted) setError(savedRows.length
        ? "The live guide could not be refreshed. Showing the last saved results; try again shortly."
        : e?.message || "Discovery temporarily unavailable");
    } finally {
      if (!signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [tab, region, releaseType, cacheKey]);
  useEffect(()=> { const controller = new AbortController(); void load(controller.signal); return ()=>controller.abort(); },[load,reload]);
  return <div data-mg-watchmode-hub="true" className="w-full p-3 sm:p-5 md:p-6 text-white">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-mg-green">TMDB · TVmaze · TheSportsDB</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">What to watch</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">Film releases, scheduled TV episodes and selected upcoming sports fixtures. No Watchmode account required.</p></div>
      <label className="text-xs text-white/60">Country<select aria-label="Discovery country" value={region} onChange={event=>setRegion(event.target.value)} className="mt-1 block min-h-10 rounded-lg border border-white/10 bg-mg-card px-3 text-sm text-white">
        <option value="GB">United Kingdom</option><option value="US">United States</option><option value="CA">Canada</option><option value="AU">Australia</option></select></label>
    </header>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Discovery sections">{tabs.map(t=>{const Icon=t.icon;return <button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${tab===t.id?"border-mg-green bg-mg-green text-black":"border-white/10 bg-white/5 text-white/70"}`}><Icon className="h-4 w-4" />{t.label}</button>})}</div>
    {tab === "releases" && <div className="mb-4 flex gap-2" role="group" aria-label="Release type"><button onClick={()=>setReleaseType("movie")} aria-pressed={releaseType==="movie"} className={`min-h-10 rounded-lg border px-4 text-sm font-semibold ${releaseType==="movie"?"border-mg-green bg-mg-green text-black":"border-white/10 text-white/70"}`}>Films</button><button onClick={()=>setReleaseType("tv")} aria-pressed={releaseType==="tv"} className={`min-h-10 rounded-lg border px-4 text-sm font-semibold ${releaseType==="tv"?"border-mg-green bg-mg-green text-black":"border-white/10 text-white/70"}`}>TV premieres</button></div>}
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-white/60">{tab==="sports"?"Selected fixtures from TheSportsDB's limited free feed":tab==="tv"?"TVmaze scheduled episodes":releaseType==="movie"?"Upcoming film releases from TMDB":"Upcoming TV series premieres (not new episodes)"}</p><button onClick={()=>setReload(x=>x+1)} disabled={loading || refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold"><RefreshCw className="h-4 w-4" />Refresh</button></div>
    {loading && <p role="status" className="flex min-h-24 items-center gap-2 text-sm text-white/60"><Loader2 className="h-5 w-5 animate-spin" />Loading discovery…</p>}
    {!loading && error && <p role="alert" className="mb-4 flex gap-2 rounded-lg border border-amber-400/30 p-4 text-sm text-amber-100"><AlertCircle className="h-5 w-5 shrink-0" />{error}</p>}
    {!loading && !error && !rows.length && <p className="rounded-xl bg-mg-card p-6 text-sm text-white/60">No confirmed upcoming entries available for this selection right now.</p>}
    {!loading && rows.length>0 && <div className="grid gap-3 lg:grid-cols-2">{rows.map((item,index)=><DiscoveryCard item={item} key={item?.id||index}/>)}</div>}
    <p className="mt-6 border-t border-white/10 pt-4 text-xs text-white/40">Sports information is a limited fixture sample, not a live score or streaming guide. Listed programmes and releases are not guaranteed playable; provider coverage and dates can change.</p>
  </div>;
}
