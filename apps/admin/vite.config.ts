import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev API target: your local API (npm run dev starts it on :4000).
// To try the deployed API instead: API_PROXY_TARGET=https://bluenova-api.onrender.com npm run dev:web
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
const remote = !apiTarget.includes('localhost');

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: remote,
        // The production API only accepts its Vercel origin, so present that origin to it.
        configure: (proxy) => { if (remote) proxy.on('proxyReq', (req) => req.setHeader('origin', 'https://bluenova-admin.vercel.app')); },
      },
    },
  },
  build: { sourcemap: false },
});
