import React,{useEffect,useRef,useState} from "react";
import {personalPlaybackEvidence} from "./personalBrowserPlaybackEvidence.js";

export default function PersonalBrowserVerification(){
  const [file,setFile]=useState(null);
  const [result,setResult]=useState(null);
  const [running,setRunning]=useState(false);
  const videoRef=useRef(null), graph=useRef(null), stop=useRef(null);
  const [url,setUrl]=useState("");
  useEffect(()=>{
    setResult(null);
    if(!file){setUrl("");return;}
    const localUrl=URL.createObjectURL(file);
    setUrl(localUrl);
    return ()=>{stop.current?.();stop.current=null;URL.revokeObjectURL(localUrl);};
  },[file]);
  useEffect(()=>()=>{stop.current?.();graph.current?.context.close().catch(()=>{});},[]);
  const choose=event=>{
    stop.current?.();stop.current=null;
    graph.current?.context.close().catch(()=>{});graph.current=null;
    setRunning(false);setResult(null);
    setFile(event.target.files?.[0]||null);
  };
  const verify=async()=>{
    const video=videoRef.current;
    if(!video||running)return;
    setRunning(true);setResult({state:"pending",reason:"Measuring decoded picture and audio…"});
    let cancelled=false,timer=null,frameHandle=null;
    const cleanup=()=>{cancelled=true;if(timer!==null)clearTimeout(timer);
      if(frameHandle!==null)video.cancelVideoFrameCallback?.(frameHandle);};
    stop.current=cleanup;
    let analyser=null,context=null;
    try{
      const AudioCtor=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(AudioCtor){
        if(!graph.current){
          context=new AudioCtor();
          const source=context.createMediaElementSource(video);
          analyser=context.createAnalyser();
          source.connect(analyser);analyser.connect(context.destination);
          graph.current={context,analyser};
        }else({context,analyser}=graph.current);
        await context.resume();
      }
    }catch{analyser=null;}
    if(cancelled)return;
    try{await video.play();}catch{
      if(!cancelled){setResult(personalPlaybackEvidence({errorCode:video.error?.code,paused:true}));setRunning(false);}
      cleanup();return;
    }
    if(cancelled)return;
    let presented=0;
    if(typeof video.requestVideoFrameCallback==="function"){
      const frame=()=>{if(cancelled)return;presented++;frameHandle=video.requestVideoFrameCallback(frame);};
      frameHandle=video.requestVideoFrameCallback(frame);
    }
    const quality=()=>{try{return video.getVideoPlaybackQuality?.().totalVideoFrames;}catch{return null;}};
    const startFrames=quality(),start=video.currentTime,deadline=performance.now()+7000;
    let peak=0;
    const samples=analyser?new Float32Array(analyser.fftSize):null;
    const measure=()=>{
      if(cancelled)return;
      if(samples&&context?.state==="running"){
        analyser.getFloatTimeDomainData(samples);
        for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
      }
      const nowFrames=quality();
      const evidence=personalPlaybackEvidence({errorCode:video.error?.code,paused:video.paused,
        advancedMs:(video.currentTime-start)*1000,width:video.videoWidth,
        frames:Math.max(presented,Number.isFinite(startFrames)&&Number.isFinite(nowFrames)?nowFrames-startFrames:0),
        audioAvailable:!!samples&&context?.state==="running",audioPeak:peak});
      if(evidence.state!=="pending"||performance.now()>=deadline||video.ended){
        setResult(evidence);setRunning(false);cleanup();return;
      }
      timer=setTimeout(measure,200);
    };
    measure();
  };
  return <section className="mt-4 rounded-lg border border-white/15 p-3">
    <h3 className="font-semibold">Standard browser compatibility test</h3>
    <p className="mt-1 text-xs text-white/70">Select a personal video you have permission to play. The file remains on your device. Verify moving picture and decoded sound on this browser; missing evidence stays unconfirmed.</p>
    <input type="file" accept="video/*,.mkv,.avi,.mp4,.webm" aria-label="Select a personal video for browser verification" onChange={choose} className="mt-3 block max-w-full text-sm"/>
    {url&&<><video key={url} ref={videoRef} src={url} controls playsInline preload="metadata" className="mt-3 w-full max-h-96 bg-black"/>
      <button type="button" onClick={verify} disabled={running} className="mt-2 rounded bg-mg-green px-3 py-2 text-black font-semibold">{running?"Checking picture and sound…":"Verify playback"}</button></>}
    {result&&<p role="status" className="mt-2 text-sm text-white/80">{result.state==="verified"?"Verified: ":result.state==="rejected"?"Not supported: ":"Not yet verified: "}{result.reason}</p>}
  </section>;
}
