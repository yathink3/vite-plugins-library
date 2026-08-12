import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'plugins/codeSplit': resolve(__dirname, 'src/plugins/codeSplit.ts'),
        'plugins/envLoader': resolve(__dirname, 'src/plugins/envLoader.ts'),
        'plugins/imageToCdn': resolve(__dirname, 'src/plugins/imageToCdn.ts'),
        'plugins/jsAsJsx': resolve(__dirname, 'src/plugins/jsAsJsx.ts'),
        'plugins/postcssShadowDom': resolve(__dirname, 'src/plugins/postcssShadowDom.ts'),
        'plugins/publicCssManage': resolve(__dirname, 'src/plugins/publicCssManage.ts'),
        'plugins/buildLogModifier': resolve(__dirname, 'src/plugins/buildLogModifier.ts'),
        'plugins/customConfig': resolve(__dirname, 'src/plugins/customConfig.ts'),
        'plugins/proxyRedirects': resolve(__dirname, 'src/plugins/proxyRedirects.ts'),
        'utils/logger': resolve(__dirname, 'src/utils/logger.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: [
        'vite',
        'postcss',
        'fs',
        'path',
        'url',
        'node:fs',
        'node:path',
        'node:url',
      ],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
