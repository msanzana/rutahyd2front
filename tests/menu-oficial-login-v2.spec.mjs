import {test,expect} from '@playwright/test';

const OFFICIAL=[
  'administracion','compras','ventas','proveedores',
  'clientes','productos','bodega','cuentas_corrientes'
];

test('ocho padres exactos, sin Inicio, Pedidos ni Inventario en el menú',async({page})=>{
  await page.route('**/api/v1/estado',r=>r.fulfill({
    status:503,contentType:'application/json',
    body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})
  }));
  await page.goto('/?acceso=1#inicio');
  const parents=await page.locator('.sidebar .nav > .nav-link, .sidebar .nav > .nav-group')
    .evaluateAll(items=>items.map(e=>e.dataset.nav||e.querySelector('.nav-link')?.dataset.nav));
  expect(parents).toEqual(OFFICIAL);
  const labels=await page.locator('.sidebar .nav > .nav-link > span, .sidebar .nav > .nav-group > .nav-parent > .nav-link > span')
    .allTextContents();
  expect(labels).toEqual(['Administración','Compras','Ventas','Proveedores','Clientes','Productos','Bodega','Cuentas corrientes']);
  await expect(page.locator('#productSubnav [data-catalog-key]')).toHaveCount(10);
  await expect(page.locator('#adminSubnav [data-admin-catalog]')).toHaveCount(10);
  await expect(page.locator('#officialModuleGrid .module-card')).toHaveCount(8);
});

test('pantalla de login inicial completa, JWT bloqueado si Laravel dice 503',async({page})=>{
  let attempted=0;
  await page.route('**/api/v1/estado',r=>r.fulfill({
    status:503,contentType:'application/json',
    body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})
  }));
  await page.route('**/api/v1/sesion',r=>{attempted++;return r.fulfill({status:503,body:'{}'});});
  await page.goto('/?acceso=1#inicio');
  const login=page.locator('#loginDialog');
  await expect(login).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-login-start','true');
  await expect(login.locator('#loginEmail')).toBeVisible();
  await expect(login.locator('#loginPassword')).toBeVisible();
  await expect(login.locator('#loginSubmit')).toBeDisabled();
  await expect(login.locator('#loginServerStatus')).toContainText('HTTP 503');
  expect(attempted).toBe(0);
  await login.locator('#loginDemo').click();
  await expect(login).toBeHidden();
  await page.locator('.sidebar .nav-link[data-nav="compras"]').click();
  await expect(page.locator('#workspaceTitle')).toHaveText('Órdenes de compra');
  await expect(page.locator('#workspaceContent')).toContainText('requiere autenticación');
});

test('JWT de prueba conecta Compras al recurso real de Laravel y no al localStorage',async({page})=>{
  let requests=0;
  await page.route('**/api/v1/estado',r=>r.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'disponible'})
  }));
  await page.route('**/api/v1/sesion',r=>r.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({token:'prueba.cabecera.firma',token_type:'Bearer',
      usuario:{id:1,nombre:'Administración CI',rol:'administrador',permisos:['compras.gestionar']}})
  }));
  await page.route('**/api/v1/recursos/ordenes_compra**',r=>{
    requests++;
    expect(r.request().headers().authorization).toBe('Bearer prueba.cabecera.firma');
    return r.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({data:[{id:72,numero:'OC-CI-72',estado:'Pendiente',total:17500}],last_page:1})});
  });
  await page.goto('/?acceso=1#inicio');
  await expect(page.locator('#loginSubmit')).toBeEnabled();
  await page.locator('#loginEmail').fill('ci@example.invalid');
  await page.locator('#loginPassword').fill('clave-fixture-ci');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
  await page.locator('.sidebar .nav-link[data-nav="compras"]').click();
  await expect(page.locator('#workspaceContent')).toContainText('OC-CI-72');
  expect(requests).toBe(1);
});

for(const width of [390,1440]){
 test('menú y pantalla de login no se desbordan a '+width+'px',async({page})=>{
   await page.route('**/api/v1/estado',r=>r.fulfill({
     status:503,contentType:'application/json',
     body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})
   }));
   await page.setViewportSize({width,height:840});
   await page.goto('/?acceso=1#inicio');
   await expect(page.locator('#loginDialog')).toBeVisible();
   const full=await page.evaluate(()=>{
     const rect=document.querySelector('#loginDialog .login-form').getBoundingClientRect();
     return rect.left>=0 && rect.right<=innerWidth+1 && document.documentElement.scrollWidth<=innerWidth+1;
   });
   expect(full).toBe(true);
   await page.locator('#loginDemo').click();
   if(width<900)await page.locator('#menuToggle').click();
   const parents=page.locator('.sidebar .nav > .nav-link, .sidebar .nav > .nav-group');
   await expect(parents).toHaveCount(8);
 });
}
