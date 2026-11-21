import {test,expect} from '@playwright/test';

test('Productos conserva sus diez subítems agrupados sin duplicar aperturas',async({page})=>{
  await page.goto('/#inicio');
  const prod=page.locator('#productSubnav');
  const admin=page.locator('#adminSubnav');
  await expect(prod).toBeHidden();
  await expect(admin).toBeHidden();
  await page.locator('#toggleProductSubnav').click();
  await expect(prod).toBeVisible();
  await expect(admin).toBeHidden();
  await expect(prod.locator('.subnav-heading')).toHaveText([
    'Rubro → Departamento → Familia → Línea',
    'Marca → Modelo',
    'Unidades, envase y tributación'
  ]);
  await expect(prod.locator('[data-catalog-key]')).toHaveCount(10);
  await expect(prod.locator('[data-nav="catalogos.lineas"]')).toHaveClass(/nav-depth-3/);
  await page.locator('#toggleAdminSubnav').click();
  await expect(prod).toBeHidden();
  await expect(admin).toBeVisible();
  await admin.locator('[data-admin-catalog="marcas"]').click();
  await expect(admin).toBeVisible();
  await expect(prod).toBeHidden();
  await expect(page.locator('#workspaceTitle')).toHaveText('Marcas');
  await page.locator('#toggleProductSubnav').click();
  await expect(prod).toBeVisible();
  await expect(admin).toBeHidden();
  await prod.locator('[data-nav="catalogos.lineas"]').click();
  await expect(prod).toBeVisible();
  await expect(admin).toBeHidden();
  await expect(page.locator('#workspaceTitle')).toHaveText('Líneas');
  await page.locator('#toggleProductSubnav').click();
  await expect(prod).toBeHidden();
});

test('la página publica distingue integración real bloqueada de catálogos demo',async({page})=>{
  await page.route('**/api/v1/estado',route=>route.fulfill({
    status:503,contentType:'application/json',
    body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})
  }));
  await page.goto('/#administracion');
  await page.locator('#adminRemoto').getByRole('button',{name:'Verificar API Laravel'}).click();
  await expect(page.locator('#remoteStatus')).toContainText('API protegida (HTTP 503)');
});
