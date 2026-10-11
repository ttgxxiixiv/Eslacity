import { defineConfig, devices } from '@playwright/test';

// Сквозные тесты гоняются по собранной версии (dist/), как её увидит пользователь.
// Перед запуском нужна сборка: `npm run e2e` делает её сам.
const PORT = 4317;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // В CI тесты идут шардами (задача 16.3): каждый шард пишет blob-отчёт, задача e2e-report сливает их в один.
  reporter: process.env.CI ? [['list'], ['blob']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'телефон',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 393, height: 852 },
        locale: 'ru-RU',
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
