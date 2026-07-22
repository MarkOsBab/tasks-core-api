import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Only the modules in scope (docs/unit-testing-scope.md); everything else is P3.
      include: [
        'src/lib/auth/**/*.ts',
        'src/domain/auth/**/*.ts',
        'src/domain/oauth/**/*.ts',
        'src/domain/tasks/**/*.ts',
        'src/domain/time-entries/**/*.ts',
        'src/domain/base/**/*.ts',
        'src/domain/users/**/*.ts',
        'src/domain/board-columns/**/*.ts',
        'src/lib/pagination.ts',
        'src/lib/validation.ts',
        'src/lib/ids.ts',
        'src/lib/str.ts',
        'src/lib/html-text.ts',
        'src/lib/colors.ts',
      ],
      // CI gate (>=80% over the P1 set) — enable in task #31 once the P1 modules have
      // their tests; today it would fail by construction.
      // thresholds: { statements: 80, branches: 80 },
    },
  },
});
