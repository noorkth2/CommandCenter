import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === 'build' && {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Replace type="module" with defer and remove crossorigin on all script tags
        return html.replace(/<script([^>]*?)>/gi, (match) => {
          return match
            .replace(/type=["']module["']/gi, 'defer')
            .replace(/crossorigin/gi, '');
        });
      }
    }
  ].filter(Boolean),
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Use IIFE format so the built output has NO type="module" or crossorigin
    // attributes. This is the correct format for Electron apps loading via
    // the file:// protocol, where ES module CORS checks cause silent failures.
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'iife',
        // Inline all dynamic imports into a single bundle (required for IIFE)
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['electron'],
  },
}));
