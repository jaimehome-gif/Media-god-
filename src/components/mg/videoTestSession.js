// Keep remote repeats from reloading a clip whose play promise is still pending.
export function createVideoTestSession() {
  let pending = false;
  let generation = 0;
  return {
    play(video, onError) {
      if (!video || pending || (!video.paused && !video.ended)) return;
      const attempt = ++generation;
      pending = true;
      const failed = (error) => {
        if (attempt !== generation) return;
        pending = false;
        onError(error);
      };
      try {
        if (!video.getAttribute("src")) video.src = "/media-god-test.mp4";
        if (video.ended) video.currentTime = 0;
        Promise.resolve(video.play()).then(() => {
          if (attempt === generation) pending = false;
        }, failed);
      } catch (error) {
        failed(error);
      }
    },
    close(video) {
      generation++;
      pending = false;
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}
