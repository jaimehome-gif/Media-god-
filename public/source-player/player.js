const notice = document.querySelector("#notice");
const channel = new BroadcastChannel("mg-source-" + location.hash.slice(1));
const send = (type, data = {}) => channel.postMessage({ type, ...data });
function button(label, action) {
  const el = document.createElement("button");
  el.textContent = label;
  el.onclick = action;
  notice.replaceChildren(el);
}

async function start() {
  if (!crossOriginIsolated && "serviceWorker" in navigator && !navigator.serviceWorker.controller?.scriptURL.endsWith("/source-player/isolation.js") && !location.search) {
    await navigator.serviceWorker.register("./isolation.js");
    await navigator.serviceWorker.ready;
    location.replace("./index.html?isolated=1" + location.hash);
    return;
  }
  if (!crossOriginIsolated) {
    if (window.parent !== window) {
      const link = document.createElement("a");
      link.href = location.href;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open Media God player";
      notice.replaceChildren(link);
    } else {
      notice.textContent = "This browser cannot start the VLC decoder. Return to Sources to use browser playback.";
    }
    return;
  }
  await import("./engine/src/element.js");
  const video = document.createElement("vlc-player");
  video.setAttribute("controls", "");
  document.body.prepend(video);
  const player = await video.ready;
  let opened = false;
  channel.onmessage = async ({ data }) => {
    if (data.type === "close") { await player.stop(); return; }
    if (opened || data.type !== "source" || !/^https?:\/\//i.test(data.url)) return;
    opened = true;
    try {
      await player.open(data.url, { autoplay: false, startTime: data.startTime });
      const play = async () => { await player.play(); notice.hidden = true; };
      button("Play with sound", play);
      if (player.audioContext?.state === "running") await play();
    } catch { notice.textContent = "VLC could not open this stream. Choose another source or use browser playback."; }
  };
  player.on("error", () => { notice.hidden = false; notice.textContent = "VLC could not read this source. Choose another source or use browser playback."; });
  player.on("timeupdate", time => send("progress", { time, duration: player.duration }));
  player.on("paused", () => send("pause", { time: player.currentTime, duration: player.duration }));
  player.on("ended", () => send("ended", { time: player.duration, duration: player.duration }));
  send("ready");
}
start().catch(() => { notice.textContent = "The VLC decoder could not start. Return to Sources or use browser playback."; });
