# StreamVibe Android Packaging (Capacitor)

StreamVibe is a server-rendered Next.js app, so the Android build is a thin
native **WebView wrapper** (via [Capacitor](https://capacitorjs.com)) that loads
the deployed web app over the network. This keeps every existing feature —
Movies, TV Shows, Live TV, Real-Debrid playback, auth, watch parties — working
unchanged inside the native shell.

Two build flavors are provided:

| Flavor  | Device                  | Launcher        | Orientation  | Input        |
|---------|-------------------------|-----------------|-------------|-------------|
| `phone` | Android phones/tablets  | `LAUNCHER`      | any         | touch        |
| `firetv`| Amazon Fire TV / Stick  | `LEANBACK_LAUNCHER` | landscape | D-pad/remote |

The Fire TV flavor adds D-pad/remote spatial navigation, Select/OK activation,
Back handling, full-screen playback, and a TV-safe focus ring — implemented in
`hooks/use-tv-navigation.ts` and activated only on TV devices.

## Prerequisites

- Node 22 + pnpm 9
- Android Studio (or Android SDK + JDK 17)
- A deployed StreamVibe web URL (the app loads it inside the WebView)

## 1. Point the wrapper at your server

Set `CAPACITOR_SERVER_URL` to your deployed StreamVibe URL, then sync so the
native project picks it up:

```bash
CAPACITOR_SERVER_URL=https://your-streamvibe.example.com pnpm cap:sync
```

For local dev you can point it at your machine's dev server
(`http://<your-lan-ip>:3000`); `cleartext: true` is already enabled.

## 2. Build APKs

### Android Studio

```bash
pnpm cap:sync
pnpm cap:open     # opens android/ in Android Studio
```

Then select the **phone** or **firetv** build variant and Build → Build APK.

### Command line (Gradle)

```bash
pnpm cap:sync
cd android
./gradlew assembleRelease          # both flavors
# or a single flavor:
./gradlew assemblePhoneRelease
./gradlew assembleFiretvRelease
```

Output APKs:

```
android/app/build/outputs/apk/phone/release/app-phone-release.apk
android/app/build/outputs/apk/firetv/release/app-firetv-release.apk
```

Debug builds: `./gradlew assemblePhoneDebug assembleFiretvDebug`.

## 3. Signing release APKs

By default, release builds are signed with the debug key (installable for
testing). For Play Store / Appstore distribution, create a keystore:

```bash
keytool -genkey -v -keystore android/app/release.keystore \
  -alias streamvibe -keyalg RSA -keysize 2048 -validity 10000
```

Create `android/keystore.properties` (git-ignored):

```properties
storeFile=release.keystore
storePassword=your-store-password
keyAlias=streamvibe
keyPassword=your-key-password
```

The next `./gradlew assembleRelease` will sign with your keystore.
`keystore.properties` and `*.keystore` are git-ignored.

### CI signing (GitHub secrets)

Set these repository secrets and the workflow decodes the keystore
automatically:

- `STREAMVIBE_KEYSTORE_BASE64` — `base64 < release.keystore`
- `STREAMVIBE_KEYSTORE_PASSWORD`
- `STREAMVIBE_KEY_ALIAS`
- `STREAMVIBE_KEY_PASSWORD`

Without these secrets, CI still builds debug-signed release APKs.

## 4. CI

`.github/workflows/android-build.yml` builds both flavors on push to `main`,
version tags (`v*`), and manual dispatch. APKs are uploaded as artifacts.

## Fire TV / Fire Stick notes

- The `firetv` manifest declares `LEANBACK_LAUNCHER`, a 320×180 banner
  (`res/drawable/banner.png`), landscape orientation, and marks touchscreen as
  not required.
- Remote keys map to keyboard events in the WebView:
  - D-pad → Arrow keys (spatial focus navigation)
  - Select/OK → Enter (activates focused element)
  - Back → Capacitor `backButton` (exit fullscreen → close dialog → history back → exit)
- Full-screen playback: when a `<video>` starts on TV its container is
  fullscreen-ed automatically; Back exits fullscreen first.
- A `?tvMode=1` query flag forces TV mode for testing on phones/desktops.

## Files

| Path | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor config (appId, server URL) |
| `android/` | Native Android project (Gradle, manifests, resources) |
| `android/app/build.gradle` | Product flavors, signing config |
| `android/app/src/phone/` | Phone launcher manifest |
| `android/app/src/firetv/` | Fire TV launcher manifest + banner |
| `lib/capacitor.ts` | Runtime detection (isCapacitor, isTvDevice) |
| `hooks/use-tv-navigation.ts` | D-pad/remote navigation, focus, back, fullscreen |
| `components/tv-navigation-provider.tsx` | Activates TV nav in the layout |
