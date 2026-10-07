import type { CapacitorConfig } from '@capacitor/cli'

/**
 * StreamVibe Capacitor configuration.
 *
 * StreamVibe is a server-rendered Next.js app (auth, DB, server actions, Live TV
 * playback all run on the server). The Android app is therefore a thin native
 * WebView wrapper that loads the deployed web app over the network, which keeps
 * every existing feature intact inside the native shell.
 *
 * Set CAPACITOR_SERVER_URL to your deployed StreamVibe URL before building, e.g.:
 *   CAPACITOR_SERVER_URL=https://streamvibe.example.com pnpm cap:sync
 *
 * During local development you can point it at your dev server
 * (http://<your-lan-ip>:3000) and set `cleartext: true`.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL || 'https://streamvibe.example.com'

const config: CapacitorConfig = {
  appId: 'com.streamvibe.app',
  appName: 'StreamVibe',
  // webDir is required by the CLI but unused when server.url is set — the app is
  // loaded from the remote server, not from bundled static files.
  webDir: 'out',
  server: {
    url: serverUrl,
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    // Keep the WebView alive across config/orientation changes so playback isn't
    // interrupted when the device rotates.
    backgroundColor: '#1a1625',
  },
}

export default config
