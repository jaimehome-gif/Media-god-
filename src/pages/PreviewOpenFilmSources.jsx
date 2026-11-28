import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import VideoPlayer from "@/components/mg/VideoPlayer.jsx";
import { OPEN_FILMS, searchOpenFilm } from "./previewOpenFilmSources.js";

export default function PreviewOpenFilmSources() {
  const [film,setFilm]=useState(OPEN_FILMS[0]);
  const [choices,setChoices]=useState([]);
  const [request,setRequest]=useState(null);
  const [message,setMessage]=useState("Choose an openly licensed film and find its live source variants.");
  const [busy,setBusy]=useState(false);
  const controller=useRef(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  if (globalThis.location?.hostname!=="media-god-audio-test-preview-production.up.railway.app") return null;
  const find=async selected=>{
    controller.current?.abort();
    const op=new AbortController();controller.current=op;
    setFilm(selected);setChoices([]);setRequest(null);setBusy(true);setMessage("Searching Wikimedia Commons for available media files…");
    try {
      const rows=await searchOpenFilm(selected,op.signal);
      if(op.signal.aborted)return;
      setChoices(rows);
      setMessage(rows.length?rows.length+" live source choices found. Select one manually or let Media God try them in order.":"No supported variants were returned by the provider.");
    } catch(e){if(!op.signal.aborted)setMessage("Source search failed: "+e.message);}
    finally{if(!op.signal.aborted)setBusy(false);}
  };
  const play=(selected=null)=>{
    const ordered=selected?[selected,...choices.filter(c=>c.id!==selected.id)]:choices;
    if(!ordered.length)return;
    setRequest({title:film.title,year:film.year,mediaType:"movie",type:"movie",
      id:"open-preview-"+film.year,playRequestId:String(Date.now()),sources:ordered,completeSources:ordered,
      openSourcesDrawer:!selected,manualSourceSelection:!!selected,skipAddonLookup:true,skipRdLookup:true,noRd:true,
      allowNonPlaybackFallback:false,verifiedPlaybackPolicy:"manual",startTime:0});
  };
  return <main className="min-h-screen bg-mg-background text-white p-4 sm:p-6">
    <div className="max-w-4xl mx-auto space-y-4">
      <Link to="/sources-test" className="text-mg-green">Back to generated tests</Link>
      <h1 className="text-2xl font-bold">Media God — live open-film Sources</h1>
      <p className="text-sm text-white/70">Real public media lookup and actual hosted film files, using the Media God website player. No simulated source response or account credentials. Films by Blender Foundation / Blender Institute, CC BY 3.0.</p>
      <label className="block">Film <select value={film.title} onChange={e=>{controller.current?.abort();setBusy(false);setRequest(null);setChoices([]);setFilm(OPEN_FILMS.find(f=>f.title===e.target.value));setMessage("Press Find Sources.");}} className="ml-2 bg-mg-card rounded p-2">{OPEN_FILMS.map(f=><option key={f.title}>{f.title}</option>)}</select></label>
      <button disabled={busy} onClick={()=>find(film)} className="bg-mg-green text-black font-semibold rounded px-4 py-3 disabled:opacity-50">{busy?"Searching…":"Find Sources"}</button>
      <p role="status">{message}</p>
      {choices.length>0&&<><button onClick={()=>play()} className="bg-mg-green text-black font-semibold rounded px-4 py-3">Play in Media God — automatic</button>
      {choices.map(c=><button key={c.id} onClick={()=>play(c)} className="block w-full text-left rounded border border-white/20 p-3">{c.label}</button>)}</>}
      <a href={"https://commons.wikimedia.org/wiki/"+encodeURIComponent(film.file.replaceAll(" ","_"))} target="_blank" rel="noreferrer" className="block text-sm text-mg-green">Original film and attribution</a>
      <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer" className="block text-sm text-mg-green">Creative Commons Attribution 3.0 license</a>
      {request&&<VideoPlayer key={request.playRequestId} source={request} onClose={()=>setRequest(null)} />}
    </div>
  </main>;
}
