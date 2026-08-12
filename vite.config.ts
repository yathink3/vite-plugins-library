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
        'plugins/envValidator': resolve(__dirname, 'src/plugins/envValidator.ts'),
        'plugins/compression': resolve(__dirname, 'src/plugins/compression.ts'),
        'plugins/htmlMeta': resolve(__dirname, 'src/plugins/htmlMeta.ts'),
        'plugins/apiMock': resolve(__dirname, 'src/plugins/apiMock.ts'),
        'utils/logger': resolve(__dirname, 'src/utils/logger.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        'vite',
        'postcss',
        'fs',
        'path',
        'url',
        'zlib',
        'node:fs',
        'node:path',
        'node:url',
        'node:zlib',
      ],
    },
    sourcemap: false,
    minify: 'esbuild',
    emptyOutDir: true,
  },
});
