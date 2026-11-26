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
export function attachMediaGodControls(player,stage,status){
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
  const position=document.createElement("input");
  position.type="range";position.min="0";position.step="0.25";position.value="0";
  position.setAttribute("aria-label","Playback position");bar.appendChild(position);
  const clock=document.createElement("span");clock.setAttribute("aria-live","off");bar.appendChild(clock);
  position.addEventListener("change",()=>{const target=boundedSeek(position.value,player.duration);if(target!==null)try{player.currentTime=target;}catch{}});
  const speed=document.createElement("select");speed.setAttribute("aria-label","Playback speed");
  for(const rate of [0.75,1,1.25,1.5,2]){const opt=document.createElement("option");opt.value=String(rate);opt.textContent=rate+"×";speed.appendChild(opt);}
  speed.value="1";speed.addEventListener("change",()=>{try{player.playbackRate=Number(speed.value);update();}catch{status.textContent="Playback speed is unavailable.";}});
  bar.appendChild(speed);
  function update(){
    if(closed)return;
    const duration=Number(player.duration),time=Number(player.currentTime);
    const canSeek=Number.isFinite(duration)&&duration>0;
    back.disabled=forward.disabled=position.disabled=!canSeek;
    position.max=canSeek?String(duration):"0";position.value=String(canSeek?(boundedSeek(time,duration)??0):0);
    clock.textContent=displayTime(time)+" / "+displayTime(duration);
    play.textContent=player.paused?"Play":"Pause";
    mute.textContent=player.muted?"Unmute":"Mute";
    speed.disabled=typeof player.playbackRate!=="number";
    if(!speed.disabled)speed.value=String(player.playbackRate);
  }
  const events=["loadedmetadata","durationchange","timeupdate","play","pause","ended","volumechange","ratechange"];
  for(const event of events)player.addEventListener(event,update);
  stage.appendChild(bar);update();
  return ()=>{closed=true;for(const event of events)player.removeEventListener(event,update);bar.remove();};
}
