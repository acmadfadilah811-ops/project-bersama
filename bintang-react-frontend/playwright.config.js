/* global process */
import { defineConfig, devices } from '@playwright/test';

/**
 * Lihat https://playwright.dev/docs/test-configuration untuk informasi lebih lanjut.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Jalankan tes dalam berkas secara paralel */
  fullyParallel: true,
  /* Gagal jika ada kode uji tertinggal `test.only` di CI/CD */
  forbidOnly: !!process.env.CI,
  /* Jumlah percobaan ulang saat tes gagal di CI/CD */
  retries: process.env.CI ? 2 : 0,
  /* Jumlah pekerja paralel */
  workers: process.env.CI ? 1 : undefined,
  /* Format laporan tes */
  reporter: 'html',
  /* Pengaturan global untuk tes */
  use: {
    /* URL dasar untuk kemudahan navigasi page.goto('/') */
    baseURL: process.env.VITE_PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    /* Kumpulkan trace untuk melihat detail kegagalan */
    trace: 'on-first-retry',
    /* Jalankan browser secara tersembunyi (headless) */
    headless: true,
    /* Rekam tangkapan layar jika tes gagal */
    screenshot: 'only-on-failure',
  },

  /* Konfigurasi proyek browser untuk pengujian */
  projects: [
    {
      name: 'chrome',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Menggunakan Google Chrome bawaan sistem Anda
      },
    },
  ],
});
