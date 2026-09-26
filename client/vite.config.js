import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3223,
    strictPort: true,
    proxy: { '/api': process.env.API_URL || 'http://localhost:5050' },
  },
});
