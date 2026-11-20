import base44 from "@base44/vite-plugin"
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    legacy({
      // The TV APK installs from API 21. Its system WebView can predate ES modules.
      targets: ['Chrome >= 37'],
      modernTargets: ['Chrome >= 64', 'Safari >= 12', 'Firefox >= 67', 'Edge >= 79'],
      modernPolyfills: true,
      additionalLegacyPolyfills: [
        'whatwg-fetch',
        'abortcontroller-polyfill/dist/polyfill-patch-fetch',
      ],
    }),
  ]
});
