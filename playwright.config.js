// Testes de tela (navegador de verdade): sobem o servidor de produção com um banco temporário
// e os dados de demonstração. Rodar: npm run test:e2e (faz o build antes).
import os from 'node:os'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const PORTA = Number(process.env.E2E_PORTA ?? 4310)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1, // os testes mudam o mesmo banco de demonstração
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Recife',
    geolocation: { latitude: -8.06, longitude: -34.9 },
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } }, testIgnore: /celular/ },
    { name: 'celular', use: { ...devices['Pixel 7'] }, testMatch: /celular/ },
  ],
  webServer: {
    command: 'node server/index.js',
    url: `http://localhost:${PORTA}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORTA),
      DB_PATH: path.join(os.tmpdir(), `rota-e2e-${process.pid}.db`),
      GEOCODER: 'off',
      OSRM: 'off',
      MONITOR: 'off',
    },
  },
})
