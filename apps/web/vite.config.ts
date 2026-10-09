import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev API target: the deployed Render API by default; set API_PROXY_TARGET=http://localhost:4000 to use a local API.
const apiTarget = process.env.API_PROXY_TARGET ?? 'https://bluenova-api.onrender.com';
const remote = !apiTarget.includes('localhost');

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in development: cookies stay first-party and SameSite=Strict works.
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: remote,
        // The production API only accepts its Vercel origins, so present one of them to it.
        // (Uses the admin address: Render's CORS_ORIGINS doesn't currently include bluenova-creatorhub.vercel.app.)
        configure: (proxy) => { if (remote) proxy.on('proxyReq', (req) => req.setHeader('origin', 'https://bluenova-admin.vercel.app')); },
      },
    },
  },
  build: { sourcemap: false },
});
