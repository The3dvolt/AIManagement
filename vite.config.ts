import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The AI engine and worker generate large chunks, which is expected.
    // Increasing the warning limit prevents build noise.
    chunkSizeWarningLimit: 10000,
  },
});