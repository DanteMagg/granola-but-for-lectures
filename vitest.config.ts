import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/main.tsx',
        'src/**/*.d.ts',
        'src/__tests__/**',
      ],
      // Thresholds for core tested files
      // Overall coverage will improve as more tests are added
      thresholds: {
        // Global thresholds (lowered for initial setup)
        statements: 14,
        branches: 9,
        functions: 15,
        lines: 14,
        // Per-file thresholds for core files
        'src/renderer/stores/sessionStore.ts': {
          statements: 75,
          branches: 50,
          functions: 70,
          lines: 75,
        },
        'src/renderer/components/SlideViewer.tsx': {
          statements: 80,
          branches: 80,
          functions: 60,
          lines: 80,
        },
        'src/renderer/components/Sidebar.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        'src/renderer/hooks/usePdfImport.ts': {
          statements: 70,
          branches: 70,
          functions: 60,
          lines: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
})

