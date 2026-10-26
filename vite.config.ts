import { defineConfig } from 'vite';

// GitHub Pages serves the app from https://<user>.github.io/prima-vista/.
// For an upload to an arbitrary webspace folder use `npm run build:static`,
// which overrides this with a relative base (./).
export default defineConfig({
  base: '/prima-vista/',
  build: {
    target: 'es2022',
    // VexFlow bundles the Bravura music font (~700 kB), that's expected.
    chunkSizeWarningLimit: 1200,
  },
});
