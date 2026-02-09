import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { resolve } from 'path';

// Build UMD only for main entry, ES for all entries
const buildUmd = process.env.BUILD_UMD === 'true';
// Standalone viewer: inlines all deps except react/react-dom (for use with preact aliases)
const buildViewerStandalone = process.env.BUILD_VIEWER_STANDALONE === 'true';

export default defineConfig(({ mode }) => {
  return {
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    plugins: [react(), tsconfigPaths({ root: '.' }), cssInjectedByJsPlugin()],
    build: buildViewerStandalone
      ? {
          lib: {
            entry: resolve(__dirname, 'src/viewerEntry.ts'),
            name: '@pdfme/ui',
            fileName: () => 'viewer.standalone.js',
            formats: ['es'],
          },
          rollupOptions: {
            external: [/^react($|\/)/, /^react-dom($|\/)/, '@pdfme/common', '@pdfme/schemas'],
          },
        }
      : {
          lib: buildUmd
            ? {
                entry: resolve(__dirname, 'src/index.ts'),
                name: '@pdfme/ui',
                fileName: () => 'index.umd.js',
                formats: ['umd'],
              }
            : {
                entry: {
                  index: resolve(__dirname, 'src/index.ts'),
                  viewer: resolve(__dirname, 'src/viewerEntry.ts'),
                },
                name: '@pdfme/ui',
                formats: ['es'],
              },
          rollupOptions: {
            external: ['react', 'react-dom', '@pdfme/common', '@pdfme/schemas', '@pdfme/converter'],
            output: buildUmd
              ? {
                  globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                  },
                }
              : {
                  entryFileNames: '[name].es.js',
                },
          },
        },
    optimizeDeps: {
      include: ['react', 'react-dom', 'pdfjs-dist', 'antd'],
      exclude: ['@pdfme/common', '@pdfme/schemas', '@pdfme/converter'],
    },
  };
});
