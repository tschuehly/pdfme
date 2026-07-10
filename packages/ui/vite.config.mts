import { builtinModules } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const builtinModuleSet = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);
const externalDependencies = ['@pdfme/converter'];
// Standalone viewer build (consumed by hosts that already ship react/react-dom and
// @pdfme/common|schemas, e.g. PhotoQuest aliasing react to preact/compat): externalize
// those too, and build only the viewer entry so Rollup can't split a shared chunk between
// index and viewer that the host would need to fetch separately. @pdfme/converter stays
// external in both modes: bundling it inline here forces Vite's `?worker&url` import (for
// its lazy PDFium worker) into a single-entry/library build, where Vite falls back to
// inlining the worker as a `data:` URL instead of emitting a real asset file - and browsers
// silently refuse to run a `type: "module"` Worker from a `data:` URL. Left external,
// @pdfme/converter's own build already emits a real worker asset + a portable
// `new URL(..., import.meta.url)` reference, which downstream bundlers (e.g. Bun) resolve
// as a normal asset without needing that inlining trick.
const buildViewerStandalone = process.env.BUILD_VIEWER_STANDALONE === 'true';
const standaloneExternalDependencies = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@pdfme/common',
  '@pdfme/schemas',
  '@pdfme/converter',
];
const isExternal = (id: string) => {
  if (builtinModuleSet.has(id)) return true;
  const dependencies = buildViewerStandalone ? standaloneExternalDependencies : externalDependencies;
  return dependencies.some((dependency) => id === dependency || id.startsWith(`${dependency}/`));
};

export default defineConfig(({ mode }) => {
  return {
    base: './',
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    plugins: [react(), cssInjectedByJsPlugin()],
    build: {
      lib: {
        entry: buildViewerStandalone
          ? { viewer: resolve(__dirname, 'src/viewerEntry.ts') }
          : {
              index: resolve(__dirname, 'src/index.ts'),
              viewer: resolve(__dirname, 'src/viewerEntry.ts'),
            },
        fileName: (_format, entryName) => `${entryName}.js`,
        formats: ['es'],
      },
      minify: false,
      outDir: 'dist',
      rollupOptions: { external: isExternal },
      sourcemap: true,
      target: 'es2020',
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'antd'],
      exclude: ['@pdfme/common', '@pdfme/schemas', '@pdfme/converter'],
    },
    worker: {
      format: 'es',
    },
  };
});
