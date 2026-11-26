import { attachMediaGodControls } from "./media-god-controls.js";
const status=document.getElementById("status");
const stage=document.getElementById("stage");
const ready=import("./vendor/element.js").then(()=>customElements.whenDefined("movi-player"));
let initialized=false;
window.addEventListener("message",async event=>{
  if(initialized||event.source!==parent||!["https://www.underworldhub.co.uk","https://underworldhub.co.uk","https://media-god-independent-web-production.up.railway.app"].includes(event.origin)||event.data?.type!=="personal-range-init"||!event.ports[0]||!Number.isSafeInteger(event.data.size)||event.data.size<=0)return;
  initialized=true;const port=event.ports[0];const size=event.data.size;let id=0;const pending=new Map();
  port.onmessage=({data:m})=>{const entry=pending.get(m?.id);if(!entry)return;pending.delete(m.id);clearTimeout(entry.timer);if(m.data instanceof ArrayBuffer)entry.resolve(m.data);else entry.reject(Error("Personal media read failed"));};
  try{await ready;const player=document.createElement("movi-player");player.setAttribute("controls","");player.setAttribute("sw","true");player.setAttribute("engine","wasm");player.setAttribute("playsinline","");player.setAttribute("theme","dark");player.addEventListener("nativefallback",()=>{player.pause?.();status.textContent="Native fallback stopped.";});player.addEventListener("error",()=>{status.textContent="Movi could not decode this personal file.";});stage.appendChild(player);const detachControls=attachMediaGodControls(player,stage,status);window.addEventListener("pagehide",()=>{detachControls();player.pause?.();player.sourceAdapter?.close?.();},{once:true});
  player.sourceAdapter={getSize:async()=>size,getKey:()=>"personal-session",seek:o=>o,getPosition:()=>0,close(){port.close();for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error("Player closed"));}pending.clear();},read(offset,length){return new Promise((resolve,reject)=>{const request=++id;const timer=setTimeout(()=>{pending.delete(request);reject(Error("Personal file read timed out"));},20000);pending.set(request,{resolve,reject,timer});port.postMessage({type:"range",id:request,offset,length});});}};
  status.textContent="Personal file ready — press Play.";
  }catch{status.textContent="Could not open Movi Player.";}
});
