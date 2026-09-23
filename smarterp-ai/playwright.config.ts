import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// Un port distinct permet de tester le mode API sans réutiliser un serveur démo.
const port = env.PLAYWRIGHT_PORT || '5173'
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  outputDir: join(tmpdir(), 'smarterp-ai-playwright-results'),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
  },
})
