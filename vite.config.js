import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The independent Media God rebuild has no Base44 Vite plugin,
// preview injection, SDK login bootstrap or Base44 analytics scripts.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    legacy({
      targets: ['Chrome >= 37'],
      modernTargets: ['Chrome >= 64', 'Safari >= 12', 'Firefox >= 67', 'Edge >= 79'],
      modernPolyfills: true,
      additionalLegacyPolyfills: [
        'whatwg-fetch',
        'abortcontroller-polyfill/dist/polyfill-patch-fetch',
      ],
    }),
  ],
  build: { outDir: 'dist', rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), combinedDebridTest: fileURLToPath(new URL('./combined-debrid-test.html', import.meta.url)) } } }
});
