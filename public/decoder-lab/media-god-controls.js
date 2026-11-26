// Shared web controls for explicitly selected personal local/server media.
// The decoder stays in its sandbox and is never replaced by a different player.
export function boundedSeek(time,duration,delta=0){
  const t=Number(time),d=Number(duration),step=Number(delta);
  if(!Number.isFinite(t)||!Number.isFinite(d)||d<=0||!Number.isFinite(step))return null;
  return Math.max(0,Math.min(d,t+step));
}
export function displayTime(value){
  const n=Math.max(0,Math.floor(Number(value)||0));
  if(!Number.isFinite(n))return "0:00";
  const m=Math.floor(n/60),s=String(n%60).padStart(2,"0");
  return m>=60?Math.floor(m/60)+":"+String(m%60).padStart(2,"0")+":"+s:m+":"+s;
}
export function resumePoint(time,duration){
  const t=boundedSeek(time,duration);
  return t!==null&&t>=5&&duration-t>=5?t:0;
}
export function languageOptions(rows){
  const seen=new Set();
  return (Array.isArray(rows)?rows:[]).filter(row=>{
    if(typeof row?.lang!=="string"||!row.lang||seen.has(row.lang))return false;
    seen.add(row.lang);return true;
  }).map(row=>({lang:row.lang,label:String(row.label||row.lang),active:row.active===true}));
}
export function attachMediaGodControls(player,stage,status,{resumeAt=0}={}){
  const bar=document.createElement("div");
  bar.className="mg-web-controls";
  bar.setAttribute("aria-label","Media God playback controls");
  let closed=false;
  const button=(label,action)=>{
    const b=document.createElement("button");b.type="button";b.textContent=label;
    b.addEventListener("click",action);bar.appendChild(b);return b;
  };
  const seek=(delta)=>{const target=boundedSeek(player.currentTime,player.duration,delta);
    if(target!==null)try{player.currentTime=target;}catch{status.textContent="Seeking is not available for this file.";}};
  const back=button("−10s",()=>seek(-10));
  const play=button("Play",async()=>{try{if(player.paused)await player.play();else player.pause();}
    catch{status.textContent="Playback could not start. Press Play to retry.";}});
  const forward=button("+10s",()=>seek(10));
  const mute=button("Mute",()=>{try{player.muted=!player.muted;update();}catch{}});
  button("Fullscreen",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();
    else if(stage.requestFullscreen)await stage.requestFullscreen();else status.textContent="Fullscreen is unavailable on this browser.";}
    catch{status.textContent="Fullscreen is unavailable on this browser.";}});
  const resume=button("Resume "+displayTime(resumeAt),async()=>{
    const target=resumePoint(resumeAt,player.duration);
    if(!target)return;
    try{player.currentTime=target;resumeAt=0;update();await player.play();}
    catch{status.textContent="Resume is unavailable for this file.";}
  });
  const volume=document.createElement("input");
  volume.type="range";volume.min="0";volume.max="1";volume.step="0.05";
  volume.setAttribute("aria-label","Volume");bar.appendChild(volume);
  volume.addEventListener("input",()=>{try{player.volume=Number(volume.value);if(player.volume>0)player.muted=false;}catch{}});
  const position=document.createElement("input");
  position.type="range";position.min="0";position.step="0.25";position.value="0";
  position.setAttribute("aria-label","Playback position");bar.appendChild(position);
  const clock=document.createElement("span");clock.setAttribute("aria-live","off");bar.appendChild(clock);
  position.addEventListener("change",()=>{const target=boundedSeek(position.value,player.duration);if(target!==null)try{player.currentTime=target;}catch{}});
  const speed=document.createElement("select");speed.setAttribute("aria-label","Playback speed");
  for(const rate of [0.75,1,1.25,1.5,2]){const opt=document.createElement("option");opt.value=String(rate);opt.textContent=rate+"×";speed.appendChild(opt);}
  speed.value="1";speed.addEventListener("change",()=>{try{player.playbackRate=Number(speed.value);update();}catch{status.textContent="Playback speed is unavailable.";}});
  bar.appendChild(speed);
  const menus=[];
  function trackMenu(label,read,select,allowOff){
    const menu=document.createElement("select");menu.setAttribute("aria-label",label);
    let signature="";
    const refresh=()=>{
      let rows=[];try{rows=languageOptions(player[read]?.());}catch{}
      const key=JSON.stringify(rows);
      if(key===signature)return;
      signature=key;menu.replaceChildren();
      if(allowOff){const off=document.createElement("option");off.value="";off.textContent="Subtitles off";menu.appendChild(off);}
      if(!rows.length&&!allowOff){const opt=document.createElement("option");opt.textContent="No audio languages listed";opt.value="";menu.appendChild(opt);}
      for(const row of rows){const opt=document.createElement("option");opt.value=row.lang;opt.textContent=row.label;opt.selected=row.active;menu.appendChild(opt);}
      if(allowOff&&!rows.some(row=>row.active))menu.value="";
      menu.disabled=!rows.length||typeof player[select]!=="function";
    };
    menu.addEventListener("change",async()=>{
      try{await player[select](menu.value||null);}
      catch{status.textContent=label+" selection was not available.";}
      signature="";refresh();
    });
    bar.appendChild(menu);menus.push(refresh);refresh();
  }
  trackMenu("Audio language","getAudioLangs","selectAudioLang",false);
  trackMenu("Subtitles","getSubtitleLangs","selectSubtitleLang",true);
  function update(){
    if(closed)return;
    const duration=Number(player.duration),time=Number(player.currentTime);
    const canSeek=Number.isFinite(duration)&&duration>0;
    back.disabled=forward.disabled=position.disabled=!canSeek;
    resume.hidden=!resumePoint(resumeAt,duration);
    volume.disabled=typeof player.volume!=="number";
    if(!volume.disabled)volume.value=String(player.volume);
    for(const refresh of menus)refresh();
    position.max=canSeek?String(duration):"0";position.value=String(canSeek?(boundedSeek(time,duration)??0):0);
    clock.textContent=displayTime(time)+" / "+displayTime(duration);
    play.textContent=player.paused?"Play":"Pause";
    mute.textContent=player.muted?"Unmute":"Mute";
    speed.disabled=typeof player.playbackRate!=="number";
    if(!speed.disabled)speed.value=String(player.playbackRate);
  }
  const events=["loadedmetadata","durationchange","timeupdate","play","pause","ended","volumechange","ratechange","audiotrackchange","subtitletrackchange"];
  for(const event of events)player.addEventListener(event,update);
  stage.appendChild(bar);update();
  return ()=>{closed=true;for(const event of events)player.removeEventListener(event,update);bar.remove();};
}
