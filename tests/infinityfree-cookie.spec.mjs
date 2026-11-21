import {test,expect} from '@playwright/test';

test('incluye únicamente cookie técnica de mismo origen ante anti-bot InfinityFree',async({page})=>{
  await page.goto('/#administracion');
  await page.evaluate(()=>{document.cookie='rutahd_gate_test=ok; Path=/; SameSite=Lax';});
  let included=false;
  await page.route('**/api/v1/estado',async route=>{
    const req=route.request();
    included=(req.headers().cookie||'').includes('rutahd_gate_test=ok');
    await route.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})});
  });
  await page.locator('#adminRemoto').getByRole('button',{name:'Verificar API Laravel'}).click();
  await expect(page.locator('#remoteStatus')).toContainText('API protegida (HTTP 503)');
  expect(included).toBe(true);
  const apiObject=await page.evaluate(()=>({persisted:localStorage.getItem('rutaHDjwt')||sessionStorage.getItem('rutaHDjwt')}));
  expect(apiObject.persisted).toBeFalsy();
});
