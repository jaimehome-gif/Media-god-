import { attachMediaGodControls, resumePoint } from "./media-god-controls.js";
const input = document.getElementById("file");
const clear = document.getElementById("close");
const status = document.getElementById("status");
const stage = document.getElementById("stage");
let detachControls = null;
let activeFile = null;
const sessionPositions = new Map();
const fileKey = file => JSON.stringify([file.name,file.size,file.lastModified]);
function reset() {
  if(activeFile){
    const {key,player}=activeFile;
    const point=resumePoint(player.currentTime,player.duration);
    if(point){sessionPositions.delete(key);sessionPositions.set(key,point);}
    else if(player.ended || player.currentTime>0)sessionPositions.delete(key);
    while(sessionPositions.size>32)sessionPositions.delete(sessionPositions.keys().next().value);
    activeFile=null;
  }
  detachControls?.(); detachControls = null;
  for (const child of stage.children) child.pause?.();
  stage.replaceChildren();
  clear.disabled = true;
}
try {
  await import("./vendor/element.js");
  await customElements.whenDefined("movi-player");
  input.disabled = false;
  status.textContent = "Select a personal video.";
  input.addEventListener("change", () => {
    reset();
    const file = input.files?.[0];
    if (!(file instanceof File) || !file.size) {
      status.textContent = "Select a non-empty video file.";
      return;
    }
    const player = document.createElement("movi-player");
    player.setAttribute("controls", "");
    player.setAttribute("sw", "true");
    player.setAttribute("engine", "wasm");
    player.setAttribute("playsinline", "");
    player.setAttribute("theme", "dark");
    player.addEventListener("nativefallback", () => {
      player.pause?.();
      status.textContent = "Unexpected native fallback. Playback stopped.";
    });
    player.addEventListener("play", () => { status.textContent = file.name + " — playing."; });
    player.addEventListener("error", () => { status.textContent = "Movi could not decode this file."; });
    stage.appendChild(player);
    const key=fileKey(file);
    activeFile={key,player};
    detachControls = attachMediaGodControls(player, stage, status,{resumeAt:sessionPositions.get(key)||0});
    clear.disabled = false;
    try {
      player.src = file;
      status.textContent = file.name + " — press Play.";
    } catch {
      reset();
      status.textContent = "Movi could not open this file.";
    }
  });
  clear.addEventListener("click", () => {
    reset();
    input.value = "";
    status.textContent = "Select another personal video.";
  });
} catch {
  status.textContent = "Movi could not load. No alternate player opened.";
}
