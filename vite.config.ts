import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths so the app works on GitHub Pages subpath
  // e.g. https://username.github.io/japan-helper/
  base: './',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
