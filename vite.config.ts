import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 5188, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 4096 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
