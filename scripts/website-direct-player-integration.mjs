import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import puppeteer from "puppeteer-core";

// No provider requests, account credentials, or production data. The real
// LiveVideo component receives only locally generated, self-owned media.
const dir = await mkdtemp(join(tmpdir(), "mg-player-integration-"));
let browser, vite;
const run = (exe, args) => {
  const result = spawnSync(exe, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, exe + " failed");
};
try {
  const common = ["-hide_banner","-loglevel","error","-y","-f","lavfi","-i","testsrc2=size=320x180:rate=24",
    "-f","lavfi","-i","sine=frequency=440:sample_rate=48000","-t","7"];
  const avc = ["-c:v","libx264","-profile:v","baseline","-pix_fmt","yuv420p","-g","24","-c:a","aac","-ac","2"];
  run("ffmpeg", [...common,...avc,"-movflags","+faststart",join(dir,"sample.mp4")]);
  run("ffmpeg", [...common,"-c:v","libvpx-vp9","-b:v","300k","-c:a","libopus","-ac","2",join(dir,"sample.webm")]);
  run("ffmpeg", [...common,...avc,"-f","hls","-hls_time","1","-hls_playlist_type","vod",
    "-hls_segment_filename",join(dir,"segment%03d.ts"),join(dir,"sample.m3u8")]);
  run("openssl", ["req","-x509","-newkey","rsa:2048","-keyout",join(dir,"key.pem"),"-out",join(dir,"cert.pem"),"-days","1","-nodes","-subj","/CN=localhost"]);
  const files = new Map();
  for (const name of await readdir(dir)) {
    const mime = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".webm") ? "video/webm" :
      name.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : name.endsWith(".ts") ? "video/mp2t" : "";
    if (mime) files.set("/__mg_fixture/"+name,[mime,await readFile(join(dir,name))]);
  }
  vite = await createServer({
    configFile:false, root:fileURLToPath(new URL("../",import.meta.url)),
    resolve:{alias:{"@":fileURLToPath(new URL("../src",import.meta.url))}},
    appType:"custom",
    server:{host:"127.0.0.1",port:0,https:{key:await readFile(join(dir,"key.pem")),cert:await readFile(join(dir,"cert.pem"))}},
    plugins:[{name:"generated-media-only",configureServer(server){
      server.middlewares.use((req,res,next)=>{
        if (req.url === "/__mg_fixture/") {
          res.writeHead(200,{"Content-Type":"text/html"}).end('<!doctype html><title>Player integration</title><div id="root"></div>'); return;
        }
        const file = files.get(req.url);
        if (!file) { next(); return; }
        const [mime,body] = file;
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
        if (range) {
          const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : body.length-1, body.length-1);
          if (start > end || start >= body.length) {res.writeHead(416,{"Content-Range":"bytes */"+body.length}).end();return;}
          res.writeHead(206,{"Content-Type":mime,"Accept-Ranges":"bytes","Content-Range":"bytes "+start+"-"+end+"/"+body.length,"Content-Length":end-start+1}).end(body.subarray(start,end+1));
        } else res.writeHead(200,{"Content-Type":mime,"Accept-Ranges":"bytes","Content-Length":body.length}).end(body);
      });
    }}],
  });
  await vite.listen();
  browser = await puppeteer.launch({executablePath:process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless:true,acceptInsecureCerts:true,args:["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required"]});
  const base = "https://127.0.0.1:"+vite.httpServer.address().port+"/__mg_fixture/";
  for (const [name,v,a] of [["sample.mp4","h264","aac"],["sample.webm","vp9","opus"],["sample.m3u8","h264","aac"]]) {
    const page = await browser.newPage();
    page.on("pageerror",error=>console.error("Fixture page:",error.message));
    page.on("console",message=>{
      if (["error","warning"].includes(message.type())) console.error("Fixture browser:",message.text().slice(0,1200));
    });
    page.on("requestfailed",request=>console.error("Fixture request failed:",new URL(request.url()).pathname,request.failure()?.errorText));
    await page.setRequestInterception(true);
    page.on("request",request=>{
      if (request.url().startsWith(base.slice(0,base.indexOf("/__mg_fixture/"))+"/") || request.url().startsWith("blob:") || request.url().startsWith("data:")) {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    try {
      await page.goto(base);
      const gate = await page.evaluate(async ({name,v,a})=>{
        const harness = await import("/tests/fixtures/website-direct-player.jsx");
        return harness.mountSample({url:new URL(name,location.href).href,videoCodec:v,audioCodec:a});
      },{name,v,a});
      assert.equal(gate.allowed,true,name+" compatibility gate");
      try {
        await page.waitForSelector('video[data-mg-playback-surface="active"]',{timeout:20000});
      } catch (error) {
        console.error("Mount diagnostics",await page.evaluate(()=>({
          readyState:document.readyState,
          root:document.getElementById("root")?.innerHTML.slice(0,1000),
          videoCount:document.querySelectorAll("video").length
        })));
        throw error;
      }
      const result = await page.evaluate(async ()=>{
        const video = document.querySelector('video[data-mg-playback-surface="active"]');
        const context = new AudioContext();
        await context.resume();
        const source = context.createMediaElementSource(video);
        const analyser = context.createAnalyser();
        source.connect(analyser); analyser.connect(context.destination);
        let rms=0;
        const deadline=performance.now()+15000;
        try {
          while (performance.now()<deadline) {
            await new Promise(resolve=>setTimeout(resolve,200));
            const samples=new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(samples);
            rms=Math.max(rms,Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length));
            if (video.currentTime>0.5 && video.getVideoPlaybackQuality().totalVideoFrames>0 && rms>0.001) break;
            if(video.error) break;
          }
          return {time:video.currentTime,decodedFrames:video.getVideoPlaybackQuality().totalVideoFrames,
            width:video.videoWidth,height:video.videoHeight,audioRms:rms,muted:video.muted,
            error:video.error?.message || ""};
        } finally {await context.close();}
      });
      console.log(name,JSON.stringify(result));
      assert.ok(result.time>0 && result.decodedFrames>0 && result.width>0 && result.height>0,name+" actual component picture");
      assert.ok(result.audioRms>0.001 && !result.muted,name+" actual component audio");
    } finally {await page.close();}
  }
  console.log("PASS: actual LiveVideo component decoded generated MP4, WebM and HLS; not a production catalogue test.");
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  await rm(dir,{recursive:true,force:true});
}
