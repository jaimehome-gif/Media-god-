# Eden NX2 — separate development branch

**Branch:** `eden-nx2` (not Media God's `main`).

**Current state:** Branch created as an isolated starting point. The full Pass 112 emulator source is **not yet imported**. Do not build this branch as an emulator until the cumulative source import is complete.

**Safe upload path:** Use the complete `Eden-NX2-Pass112-MediaGod-Branch-Upload-Ready.zip` provided in ChatGPT. Extract it on Windows, sign in to GitHub CLI using `gh auth login`, and run `UPLOAD_TO_GITHUB.cmd`. This imports all source and tests to `eden-nx2` only using an explicit non-force push.

The repository is public. Existing Media God builds are triggered on pushes to `main`, not `eden-nx2`.
