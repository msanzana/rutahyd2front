import {test,expect} from '@playwright/test';

test('frontend detecta API bloqueada antes de solicitar contraseñas',async ({page})=>{
  let calls=0;
  await page.route('**/api/v1/estado',async route=>{
    calls++;
    await route.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})});
  });
  await page.goto('/#administracion');
  await page.locator('#adminRemoto').getByRole('button',{name:'Verificar API Laravel'}).click();
  await expect(page.locator('#remoteStatus')).toContainText('API protegida (HTTP 503)');
  await expect(page.locator('#adminRemoto input[type=password]')).toBeVisible();
  expect(calls).toBeGreaterThanOrEqual(1);
});

test('frontend reconoce estado Laravel disponible, sin guardar tokens',async ({page})=>{
  await page.route('**/api/v1/estado',async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'disponible',version:'v2-es'})});
  });
  await page.goto('/#administracion');
  await page.locator('#adminRemoto').getByRole('button',{name:'Verificar API Laravel'}).click();
  await expect(page.locator('#remoteStatus')).toContainText('API Laravel disponible');
  const result=await page.evaluate(()=>{
    const keys=Object.keys(window.localStorage);
    return {api:Boolean(window.RutaHDApiCatalogos.status),hasJwt:keys.some(k=>/token|jwt/i.test(k))};
  });
  expect(result.api).toBe(true);
  expect(result.hasJwt).toBe(false);
});
