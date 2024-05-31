import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  external: [
    'react',
    'react-dom',
    'next',
  ],
  minify: false, // true

  // Handle css modules properly
  // ref: https://github.com/egoist/tsup/issues/536#issuecomment-1752121594
  loader: {
    '.css': 'local-css',
  },
});
