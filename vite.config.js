import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Teruskan permintaan /api ke server Express yang memakai Neon.
      '/api': 'http://localhost:3001',
    },
  },
});