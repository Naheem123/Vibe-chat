import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'public/dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VibeChatWidget',
      fileName: (format) => format === 'umd' ? 'vibe-chat-widget.js' : `vibe-chat-sdk.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Not externalizing React to ensure zero-dependency UMD
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  }
});
