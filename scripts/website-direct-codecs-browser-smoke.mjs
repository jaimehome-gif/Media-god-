import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:https";
import puppeteer from "puppeteer-core";

// Generated test patterns and tone; no external media or source providers.
const dir = await mkdtemp(join(tmpdir(), "mg-browser-codecs-"));
let browser, server;
const run = (exe, args) => {
  const result = spawnSync(exe, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, exe + " failed");
};
try {
  const common = ["-hide_banner","-loglevel","error","-y","-f","lavfi","-i","testsrc2=size=320x180:rate=24",
    "-f","lavfi","-i","sine=frequency=440:sample_rate=48000","-t","4"];
  run("ffmpeg", [...common,"-c:v","libx264","-profile:v","baseline","-pix_fmt","yuv420p","-c:a","aac","-ac","2","-movflags","+faststart",join(dir,"sample.mp4")]);
  run("ffmpeg", [...common,"-c:v","libvpx-vp9","-b:v","300k","-c:a","libopus","-ac","2",join(dir,"sample.webm")]);
  run("openssl", ["req","-x509","-newkey","rsa:2048","-keyout",join(dir,"key.pem"),"-out",join(dir,"cert.pem"),"-days","1","-nodes","-subj","/CN=localhost"]);
  await writeFile(join(dir,"index.html"),"<!doctype html><title>Generated media test</title>");
  const policy = await readFile(new URL("../src/components/mg/websiteDirectMediaPolicy.js",import.meta.url));
  const files = new Map([
    ["/",["text/html",await readFile(join(dir,"index.html"))]],
    ["/policy.mjs",["text/javascript",policy]],
    ["/sample.mp4",["video/mp4",await readFile(join(dir,"sample.mp4"))]],
    ["/sample.webm",["video/webm",await readFile(join(dir,"sample.webm"))]],
  ]);
  server = createServer({key:await readFile(join(dir,"key.pem")),cert:await readFile(join(dir,"cert.pem"))},(req,res)=>{
    const file = files.get(req.url);
    if (!file) { res.writeHead(404).end(); return; }
    const [mime, body] = file;
    res.writeHead(200,{"Content-Type":mime,"Content-Length":body.length,"Cache-Control":"no-store"}).end(body);
  });
  await new Promise((resolve,reject)=>{ server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
  browser = await puppeteer.launch({executablePath:process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless:true,acceptInsecureCerts:true,args:["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"]});
  const page = await browser.newPage();
  await page.goto("https://127.0.0.1:"+server.address().port+"/");
  for (const [name,v,a] of [["sample.mp4","h264","aac"],["sample.webm","vp9","opus"]]) {
    const result = await page.evaluate(async ({name,v,a})=>{
      const mod = await import("/policy.mjs");
      const url = new URL(name,location.href).href;
      const gate = mod.checkWebsiteDirectMedia({url,item:{mediaInfo:{video_tracks:[{codec:v}],audio_tracks:[{codec:a}]}},...mod.getBrowserMediaCapabilities()});
      if (!gate.allowed) return {gate};
      const video = document.createElement("video");
      video.src=url; video.volume=1; video.muted=false; document.body.append(video);
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaElementSource(video);
      const analyser = context.createAnalyser();
      source.connect(analyser); analyser.connect(context.destination);
      try {
        await video.play();
        await new Promise(resolve=>setTimeout(resolve,1400));
        const samples=new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);
        return {gate,time:video.currentTime,decodedFrames:video.getVideoPlaybackQuality().totalVideoFrames,
          width:video.videoWidth,height:video.videoHeight,audioRms:rms,muted:video.muted};
      } finally {video.pause();video.remove();await context.close();}
    },{name,v,a});
    console.log(name,JSON.stringify(result));
    assert.equal(result.gate.allowed,true,name+" compatibility gate");
    assert.ok(result.time>0 && result.decodedFrames>0 && result.width>0 && result.height>0,name+" decoded video");
    assert.ok(result.audioRms>0.001 && !result.muted,name+" non-silent decoded audio signal");
  }
  console.log("PASS: synthetic browser direct-media audio/video; not a production integration test.");
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve=>server.close(resolve));
  await rm(dir,{recursive:true,force:true});
}
