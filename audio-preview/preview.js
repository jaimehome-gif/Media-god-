import {mountSample} from "../tests/fixtures/website-direct-player.jsx";
const samples={mp4:["sample.mp4","h264","aac"],webm:["sample.webm","vp9","opus"],hls:["sample.m3u8","h264","aac"]};
const status=document.getElementById("status");
for(const button of document.querySelectorAll("button[data-sample]")) button.addEventListener("click",()=>{
  const [file,videoCodec,audioCodec]=samples[button.dataset.sample];
  try{
    const result=mountSample({url:new URL("/media/"+file,location.origin).href,videoCodec,audioCodec});
    if(!result.allowed){status.textContent=result.reason;return;}
    const video=document.querySelector("#root video");
    video.controls=true;
    status.textContent="Playing "+file+" — look for moving colours and listen for a tone.";
    video.addEventListener("error",()=>{status.textContent="Playback error: "+(video.error?.message||"unknown");},{once:true});
    video.play().catch(()=>{status.textContent="Press play on the video to start the test.";});
  }catch(error){status.textContent=error.message;}
});