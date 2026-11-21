import {test,expect} from '@playwright/test';

const OFFICIAL=['Administración','Compras','Ventas','Proveedores','Clientes','Productos','Bodega','Cuentas corrientes'];
const json=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});

test('producción exige login y nunca ofrece demostración ni localStorage',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'no_habilitada'},503));
  await page.goto('/#inicio');
  await expect(page.getByRole('dialog',{name:'Iniciar sesión'})).toBeVisible();
  await expect(page.locator('#loginDemo')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/is-authenticated/);
  await expect(page.locator('#loginSubmit')).toBeDisabled();
  await expect(page.locator('#loginServerStatus')).toContainText('503');
  await expect(page.locator('#appShell')).toBeHidden();
  const modules=page.locator('.sidebar .nav > .nav-link,.sidebar .nav > .nav-group');
  await expect(modules).toHaveCount(8);
  const names=await page.locator('.sidebar .nav > .nav-link > span,.sidebar .nav > .nav-group > .nav-parent > .nav-link > span').allTextContents();
  expect(names).toEqual(OFFICIAL);
  const sources=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.src));
  expect(sources.join(' ')).not.toContain('catalogos.js');
  expect(sources.join(' ')).not.toContain('/app.js');
  expect(sources.join(' ')).toContain('app-produccion.js');
});

test('JWT permite entrar, consultar Compras y cerrar sesión sin mezclar registros locales',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  let loginCalls=0,queryCalls=0;
  await page.route('**/api/v1/sesion',r=>{
    if(r.request().method()==='POST'){
      loginCalls++;
      return json(r,{token:'aaaa.bbbb.cccc',token_type:'Bearer',
        usuario:{id:1,nombre:'Administrador CI',rol:'administrador',permisos:['compras.gestionar','productos.gestionar']}});
    }
    return r.fulfill({status:204,body:''});
  });
  await page.route('**/api/v1/recursos/ordenes_compra**',r=>{
    queryCalls++;
    expect(r.request().headers().authorization).toBe('Bearer aaaa.bbbb.cccc');
    return json(r,{data:[{id:44,numero:'OC-REAL-CI',estado:'Pendiente',total:2000}],last_page:1});
  });
  await page.goto('/#inicio');
  await expect(page.locator('#loginSubmit')).toBeEnabled();
  await page.locator('#loginEmail').fill('admin@example.invalid');
  await page.locator('#loginPassword').fill('clave-solo-para-prueba');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
  await expect(page.locator('#appShell')).toBeVisible();
  await page.locator('.nav-link[data-nav="compras"]').click();
  await expect(page.locator('#workspaceContent')).toContainText('OC-REAL-CI');
  expect(queryCalls).toBeGreaterThanOrEqual(1);
  expect(loginCalls).toBe(1);
  await page.locator('#authButton').click();
  await expect(page.locator('#loginDialog')).toBeVisible();
  await expect(page.locator('#appShell')).toBeHidden();
});

test('CRUD de Productos y usuarios solo aparecen con sesión autorizada',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.route('**/api/v1/sesion',r=>json(r,{token:'aaaa.bbbb.cccc',token_type:'Bearer',
    usuario:{id:1,nombre:'Administrador CI',rol:'administrador',permisos:['productos.gestionar','usuarios.gestionar']}}));
  await page.route('**/api/v1/usuarios',r=>json(r,{usuarios:[],roles:[]}));
  await page.route('**/api/v1/productos**',r=>json(r,{data:[],current_page:1,last_page:1}));
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('admin@example.invalid');
  await page.locator('#loginPassword').fill('clave-fixture');
  await page.locator('#loginSubmit').click();
  await page.locator('.nav-link[data-nav="productos"]').click();
  await expect(page.locator('#productosReales')).toBeVisible();
  await page.locator('#toggleAdminSubnav').click();
  await expect(page.locator('#navUsuarios')).toBeVisible();
  await page.locator('#navUsuarios').click();
  await expect(page.locator('#usersCrud')).toBeVisible();
});

for(const width of [390,1440]){
 test('login producción adaptable sin recortes '+width,async({page})=>{
  await page.setViewportSize({width,height:840});
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'no_habilitada'},503));
  await page.goto('/#inicio');
  await expect(page.locator('#loginDialog')).toBeVisible();
  const isInside=await page.evaluate(()=>{
    const box=document.querySelector('#loginForm').getBoundingClientRect();
    return box.width>0 && box.left>=0 && box.right<=innerWidth+1 &&
      document.documentElement.scrollWidth<=innerWidth+1;
  });
  expect(isInside).toBe(true);
 });
}


test('login productivo usa dos columnas profesionales en escritorio',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'no_habilitada'},503));
  await page.goto('/#inicio');
  await expect(page.locator('#loginDialog')).toBeVisible();
  const metrics=await page.evaluate(()=>{
    const form=document.querySelector('#loginDialog .login-form');
    const style=getComputedStyle(form),rect=form.getBoundingClientRect();
    return {width:rect.width,columns:style.gridTemplateColumns.split(' ').length,
      intro:getComputedStyle(form,'::before').display};
  });
  expect(metrics.width).toBeGreaterThan(760);
  expect(metrics.columns).toBe(2);
  expect(metrics.intro).not.toBe('none');
});


test('recuperación segura permite volver al login sin una sesión falsa',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'no_habilitada'},503));
  await page.goto('/#inicio');
  await page.locator('#loginRecover').click();
  const recovery=page.locator('dialog').filter({hasText:'Recuperar cuenta'});
  await expect(recovery).toBeVisible();
  await recovery.getByRole('button',{name:'Cancelar'}).click();
  await expect(page.locator('#loginDialog')).toBeVisible();
  await expect(page.locator('#loginSubmit')).toBeDisabled();
});


test('una respuesta 401 en cualquier módulo cierra la sesión global sin usar datos demo',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.route('**/api/v1/sesion',r=>{
    if(r.request().method()==='POST')return json(r,{token:'aaaa.bbbb.cccc',token_type:'Bearer',
      usuario:{id:1,nombre:'Administrador CI',rol:'administrador',permisos:['compras.gestionar']}});
    return r.fulfill({status:204,body:''});
  });
  await page.route('**/api/v1/recursos/ordenes_compra**',r=>json(r,{message:'Sesión revocada'},401));
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('admin@example.invalid');
  await page.locator('#loginPassword').fill('solo-fixture-no-real');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#appShell')).toBeVisible();
  await page.locator('.nav-link[data-nav="compras"]').click();
  await expect(page.locator('#loginDialog')).toBeVisible();
  await expect(page.locator('#appShell')).toBeHidden();
  const session=await page.evaluate(()=>({
    authenticated:window.RutaHDAccesos.authenticated(),
    storedKeys:Object.keys(localStorage).filter(k=>/jwt|token/i.test(k))
  }));
  expect(session.authenticated).toBe(false);
  expect(session.storedKeys).toEqual([]);
});
