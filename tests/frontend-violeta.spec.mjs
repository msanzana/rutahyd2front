import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('usa el tema violeta y los estilos cargan', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Ruta H&D2 · Identidad violeta');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const values = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      brand: styles.getPropertyValue('--brand').trim(),
      deep: styles.getPropertyValue('--brand-deep').trim(),
      canvas: styles.getPropertyValue('--canvas').trim(),
      sidebarBackground: getComputedStyle(document.querySelector('.sidebar')).backgroundImage,
    };
  });
  expect(values.brand).toBe('#6d28d9');
  expect(values.deep).toBe('#2e1065');
  expect(values.canvas).toBe('#faf8ff');
  expect(values.sidebarBackground).toContain('gradient');
});

test('la navegación de la muestra funciona', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Explorar paleta' }).click();
  await expect(page).toHaveURL(/#paleta$/);
  await expect(page.getByRole('heading', { name: 'Una escala, infinitos matices' })).toBeVisible();
});

test('las tarjetas son referencias, no datos inventados', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.module')).toHaveCount(6);
  await expect(page.locator('.module .status')).toHaveCount(6);
  await expect(page.getByText('Sin datos reales')).toBeVisible();
});

test('captura de escritorio sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/rutahyd2-violeta-escritorio.png', fullPage: true });
});

test('captura de móvil sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/rutahyd2-violeta-movil.png', fullPage: true });
});
