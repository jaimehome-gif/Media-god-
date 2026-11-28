import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PlayerProvider } from "@/components/mg/PlayerProvider";
import Sources from "@/components/mg/MediaStreamSourcesBox";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";

const PREVIEW_HOST = "media-god-audio-test-preview-production.up.railway.app";
const initial = {title:"", year:"", tmdbId:"", imdbId:"", mediaType:"movie", season:"1", episode:"1"};
export default function PreviewAccountSources() {
  const [permission,setPermission] = useState("checking");
  const [account,setAccount] = useState(null);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [form,setForm] = useState(initial);
  const [authorised,setAuthorised] = useState(false);
  const [selected,setSelected] = useState(null);
  const onPreview = globalThis.location?.hostname === PREVIEW_HOST;
  useEffect(()=>{
    if (!onPreview) return;
    let active=true;
    base44.auth.getRegistrationConfig().then(async ()=>{
      if (!active) return;
      setPermission("allowed");
      if (base44.auth.getAccessToken()) {
        try {const user=await base44.auth.me();if(active)setAccount(user);}
        catch {if(active)setMessage("Existing session could not be verified; sign in again.");}
      }
    }).catch(()=>{if(active)setPermission("blocked");});
    return ()=>{active=false;};
  },[onPreview]);
  const signIn=async e=>{
    e.preventDefault();
    if(permission!=="allowed"||busy)return;
    setBusy(true);setMessage("");
    try {
      await base44.auth.loginViaEmailPassword(email,password);
      setPassword("");
      setAccount(await base44.auth.me());
    } catch {setMessage("Sign-in was not verified. Check the account or API origin configuration.");}
    finally {setPassword("");setBusy(false);}
  };
  const signOut=async ()=>{
    setSelected(null);setAccount(null);setAuthorised(false);
    await base44.auth.logout();
  };
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const find=e=>{
    e.preventDefault();
    if(!account||!authorised)return;
    if(!form.title.trim()||!(/^tt\d+$/.test(form.imdbId.trim())||/^\d+$/.test(form.tmdbId.trim()))){setMessage("Enter a title and a valid IMDb or TMDB ID.");return;}
    setMessage("");
    setSelected({...form,title:form.title.trim(),imdbId:form.imdbId.trim(),tmdbId:form.tmdbId.trim() ? Number(form.tmdbId) : undefined,requestId:Date.now()});
  };
  if(!onPreview)return null;
  return <main className="min-h-screen bg-mg-background text-white p-4 sm:p-6">
    <div className="max-w-4xl mx-auto space-y-4">
      <a className="text-mg-green" href="/sources-test">Back to isolated tests</a>
      <h1 className="text-2xl font-bold">Media God — account Sources preview</h1>
      <p className="text-sm text-white/70">This uses the existing Media God account service, Sources panel and playback provider without simulated responses. Test only content you own or have permission to access. This is a separate browser session; production playback code is unchanged.</p>
      {permission==="checking"&&<p role="status">Checking API access…</p>}
      {permission==="blocked"&&<p role="alert">The account API did not permit the preview origin. Sign-in is disabled until the service owner explicitly adds this origin to the existing allowed origins.</p>}
      {permission==="allowed"&&!account&&<form onSubmit={signIn} className="grid gap-3 max-w-md">
        <label>Email<input className="block w-full rounded bg-mg-card p-3" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Password<input className="block w-full rounded bg-mg-card p-3" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button disabled={busy} className="rounded bg-mg-green p-3 text-black font-semibold">Sign in to Media God</button>
      </form>}
      {account&&<><button onClick={signOut} className="border rounded p-2">Sign out of preview</button>
        <form onSubmit={find} className="grid gap-3">
          <label>Authorised media title<input required className="block w-full rounded bg-mg-card p-3" value={form.title} onChange={e=>change("title",e.target.value)} /></label>
          <label>IMDb ID<input className="block w-full rounded bg-mg-card p-3" placeholder="tt1234567" value={form.imdbId} onChange={e=>change("imdbId",e.target.value)} /></label>
          <label>TMDB ID (alternative)<input className="block w-full rounded bg-mg-card p-3" inputMode="numeric" value={form.tmdbId} onChange={e=>change("tmdbId",e.target.value)} /></label>
          <label>Release year<input className="block w-full rounded bg-mg-card p-3" inputMode="numeric" value={form.year} onChange={e=>change("year",e.target.value)} /></label>
          <label>Media type <select className="rounded bg-mg-card p-2" value={form.mediaType} onChange={e=>change("mediaType",e.target.value)}><option value="movie">Movie</option><option value="tv">TV episode</option></select></label>
          {form.mediaType==="tv"&&<div className="flex gap-3"><label>Season<input className="block rounded bg-mg-card p-2 w-24" type="number" min="1" required value={form.season} onChange={e=>change("season",e.target.value)} /></label><label>Episode<input className="block rounded bg-mg-card p-2 w-24" type="number" min="1" required value={form.episode} onChange={e=>change("episode",e.target.value)} /></label></div>}
          <label className="flex gap-2"><input type="checkbox" checked={authorised} onChange={e=>{setAuthorised(e.target.checked);if(!e.target.checked)setSelected(null);}} />I own this media or have permission to access it.</label>
          <button disabled={!authorised} className="rounded bg-mg-green text-black font-semibold p-3 disabled:opacity-50">Find Sources</button>
        </form>
        <QueryClientProvider client={queryClientInstance}><PlayerProvider>
          {selected&&authorised&&<Sources key={selected.requestId} title={selected.title} tmdbId={selected.tmdbId} imdbId={selected.imdbId} rdYear={selected.year} mediaType={selected.mediaType} season={selected.mediaType==="tv"?Number(selected.season):null} episode={selected.mediaType==="tv"?Number(selected.episode):null} providers={[]} />}
        </PlayerProvider></QueryClientProvider>
      </>}
      {message&&<p role="status">{message}</p>}
    </div>
  </main>;
}
