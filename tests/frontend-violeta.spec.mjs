import { test, expect } from '@playwright/test';

test('carga interfaz violeta, identidad H&D y sin cifras inventadas', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Ruta H&D2/);
  await expect(page.getByRole('heading',{name:'Tu operación, en un solo lugar.'})).toBeVisible();
  await expect(page.locator('.brand-logo')).toHaveJSProperty('complete',true);
  expect(await page.locator('.brand-logo').evaluate(el=>el.naturalWidth)).toBeGreaterThan(50);
  expect(await page.locator('#statOrders').textContent()).toBe('0');
  expect(await page.locator('#statClients').textContent()).toBe('0');
  expect(await page.locator('#statProducts').textContent()).toBe('0');
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--v700').trim())).toBe('#6d28d9');
});

test('crea, edita y elimina cliente con confirmación', async ({page}) => {
  await page.goto('/');
  await page.locator('[data-nav="clientes"].nav-link').click();
  await expect(page.getByRole('heading',{name:'Clientes',exact:true})).toBeVisible();
  await page.locator('#newButton').click();
  await expect(page.getByRole('heading',{name:'Nuevo cliente'})).toBeVisible();
  await page.locator('#field-nombre').fill('Cliente de prueba');
  await page.locator('#field-rut').fill('11.111.111-1');
  await page.locator('#field-telefono').fill('+56912345678');
  await page.locator('#field-email').fill('prueba@example.cl');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('.data-table')).toContainText('Cliente de prueba');
  await expect(page.locator('.toast.success').first()).toBeVisible();
  await page.reload();
  await page.locator('[data-nav="clientes"].nav-link').click();
  await expect(page.locator('.data-table')).toContainText('Cliente de prueba');
  await page.getByRole('button',{name:/Editar Cliente de prueba/}).click();
  await page.locator('#field-nombre').fill('Cliente actualizado');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('.data-table')).toContainText('Cliente actualizado');
  await page.getByRole('button',{name:/Eliminar Cliente actualizado/}).click();
  await expect(page.getByRole('heading',{name:'¿Eliminar este cliente?'})).toBeVisible();
  await page.locator('#confirmCancel').click();
  await expect(page.locator('.data-table')).toContainText('Cliente actualizado');
  await page.getByRole('button',{name:/Eliminar Cliente actualizado/}).click();
  await page.locator('#confirmAccept').click();
  await expect(page.getByText('Todavía no hay registros')).toBeVisible();
});

test('valida campos obligatorios y evita duplicados', async ({page}) => {
  await page.goto('/#productos');
  await page.locator('#newButton').click();
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('#formError')).toContainText('Completa el campo');
  await page.locator('#field-codigo').fill('A-100');
  await page.locator('#field-nombre').fill('Producto de prueba');
  await page.locator('#field-precio').fill('950');
  await page.locator('#field-stock').fill('2');
  await page.locator('#field-minimo').fill('5');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('.data-table')).toContainText('Producto de prueba');
  await page.locator('#newButton').click();
  await page.locator('#field-codigo').fill('A-100');
  await page.locator('#field-nombre').fill('Duplicado');
  await page.locator('#recordForm [type="submit"]').click();
  await expect(page.locator('#formError')).toContainText('Ya existe');
});

test('genera informes y CSV a partir de datos reales del navegador', async ({page}) => {
  await page.goto('/#clientes');
  await page.locator('#newButton').click();
  await page.locator('#field-nombre').fill('Distribuidora Ejemplo');
  await page.locator('#field-rut').fill('12.345.678-9');
  await page.locator('#recordForm [type="submit"]').click();
  await page.locator('[data-nav="informes"].nav-link').click();
  await expect(page.getByRole('heading',{name:'Informes'})).toBeVisible();
  const downloadEvent=page.waitForEvent('download');
  await page.locator('[data-action="export"][data-kind="clientes"]').click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^rutahd2-clientes-.*\.csv$/);
  await expect(page.locator('.toast.success').first()).toBeVisible();
});

test('muestra detalles, avisos e información de uso', async ({page}) => {
  await page.goto('/');
  await page.locator('#notificationButton').click();
  await expect(page.locator('#infoDialog')).toBeVisible();
  await page.locator('#infoClose').click();
  await page.locator('[data-action="about"]').click();
  await expect(page.locator('#infoDescription')).toContainText('no está activado');
});

test('es adaptable a pantallas móviles, sin desplazamiento horizontal', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#menuToggle')).toBeVisible();
  await page.locator('#menuToggle').click();
  await page.locator('.sidebar [data-nav="pedidos"]').click();
  await expect(page.getByRole('heading',{name:'Pedidos',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
  await page.screenshot({path:'artifacts/rutahd2-panel-movil.png',fullPage:true});
});

test('captura dashboard profesional en escritorio', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.locator('.module-card')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
  await page.screenshot({path:'artifacts/rutahd2-panel-escritorio.png',fullPage:true});
});
