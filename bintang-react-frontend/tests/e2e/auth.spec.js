import { test, expect } from '@playwright/test';

test.describe('Autentikasi & Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigasi ke halaman login sebelum setiap pengujian
    await page.goto('/');
  });

  test('Harus menampilkan elemen-elemen halaman login dengan benar', async ({ page }) => {
    // Memastikan input username dan password ada di halaman
    const usernameInput = page.locator('input#username');
    const passwordInput = page.locator('input#password');
    const loginButton = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveText('MASUK');
  });

  test('Harus menampilkan error jika login gagal dengan kredensial salah', async ({ page }) => {
    // Mengisi data kredensial yang salah
    await page.fill('input#username', 'salah_user');
    await page.fill('input#password', 'salah_password');

    // Klik tombol submit login
    await page.click('button[type="submit"]');

    // Memastikan pesan kesalahan muncul di layar (bisa berupa teks Indonesia atau default English dari server)
    const errorAlert = page.locator('text=Username atau password salah.')
      .or(page.locator('text=No active account found with the given credentials'));
    await expect(errorAlert).toBeVisible();
  });
});
