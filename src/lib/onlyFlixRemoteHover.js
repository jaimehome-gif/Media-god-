// A Fire TV Select sends a mouse click into the provider frame. Release its
// stationary hover when the remote goes idle so the provider can hide its bar.
const playerFrame = '[data-mg-onlyflix-player="true"] iframe[data-mg-embed-iframe="true"][src^="https://share.cdnm.ink/embed/"]';

export function installOnlyFlixRemoteHover(isRemoteAvailable) {
  let timer;
  const root = document.documentElement;
  const idle = "mg-onlyflix-remote-idle";
  const restore = () => {
    window.clearTimeout(timer);
    root.classList.remove(idle);
  };
  const arm = (frame) => {
    restore();
    if (!frame || !isRemoteAvailable()) return;
    timer = window.setTimeout(() => {
      if (!frame.isConnected || !frame.matches(playerFrame)) return;
      root.classList.add(idle);
    }, 2500);
  };
  const remoteActivity = () => arm(document.querySelector(playerFrame));
  const onLoad = ({ target }) => {
    if (target.matches?.(playerFrame)) arm(target);
  };
  const onPointerMove = (event) => {
    if (root.classList.contains(idle) && (event.movementX || event.movementY)) restore();
  };
  // The remote checks elementFromPoint immediately after dispatching this
  // event. Restore hit testing synchronously, even for the first idle Select.
  window.addEventListener("mg:onlyflix-pointer-move", remoteActivity, true);
  document.addEventListener("load", onLoad, true);
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pagehide", restore);
}