import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'Assets/public',
  build: {
    outDir: 'Builds/web',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
});
