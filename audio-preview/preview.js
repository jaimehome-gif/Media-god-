import {isWebsiteDirectSourceChoice,getBrowserMediaCapabilities} from "../src/components/mg/websiteDirectMediaPolicy.js";
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
// Synthetic choices only. Never accept a URL from a query string or a user.
const fixtures = Object.entries(samples).map(([key,[file,v,a]])=>({key,type:"file",src:new URL("/media/"+file,location.origin).href,mediaInfo:{video_tracks:[{codec:v}],audio_tracks:[{codec:a}]}}));
const invalid = [{...fixtures[0],key:"missing audio",mediaInfo:{video_tracks:[{codec:"h264"}]}},{...fixtures[0],key:"unsupported audio",mediaInfo:{video_tracks:[{codec:"h264"}],audio_tracks:[{codec:"dts"}]}}];
const caps=getBrowserMediaCapabilities();
const allowed=choice=>isWebsiteDirectSourceChoice({item:choice,originalItem:choice,url:choice.src,...caps});
for(const button of document.querySelectorAll("button[data-sample]")) button.hidden=!fixtures.some(choice=>choice.key===button.dataset.sample&&allowed(choice));
const result=document.createElement("p");
result.textContent="Current website codec policy: "+fixtures.filter(allowed).length+" of "+fixtures.length+" compatible fixture formats shown; "+invalid.filter(choice=>!allowed(choice)).length+" of "+invalid.length+" incompatible fixtures rejected. This tests the isolated policy, not the production catalogue.";
status.before(result);
