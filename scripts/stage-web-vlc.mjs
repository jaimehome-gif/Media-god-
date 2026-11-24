import { cp, mkdir } from "node:fs/promises";

const target = new URL("../public/source-player/engine/", import.meta.url);
const pkg = new URL("../node_modules/libvlc-wasm/", import.meta.url);
await mkdir(target, { recursive: true });
for (const path of ["src", "wasm", "fonts", "LICENSE", "COPYING", "README.md"]) {
  await cp(new URL(path, pkg), new URL(path, target), { recursive: true });
}
