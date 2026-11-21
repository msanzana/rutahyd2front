import {test,expect} from '@playwright/test';

test('Productos tiene diez subítems planos sin sangrías ni duplicar aperturas',async({page})=>{
  await page.goto('/#inicio');
  const prod=page.locator('#productSubnav');
  const admin=page.locator('#adminSubnav');
  await expect(prod).toBeHidden();
  await expect(admin).toBeHidden();
  await page.locator('#toggleProductSubnav').click();
  await expect(prod).toBeVisible();
  await expect(admin).toBeHidden();
  await expect(prod.locator('.subnav-heading')).toHaveCount(0);
  await expect(prod.locator('[data-catalog-key]')).toHaveCount(10);
  await expect(prod.locator('.nav-sublink')).toHaveCount(11);
  const indents=await prod.locator('.nav-sublink').evaluateAll(nodes=>
    nodes.map(node=>getComputedStyle(node).paddingLeft));
  expect(new Set(indents).size).toBe(1);
  await expect(prod.locator('[class*="nav-depth-"]')).toHaveCount(0);
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
