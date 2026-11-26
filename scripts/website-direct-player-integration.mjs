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
let browser, strictBrowser, vite;
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
  // Use the same pinned decoder distribution as the production web image.
  run("npm", ["pack","--ignore-scripts","--pack-destination",dir,"movi-player@0.4.1"]);
  run("tar", ["-xf",join(dir,"movi-player-0.4.1.tgz"),"-C",dir]);
  for (const [name,codec,bitrate] of [["ac3","ac3","192k"],["eac3","eac3","192k"],["dts","dca","768k"]]) {
    run("ffmpeg",[...common,...avc,"-c:a",codec,"-strict","-2","-b:a",bitrate,join(dir,name+".mkv")]);
  }
  const additionalFormats = [
    ["hevc.mkv","hevc","aac","libx265","aac",["-preset","ultrafast","-x265-params","pools=1:frame-threads=1"]],
    ["av1.mkv","av1","opus","libaom-av1","libopus",["-cpu-used","8"]],
    ["xvid.mkv","mpeg4","mp3","mpeg4","libmp3lame",[]],
    ["vp8.webm","vp8","vorbis","libvpx","libvorbis",[]],
    ["flac.mkv","h264","flac","libx264","flac",[]],
    ["mp3.mkv","h264","mp3","libx264","libmp3lame",[]],
  ];
  for (const [name,,,encoder,audioEncoder,options] of additionalFormats) {
    run("ffmpeg",[...common,"-c:v",encoder,...options,"-threads","2","-pix_fmt","yuv420p","-c:a",audioEncoder,"-ac","2",join(dir,name)]);
  }
  const files = new Map();
  for (const name of await readdir(dir)) {
    const mime = name.endsWith(".mkv") ? "video/x-matroska" : name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".webm") ? "video/webm" :
      name.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : name.endsWith(".ts") ? "video/mp2t" : "";
    if (mime) files.set("/__mg_fixture/"+name,[mime,await readFile(join(dir,name))]);
  }
  vite = await createServer({
    configFile:false, root:fileURLToPath(new URL("../",import.meta.url)),
    resolve:{alias:{"@":fileURLToPath(new URL("../src",import.meta.url))}},
    appType:"custom",
    server:{host:"127.0.0.1",port:0,allowedHosts:["underworldhub.co.uk","www.underworldhub.co.uk"],https:{key:await readFile(join(dir,"key.pem")),cert:await readFile(join(dir,"cert.pem"))}},
    plugins:[{name:"generated-media-only",configureServer(server){
      server.middlewares.use(async (req,res,next)=>{
        const path = new URL(req.url,"https://fixture.invalid").pathname;
        if (/^\/decoder-lab\/vendor\/[a-zA-Z0-9_./-]+$/.test(path)) {
          const file = path.slice("/decoder-lab/vendor/".length);
          try {
            const body = await readFile(join(dir,"package/dist",file));
            res.writeHead(200,{"Content-Type":file.endsWith(".wasm")?"application/wasm":"application/javascript"}).end(body);
          } catch { res.writeHead(404).end(); }
          return;
        }
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
  const cases = [
    ["sample.mp4","h264","aac","127.0.0.1",false],
    ["sample.webm","vp9","opus","127.0.0.1",false],
    ["sample.m3u8","h264","aac","127.0.0.1",false],
    ["sample.mp4","h264","aac","underworldhub.co.uk",true],
    ["sample.mp4","h264","aac","www.underworldhub.co.uk",true,true,true],
    ...additionalFormats.map(([file,v,a])=>[file,v,a,"www.underworldhub.co.uk",true,true,false,"format"]),
    ...["account-match","seedless","cooldown","cooldown-repeat","library","unknown","fallback","preparing","ranked","incompatible"].map(mode => ["sample.mp4","h264","aac","www.underworldhub.co.uk",true,false,false,mode]),
    ...[["ac3.mkv","ac3"],["eac3.mkv","eac3"],["dts.mkv","dts"],["sample.webm","opus"],["sample.m3u8","aac"]]
      .map(([file,audio])=>[file,file.endsWith(".webm")?"vp9":"h264",audio,"www.underworldhub.co.uk",true]),
  ];
  for (const [name,v,a,host,full,mobile,strict,torrentMode] of cases) {
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
      if (request.url().startsWith(base.slice(0,base.indexOf("/__mg_fixture/"))+"/") || request.url().startsWith("blob:") || request.url().startsWith("data:")) {
        void request.continue();
      } else {
        void request.abort();
      }
    });
    try {
      if (full) await page.evaluateOnNewDocument(() => {
        window.audioMeters = [];
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function(target,...rest) {
          if (target === this.context.destination) {
            const meter = this.context.createAnalyser();
            connect.call(this,meter);
            window.audioMeters.push(meter);
          }
          return connect.call(this,target,...rest);
        };
      });
      await page.goto(base);
      // Puppeteer's page.evaluate grants a user gesture. The strict case must
      // mount without activation, using CDP explicitly with userGesture:false.
      const input = {name,v,a,full,mixedChoices: full && !mobile && !strict && host === "underworldhub.co.uk"};
      input.automaticFallback = full && !mobile && name === "ac3.mkv";
      const mount = async ({name,v,a,full,mixedChoices,automaticFallback})=>{
        const harness = await import("/tests/fixtures/website-direct-player.jsx");
        return (full ? harness.mountSourcesSample : harness.mountSample)({url:new URL(name,location.href).href,videoCodec:v,audioCodec:a,mixedChoices,automaticFallback});
      };
      let gate;
      let panelLookupCount;
      if (torrentMode) {
        await page.evaluate(async ({name,mode,v,a}) => {
          const fixture = await import("/tests/fixtures/website-torrent-sources.jsx");
          fixture.mountTorrentTitle({ url: new URL(name,location.href).href, mode, videoCodec:v, audioCodec:a });
        }, {name,v,a,mode:torrentMode});
        if (torrentMode === "incompatible") {
          await page.waitForFunction(()=>document.body.innerText.includes("Website torrent filter"));
          await page.evaluate(()=>Array.from(document.querySelectorAll("button")).find(b=>b.innerText.includes("Play in Media God")).click());
          await page.waitForFunction(()=>document.body.innerText.includes("No compatible website source found"));
          assert.deepEqual(await page.evaluate(()=>window.fixtureDebridActions), []);
          assert.equal(await page.$("movi-player"), null);
          console.log("Incompatible-only catalogue stopped before resolution");
          continue;
        }
        await page.waitForFunction(()=>Array.from(document.querySelectorAll("button")).some(button=>
          button.innerText.includes("Owned Test Clip 2025 English")));
        const button = await page.evaluateHandle(()=>Array.from(document.querySelectorAll("button"))
          .find(row=>row.innerText.includes("Play in Media God")));
        panelLookupCount = await page.evaluate(()=>window.fixtureLookups);
        await button.asElement().click();
        if (torrentMode === "cooldown-repeat") {
          await page.waitForFunction(()=>document.body.innerText.includes("Real-Debrid is still busy"),{timeout:12000});
          await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.innerText.includes("Retry this source")),{timeout:12000});
          await new Promise(resolve=>setTimeout(resolve,2300));
          assert.equal((await page.evaluate(()=>window.fixtureResolutionCalls)).length,2);
          console.log("PASS repeated 429 stopped after one retry and offered manual retry.");
          continue;
        }

      } else if (strict) {
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
      if (full) {
        if (!torrentMode) assert.equal(gate.route,true);
        await page.waitForSelector('movi-player',{timeout:torrentMode === 'seedless' ? 60000 : 30000});
        if (input.mixedChoices) {
          await page.click('[data-mg-open-in-player-sources="true"]');
          const choices = await page.$$eval('[data-mg-source-choice]',rows=>rows.map(r=>r.textContent));
          assert.equal(choices.length,1);
          assert.ok(choices.every(label=>!label.includes("Unknown audio fixture") && !label.includes("Unsupported audio fixture")));
          await page.click('[aria-label="Return to video player"]');
        }
        if (strict) {
          await page.focus("movi-player");
          await page.evaluate(()=>document.querySelector("movi-player").play());
        }
        await page.waitForFunction(()=>{
          const p = document.querySelector("movi-player");
          return p?.currentTime > 0.5 && p.videoWidth > 0 && p.getVideoPlaybackQuality().totalVideoFrames > 0 &&
            !p.muted && window.audioMeters.some(meter=>{
              const samples = new Float32Array(meter.fftSize);
              meter.getFloatTimeDomainData(samples);
              return samples.some(sample=>Math.abs(sample)>0.005);
            });
        },{timeout:30000});
        if (torrentMode) {
          const actions = await page.evaluate(()=>window.fixtureDebridActions);
          if (torrentMode === "cooldown") {
            const calls = await page.evaluate(()=>window.fixtureResolutionCalls);
            assert.equal(calls.length,2);
            assert.equal(calls[0].id,calls[1].id);
            assert.ok(calls[1].time - calls[0].time >= 2000);
          }
          if (torrentMode === "account-match") assert.deepEqual(actions, ["find_cached"]);
          const expected = {"account-match":"find_cached",seedless:"torrent_info",cooldown:"torrent_info",format:"torrent_info",library:"torrent_info",unknown:"adopt_hash",fallback:"resolve_best",preparing:"torrent_info",ranked:"torrent_info"};
          assert.equal(await page.evaluate(()=>window.fixtureLookups), panelLookupCount, "reuses the panel discovery");
          assert.ok(!actions.includes("must-never-resolve"), "website excludes 4K HDR HEVC before resolution");
          if (["seedless","ranked"].includes(torrentMode)) assert.ok(actions.indexOf("broken") >= 0 && actions.indexOf("working") > actions.indexOf("broken"), "automatically tried both ranked torrents");
          assert.ok(actions.includes(expected[torrentMode]), "torrent resolver action: "+torrentMode);
        }
        assert.deepEqual(renderErrors,[]);
        console.log(host,name,"Sources rendered moving video and non-silent audio");
        continue;
      }
      assert.equal(gate.allowed,true);
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
      console.log(host,mobile?"mobile Chrome emulation": "desktop",full?"Sources VideoPlayer":"LiveVideo",name,JSON.stringify(result));
      assert.ok(result.time>0 && result.decodedFrames>0 && result.width>0 && result.height>0,name+" actual component picture");
      assert.ok(result.audioRms>0.001 && !result.muted,name+" actual component audio");
      assert.deepEqual(renderErrors, [], name+" no browser exceptions or render loops");
    } finally {await page.close();}
  }
  console.log("PASS: LiveVideo and website Sources VideoPlayer decoded locally generated media; no production catalogue or provider access.");
} finally {
  if (strictBrowser) await strictBrowser.close();
  if (browser) await browser.close();
  if (vite) await vite.close();
  await rm(dir,{recursive:true,force:true});
}
