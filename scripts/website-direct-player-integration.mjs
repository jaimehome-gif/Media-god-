import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createServer as createHttpsServer } from "node:https";
import puppeteer from "puppeteer-core";

// No provider requests, account credentials, or production data. The real
// LiveVideo component receives only locally generated, self-owned media.
const dir = await mkdtemp(join(tmpdir(), "mg-player-integration-"));
let browser, strictBrowser, vite, mediaServer;
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
  // Separate HTTPS media origin, limited to generated fixture files.
  const delivery = [];
  mediaServer = createHttpsServer({key:await readFile(join(dir,"key.pem")),cert:await readFile(join(dir,"cert.pem"))},(req,res)=>{
    const file=files.get(req.url);
    if (!file) {res.writeHead(404).end();return;}
    const origin=req.headers.origin || "";
    if (origin && /^https:\/\/(?:www\.)?underworldhub\.co\.uk:\d+$/.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin",origin);
      res.setHeader("Vary","Origin");
      res.setHeader("Access-Control-Allow-Methods","GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers","Range");
      res.setHeader("Access-Control-Expose-Headers","Content-Range, Accept-Ranges, Content-Length");
    }
    if(req.method==="OPTIONS"){res.writeHead(204).end();return;}
    if(!["GET","HEAD"].includes(req.method)){res.writeHead(405).end();return;}
    const [mime,body]=file;
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    const start=range?Number(range[1]):0;
    const end=range?Math.min(range[2]?Number(range[2]):body.length-1,body.length-1):body.length-1;
    if(start>end || start>=body.length){res.writeHead(416,{"Content-Range":"bytes */"+body.length}).end();return;}
    const headers={"Content-Type":mime,"Accept-Ranges":"bytes","Content-Length":end-start+1,"Cache-Control":"no-store"};
    if(range)headers["Content-Range"]="bytes "+start+"-"+end+"/"+body.length;
    delivery.push({path:req.url,method:req.method,status:range?206:200,origin});
    res.writeHead(range?206:200,headers).end(req.method==="HEAD"?undefined:body.subarray(start,end+1));
  });
  await new Promise((resolve,reject)=>{mediaServer.once("error",reject);mediaServer.listen(0,"127.0.0.1",resolve);});
  const mediaOrigin="https://127.0.0.1:"+mediaServer.address().port;
  const actualTracks=new Map();
  for (const name of ["sample.mp4","sample.webm","sample.m3u8"]) {
    const probe=spawnSync("ffprobe",["-v","error","-show_streams","-of","json",join(dir,name)],{encoding:"utf8"});
    assert.equal(probe.status,0,"ffprobe "+name);
    const streams=JSON.parse(probe.stdout).streams;
    actualTracks.set(name,{v:streams.find(x=>x.codec_type==="video")?.codec_name,a:streams.find(x=>x.codec_type==="audio")?.codec_name});
  }
  vite = await createServer({
    configFile:false, root:fileURLToPath(new URL("../",import.meta.url)),
    resolve:{alias:{"@":fileURLToPath(new URL("../src",import.meta.url))}},
    appType:"custom",
    server:{host:"127.0.0.1",port:0,allowedHosts:["underworldhub.co.uk","www.underworldhub.co.uk"],https:{key:await readFile(join(dir,"key.pem")),cert:await readFile(join(dir,"cert.pem"))}},
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
    headless:true,acceptInsecureCerts:true,args:["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=no-user-gesture-required","--no-proxy-server","--host-resolver-rules=MAP underworldhub.co.uk 127.0.0.1, MAP www.underworldhub.co.uk 127.0.0.1"]});
  strictBrowser = await puppeteer.launch({executablePath:process.env.CHROME_BIN || "/usr/bin/google-chrome",
    headless:true,acceptInsecureCerts:true,args:["--no-sandbox","--disable-dev-shm-usage","--autoplay-policy=document-user-activation-required","--no-proxy-server","--host-resolver-rules=MAP underworldhub.co.uk 127.0.0.1, MAP www.underworldhub.co.uk 127.0.0.1"]});
  const cases = [["sample.mp4","h264","aac","127.0.0.1",false],["sample.webm","vp9","opus","127.0.0.1",false],["sample.m3u8","h264","aac","127.0.0.1",false],["sample.mp4","h264","aac","underworldhub.co.uk",true],["sample.mp4","h264","aac","www.underworldhub.co.uk",true],["sample.mp4","h264","aac","www.underworldhub.co.uk",true,true],["sample.mp4","h264","aac","www.underworldhub.co.uk",true,true,true],["sample.mp4","h264","dts","www.underworldhub.co.uk",true,false,false,true],["sample.mp4","h264","","www.underworldhub.co.uk",true,false,false,true],["sample.mp4","h264","aac","www.underworldhub.co.uk",true,true,false,false,true],["sample.m3u8","h264","aac","www.underworldhub.co.uk",true,true,false,false,true]];
  for (const [name,v,a,host,full,mobile,strict,rejected,remote] of cases) {
    const deliveryStart=delivery.length;
    if (!rejected) assert.deepEqual(actualTracks.get(name),{v,a},"actual ffprobe codecs for "+name);
    const base = "https://"+host+":"+vite.httpServer.address().port+"/__mg_fixture/";
    const page = await (strict ? strictBrowser : browser).newPage();
    if (mobile) {
      await page.setUserAgent("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36");
      await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    }
    const renderErrors = [];
    page.on("pageerror",error=>{ renderErrors.push(error.message); console.error("Fixture page:",error.message); });
    page.on("console",message=>{
      if (["error","warning"].includes(message.type())) console.error("Fixture browser:",message.text().slice(0,1200));
      if (/Maximum update depth exceeded|Too many re-renders|Encountered two children with the same key/i.test(message.text())) renderErrors.push(message.text().slice(0,240));
    });
    page.on("requestfailed",request=>console.error("Fixture request failed:",new URL(request.url()).pathname,request.failure()?.errorText));
    await page.setRequestInterception(true);
    page.on("request",request=>{
      if (request.url().startsWith(base.slice(0,base.indexOf("/__mg_fixture/"))+"/") || (remote && files.has(new URL(request.url()).pathname) && new URL(request.url()).origin===mediaOrigin) || request.url().startsWith("blob:") || request.url().startsWith("data:")) {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    try {
      await page.goto(base);
      // Puppeteer's page.evaluate grants a user gesture. The strict case must
      // mount without activation, using CDP explicitly with userGesture:false.
      const input = {name,v,a,full,mediaBase:remote?mediaOrigin+"/__mg_fixture/":base};
      if (remote) {
        const check=await page.evaluate(async url=>{const response=await fetch(url,{headers:{Range:"bytes=0-63"}});return {status:response.status,range:response.headers.get("Content-Range"),size:(await response.arrayBuffer()).byteLength};},mediaOrigin+"/__mg_fixture/sample.mp4");
        assert.equal(check.status,206);assert.equal(check.size,64);assert.match(check.range,/^bytes 0-63\//);
      }
      const mount = async ({name,v,a,full,mediaBase})=>{
        const harness = await import("/tests/fixtures/website-direct-player.jsx");
        return (full ? harness.mountSourcesSample : harness.mountSample)({url:new URL(name,mediaBase).href,videoCodec:v,audioCodec:a});
      };
      let gate;
      if (strict) {
        const session = await page.createCDPSession();
        const response = await session.send("Runtime.evaluate", {
          expression:"("+mount.toString()+")("+JSON.stringify(input)+")",
          awaitPromise:true, returnByValue:true, userGesture:false
        });
        assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails || {}));
        gate = response.result.value;
        await session.detach();
      } else {
        gate = await page.evaluate(mount,input);
      }
      if(full) assert.equal(gate.route,true,host+" real website route");
      assert.equal(gate.allowed,!rejected,name+" compatibility gate");
      if (rejected) {
        await page.waitForSelector('[data-mg-website-codec-rejected="true"]',{timeout:15000});
        assert.equal(await page.$('video[data-mg-playback-surface="active"]'),null,"rejected fixture must not start video");
        assert.deepEqual(renderErrors, [], "no exceptions in rejection path");
        console.log(host,"rejected fixture",a || "unknown audio",gate.reason);
        continue;
      }
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
      if (full) assert.equal(await page.$eval('[data-mg-player-stage="true"]', element=>element.dataset.mgWebsiteSourcesState), "compatible",host+" real handoff compatibility state");
      if (strict) {
        const unlockSelector = '[data-mg-audio-unlock="true"] button';
        await page.waitForSelector(unlockSelector,{visible:true,timeout:15000});
        // A trusted keyboard activation works even when React replaces the
        // overlay between locating and clicking an element on mobile.
        await page.focus(unlockSelector);
        await page.keyboard.press("Enter");
        await page.waitForFunction(()=>!document.querySelector('[data-mg-audio-unlock="true"]'),{timeout:10000});
        console.log(host,"strict autoplay policy: explicit sound unlock accepted");
      }
      const result = await page.evaluate(async ({remoteMp4})=>{
        const video = document.querySelector('video[data-mg-playback-surface="active"]');
        // Without crossorigin on the real MP4 element, Web Audio must return
        // silence even if media audio is decoded. Use Chromium decoded-byte
        // counters in that case; HLS uses its own CORS-enabled MSE pipeline.
        if(remoteMp4){
          const deadline=performance.now()+15000;
          while(performance.now()<deadline && !(video.currentTime>0.5 && video.webkitAudioDecodedByteCount>0) && !video.error)await new Promise(r=>setTimeout(r,200));
          return {time:video.currentTime,decodedFrames:video.getVideoPlaybackQuality().totalVideoFrames,width:video.videoWidth,height:video.videoHeight,audioDecodedBytes:video.webkitAudioDecodedByteCount,muted:video.muted,error:video.error?.message || ""};
        }
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
      },{remoteMp4:remote && name==="sample.mp4"});
      if(remote){
        const requests=delivery.slice(deliveryStart);
        assert.ok(requests.some(x=>x.path.endsWith("/"+name) && x.method==="GET"),"actual separate-server media request");
        if(name.endsWith(".m3u8"))assert.ok(requests.some(x=>x.path.endsWith(".ts")),"actual HLS segments delivered");
        console.log("separate media origin",name,JSON.stringify(requests));
      }
      console.log(host,mobile?"mobile Chrome emulation": "desktop",full?"Sources VideoPlayer":"LiveVideo",name,JSON.stringify(result));
      assert.ok(result.time>0 && result.decodedFrames>0 && result.width>0 && result.height>0,name+" actual component picture");
      assert.ok((remote && name==="sample.mp4" ? result.audioDecodedBytes>0 : result.audioRms>0.001) && !result.muted,name+" actual component audio");
      assert.deepEqual(renderErrors, [], name+" no browser exceptions or render loops");
    } finally {await page.close();}
  }
  console.log("PASS: LiveVideo and website Sources VideoPlayer decoded locally generated media; no production catalogue or provider access.");
} finally {
  if (strictBrowser) await strictBrowser.close();
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (mediaServer) await new Promise(resolve=>mediaServer.close(resolve));
  await rm(dir,{recursive:true,force:true});
}
