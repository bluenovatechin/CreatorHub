import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in development: cookies stay first-party and SameSite=Strict works.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  build: { sourcemap: false },
});
