import React, { useEffect, useRef, useState } from "react";
import { addMediaServer, readMediaServers, removeMediaServer } from "@/components/mg/sourceRegistry";
import { personalEndpoint, searchPersonalLibrary, personalFileEndpoint, readPersonalRange } from "@/components/mg/personalMoviLibrary";
import { canOpenPersonalMovi } from "@/components/mg/PersonalMoviSource";
const initial = {type:"jellyfin",name:"",baseUrl:"",apiKey:"",userId:""};
export default function PersonalServerMovi({ initialItem = null, playbackOnly = false, onClose } = {}) {
  const [servers,setServers]=useState(readMediaServers);
  const [form,setForm]=useState(initial);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [status,setStatus]=useState("");
  const [active,setActive]=useState(null);
  const [busy,setBusy]=useState(false);
  const frame=useRef(null);
  const connection=useRef(null);
  const operation=useRef(null);
  const stop=()=>{operation.current?.abort();operation.current=null;connection.current?.close();connection.current=null;};
  useEffect(()=>()=>{operation.current?.abort();connection.current?.close();},[]);
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const save=e=>{e.preventDefault();try{personalEndpoint(form,"/");if(!form.name.trim())throw Error("Enter a server name");addMediaServer(form);setServers(readMediaServers());setForm(initial);setStatus("Personal server saved.");}catch(error){setStatus(error.message);}};
  const search=async e=>{e.preventDefault();stop();setActive(null);setBusy(true);setResults([]);const controller=new AbortController();operation.current=controller;try{const list=await Promise.allSettled(servers.filter(s=>s.active!==false).map(s=>searchPersonalLibrary(s,query.trim(),controller.signal)));if(controller.signal.aborted)return;const rows=list.flatMap(x=>x.status==="fulfilled"?x.value:[]);setResults(rows);setStatus(rows.length?"Select a personal file.":"No results. Check server login, HTTPS and CORS.");}finally{if(!controller.signal.aborted)setBusy(false);}};
  const play=async item=>{stop();setActive(null);setStatus("Checking personal file…");setBusy(true);const controller=new AbortController();operation.current=controller;try{const server=servers.find(s=>s.id===item.serverId&&s.active!==false);if(!server)throw Error("Personal server unavailable");const url=await personalFileEndpoint(server,item,controller.signal);const probe=await readPersonalRange(server,url,0,1,controller.signal);if(!controller.signal.aborted){setActive({server,url,size:probe.size,item,controller});setStatus("Opening Movi Player…");}}catch(error){if(!controller.signal.aborted)setStatus(error.message);}finally{if(!controller.signal.aborted)setBusy(false);}};
  useEffect(()=>{if(initialItem && canOpenPersonalMovi()) void play(initialItem);},[initialItem]);
  const connect=()=>{if(!active||active.controller.signal.aborted||!frame.current?.contentWindow)return;connection.current?.close();const channel=new MessageChannel();connection.current=channel.port1;let inFlight=0;channel.port1.onmessage=async ({data:m})=>{if(!m||m.type!=="range"||!Number.isSafeInteger(m.id))return;if(inFlight>=4){channel.port1.postMessage({id:m.id,error:"Too many reads"});return;}inFlight++;try{if(Number.isSafeInteger(m.offset)&&m.offset>=active.size){const data=new ArrayBuffer(0);channel.port1.postMessage({id:m.id,data},[data]);return;}const r=await readPersonalRange(active.server,active.url,m.offset,m.length,active.controller.signal);if(r.size!==active.size)throw Error("Media changed");channel.port1.postMessage({id:m.id,data:r.data},[r.data]);}catch{channel.port1.postMessage({id:m.id,error:"Personal media read failed"});}finally{inFlight=Math.max(0,inFlight-1);}};frame.current.contentWindow.postMessage({type:"personal-range-init",size:active.size},"*",[channel.port2]);setStatus(active.item.title+" — press Play in Movi.");};
  if(!canOpenPersonalMovi()) return null;
  return <section data-mg-personal-server-player="true" className="mt-5 rounded-xl border border-white/10 bg-mg-card p-4 space-y-3">
    <h2 className="font-bold">Personal server Sources</h2><p className="text-sm text-white/60">Connect your own Plex, Jellyfin or Emby library over HTTPS. Only the chosen personal file is sent to Movi as byte ranges; server keys stay in the parent page.</p>
    {playbackOnly && <button type="button" onClick={()=>{stop();onClose?.();}} className="rounded border border-white/20 px-3 py-2">Back to Sources</button>}
    {!playbackOnly && <><form onSubmit={save} className="grid gap-2">
      <select aria-label="Server type" value={form.type} onChange={e=>change("type",e.target.value)} className="bg-black/40 p-2"><option value="jellyfin">Jellyfin</option><option value="emby">Emby</option><option value="plex">Plex</option></select>
      {["name","baseUrl","apiKey","userId"].map(key=><input key={key} aria-label={key} type={key==="apiKey"?"password":"text"} placeholder={{name:"Server name",baseUrl:"https://your-media-server",apiKey:"Personal server API key / token",userId:"User ID (optional)"}[key]} value={form[key]} onChange={e=>change(key,e.target.value)} className="rounded bg-black/40 p-2" />)}
      <button className="rounded bg-mg-green p-2 font-semibold text-black">Save personal server</button>
    </form>
    {servers.map(s=><div key={s.id} className="flex items-center justify-between gap-2"><span>{s.name} · {s.type}</span><button type="button" className="text-red-300" onClick={()=>{stop();setActive(null);setBusy(false);setResults([]);removeMediaServer(s.id);setServers(readMediaServers());}}>Remove</button></div>)}
    <form onSubmit={search} className="flex gap-2"><input aria-label="Search personal library" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 rounded bg-black/40 p-2" placeholder="Search personal files"/><button disabled={busy||query.trim().length<2||!servers.length} className="rounded bg-mg-green p-2 text-black disabled:opacity-40">Search</button></form></>}
    <p role="status" className="text-sm text-white/70">{status}</p>
    {results.map(item=><button key={item.serverId+":"+item.id} type="button" disabled={busy} onClick={()=>play(item)} className="block w-full rounded border border-white/10 p-3 text-left">{item.title} · Open in Movi</button>)}
    {active&&<><button type="button" onClick={()=>{stop();setActive(null);setStatus("Player closed.");if(playbackOnly)onClose?.();}}>Close player</button><iframe ref={frame} key={active.item.serverId+":"+active.item.id} onLoad={connect} title="Personal server Movi player" src="/decoder-lab/server.html" sandbox="allow-scripts" allow="fullscreen; autoplay" allowFullScreen className="h-[min(85vh,760px)] min-h-[480px] w-full rounded bg-black" /></>}
  </section>;
}
