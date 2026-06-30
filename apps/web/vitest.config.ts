import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./test/setup-msw.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // server-only throws when loaded outside a real Next server context.
      // In the Node test env, alias it to the package's no-op build so the
      // server modules (db, agent wrappers) can be imported under test.
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
});
