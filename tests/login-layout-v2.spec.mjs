import {test,expect} from '@playwright/test';

test('login aparece en la cabecera y bloquea envío si la API está deshabilitada',async({page})=>{
  let sentLogin=false;
  await page.route('**/api/v1/estado',r=>r.fulfill({
    status:503,contentType:'application/json',
    body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})
  }));
  await page.route('**/api/v1/sesion',r=>{sentLogin=true;return r.fulfill({status:503,body:'{}'});});
  await page.goto('/#inicio');
  await expect(page.locator('#apiStatus')).toContainText('API no habilitada');
  await page.getByRole('button',{name:'Iniciar sesión'}).click();
  const login=page.getByRole('dialog',{name:'Iniciar sesión'});
  await expect(login).toBeVisible();
  await expect(login).toContainText('La API respondió HTTP 503');
  await expect(login.getByRole('button',{name:'Ingresar'})).toBeDisabled();
  expect(sentLogin).toBe(false);
  await login.getByRole('button',{name:'Cerrar inicio de sesión'}).click();
  await expect(login).toBeHidden();
});

test('JWT simulado habilita el botón de cerrar sesión y Usuarios sin cargar datos locales',async({page})=>{
  let requests=0;
  await page.route('**/api/v1/estado',r=>r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'disponible'})}));
  await page.route('**/api/v1/sesion',r=>{
    if(r.request().method()==='POST'){
      requests++;
      return r.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({token:'ci.aabb.ccdd',token_type:'Bearer',
          usuario:{nombre:'Administrador CI',rol:'administrador',permisos:['usuarios.gestionar','productos.gestionar']}})});
    }
    return r.fulfill({status:204,body:''});
  });
  await page.goto('/#inicio');
  await expect(page.locator('#apiStatus')).toContainText('API conectada');
  await page.locator('#authButton').click();
  await page.locator('#loginEmail').fill('ci@example.invalid');
  await page.locator('#loginPassword').fill('clave-solo-prueba');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
  await expect(page.locator('#authButton')).toHaveText('Cerrar sesión');
  await page.locator('#toggleAdminSubnav').click();
  await expect(page.locator('#navUsuarios')).toBeVisible();
  expect(requests).toBe(1);
  await page.locator('#authButton').click();
  await expect(page.locator('#authButton')).toHaveText('Iniciar sesión');
  await expect(page.locator('#navUsuarios')).toBeHidden();
});

for(const width of [1440,900,390,320]){
  test('sin solapes ni sangrías: viewport '+width,async({page})=>{
    await page.route('**/api/v1/estado',r=>r.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({servicio:'Ruta H&D2 API',estado:'no_habilitada'})}));
    await page.setViewportSize({width,height:width<=390?720:850});
    await page.goto('/#inicio');
    if(width<=900)await page.locator('#menuToggle').click();
    await page.locator('#toggleProductSubnav').click();
    await expect(page.locator('#productSubnav')).toBeVisible();
    const result=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('#productSubnav .nav-sublink')];
      const pad=nodes.map(el=>getComputedStyle(el).paddingLeft);
      const nav=document.querySelector('.sidebar .nav').getBoundingClientRect();
      const footer=document.querySelector('.sidebar-footer').getBoundingClientRect();
      return {
        equalIndent:new Set(pad).size===1,
        noHorizontalScroll:document.documentElement.scrollWidth<=window.innerWidth+1,
        sidebarNoOverlap:nav.bottom<=footer.top+2,
        authVisible:(()=>{const r=document.querySelector('#authButton').getBoundingClientRect();return r.width>0 && r.left>=0 && r.right<=window.innerWidth+1;})()
      };
    });
    expect(result.equalIndent).toBe(true);
    expect(result.noHorizontalScroll).toBe(true);
    expect(result.sidebarNoOverlap).toBe(true);
    expect(result.authVisible).toBe(true);
  });
}
