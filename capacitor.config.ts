import type { CapacitorConfig } from '@capacitor/cli'

/**
 * StreamVibe Capacitor configuration.
 *
 * The native Android app is a thin WebView wrapper around the live StreamVibe
 * site. Keep the URL configurable so the same native project can be rebuilt
 * against the current published/preview deployment.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  'https://3000-6a9a89a0280b0a64005381de--b-2d5260a-673c4755c13de4ac.imported.base44-preview.app/'

const config: CapacitorConfig = {
  appId: 'com.streamvibe.app',
  appName: 'StreamVibe',
  webDir: 'out',
  server: {
    url: serverUrl,
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1a1625',
  },
}

export default config
