const status = document.getElementById("status");
const stage = document.getElementById("stage");
const choices = document.getElementById("choices");
const samples = Object.freeze([
  ["H.264 + AAC", "aac.mp4"],
  ["H.264 + AC-3", "ac3.mkv"],
  ["H.264 + E-AC-3", "eac3.mkv"],
  ["H.264 + DTS", "dts.mkv"],
]);
try {
  await import("./vendor/element.js");
  await customElements.whenDefined("movi-player");
  status.textContent = "Movi loaded. Select a test clip.";
  for (const [label, name] of samples) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", async () => {
      for (const child of stage.children) child.pause?.();
      stage.replaceChildren();
      status.textContent = label + " — loading test clip";
      const player = document.createElement("movi-player");
      player.setAttribute("controls", "");
      player.setAttribute("sw", "true");
      player.setAttribute("engine", "wasm");
      player.setAttribute("playsinline", "");
      player.addEventListener("nativefallback", () => { player.pause?.(); status.textContent = "Unexpected native fallback — test failed."; });
      player.setAttribute("theme", "dark");
      player.addEventListener("play", () => { status.textContent = label + " — playing; confirm tone and moving picture."; });
      player.addEventListener("error", () => { status.textContent = label + " — decoder error; no fallback to the old player."; });
      stage.appendChild(player);
      // Only fixed synthetic clips, fetched without any account credentials.
      try {
        const response = await fetch(new URL("./samples/" + name, location.href), { credentials: "omit" });
        if (!response.ok) throw new Error("Fixture unavailable");
        const file = new File([await response.blob()], name);
        if (player.isConnected) {
          player.src = file;
          status.textContent = label + " — press Play.";
        }
      } catch {
        if (player.isConnected) status.textContent = label + " — test file could not load.";
      }
    });
    choices.appendChild(button);
  }
} catch {
  status.textContent = "Movi decoder could not load. No fallback player was opened.";
}
