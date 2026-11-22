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
  await page.locator('#userMenuTrigger').click();
  await page.locator('#menuSignOut').click();
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
  await recovery.getByRole('button',{name:'Volver al inicio de sesión'}).click();
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


test('un 403 conserva sesión y muestra acceso denegado sin inventar datos',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.route('**/api/v1/sesion',r=>json(r,{token:'aaaa.bbbb.cccc',token_type:'Bearer',
    usuario:{id:2,nombre:'Supervisor CI',rol:'supervisor',permisos:[]}}));
  await page.route('**/api/v1/recursos/clientes**',r=>json(r,{message:'Acceso denegado'},403));
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('supervisor@example.invalid');
  await page.locator('#loginPassword').fill('solo-fixture');
  await page.locator('#loginSubmit').click();
  await page.locator('.nav-link[data-nav="clientes"]').click();
  await expect(page.locator('#workspaceContent')).toContainText('no tiene permisos');
  await expect(page.locator('#loginDialog')).toBeHidden();
  expect(await page.evaluate(()=>window.RutaHDAccesos.authenticated())).toBe(true);
});


test('enlace directo de recuperación mantiene formulario visible sin volver al login',async({page})=>{
  const token='a'.repeat(64);
  await page.route('**/api/v1/estado',async route=>{
    await new Promise(resolve=>setTimeout(resolve,450));
    await json(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  });
  let body=null;
  await page.route('**/api/v1/recuperacion/restablecer',async route=>{
    body=route.request().postDataJSON();
    await json(route,{mensaje:'Contraseña actualizada'});
  });
  await page.goto('/#recuperar?token='+token);
  const recovery=page.getByRole('dialog',{name:'Crear nueva contraseña'});
  await expect(recovery).toBeVisible();
  await expect(page.locator('#loginDialog')).toBeHidden();
  await expect(page.locator('#appShell')).toBeHidden();
  await page.waitForTimeout(1300);
  await expect(recovery).toBeVisible();
  await expect(page.locator('#loginDialog')).toBeHidden();
  await expect(page).not.toHaveURL(/token=/);
  await recovery.locator('#recovery-password').fill('Unica-Recuperacion-2026!');
  await recovery.locator('#recovery-confirmation').fill('Unica-Recuperacion-2026!');
  await recovery.locator('#recoverySubmit').click();
  await expect(recovery.locator('#recoveryStatus')).toContainText('actualizada correctamente');
  expect(body.token).toBe(token);
  expect(body.contrasena).toBe('Unica-Recuperacion-2026!');
  await expect(recovery).toBeVisible();
  await recovery.getByRole('button',{name:'Continuar al inicio de sesión'}).click();
  await expect(page.locator('#loginDialog')).toBeVisible();
});

test('token vencido mantiene la recuperación abierta y permite solicitar otro enlace',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.route('**/api/v1/recuperacion/restablecer',r=>json(r,{message:'Token vencido'},422));
  await page.goto('/#recuperar?token='+'b'.repeat(64));
  const recovery=page.getByRole('dialog',{name:'Crear nueva contraseña'});
  await recovery.locator('#recovery-password').fill('Una-clave-segura-2026!');
  await recovery.locator('#recovery-confirmation').fill('Una-clave-segura-2026!');
  await recovery.locator('#recoverySubmit').click();
  await expect(recovery.locator('#recoveryStatus')).toContainText('ha expirado');
  await expect(recovery).toBeVisible();
  await expect(page.locator('#loginDialog')).toBeHidden();
});

test('recuperación adaptable en teléfono sin recortes',async({page})=>{
  await page.setViewportSize({width:390,height:820});
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.goto('/#recuperar?token='+'c'.repeat(64));
  const recovery=page.getByRole('dialog',{name:'Crear nueva contraseña'});
  await expect(recovery).toBeVisible();
  const metrics=await recovery.locator('.recovery-layout').evaluate(element=>{
    const r=element.getBoundingClientRect();
    return {left:r.left,right:r.right,width:innerWidth,overflow:document.documentElement.scrollWidth};
  });
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.width+1);
  expect(metrics.overflow).toBeLessThanOrEqual(metrics.width+1);
});


test('nuevo enlace con query sobrevive al desafio i=1 y nunca abre login',async({page})=>{
  const token='d'.repeat(64);
  await page.route('**/api/v1/estado',async route=>{
    await new Promise(resolve=>setTimeout(resolve,700));
    await json(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  });
  await page.goto('/?recuperar='+token+'&i=1');
  const recovery=page.getByRole('dialog',{name:'Crear nueva contraseña'});
  await expect(recovery).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(recovery).toBeVisible();
  await expect(page.locator('#loginDialog')).toBeHidden();
  const data=await page.evaluate(()=>({
    active:window.RutaHDRecuperacion.isActive(),
    href:location.href,
    referrerPolicy:document.querySelector('meta[name="referrer"]')?.content,
    form:document.querySelector('.recovery-layout')?.getBoundingClientRect().width
  }));
  expect(data.active).toBe(true);
  expect(data.href).not.toContain(token);
  expect(data.href).not.toContain('recuperar=');
  expect(data.referrerPolicy).toBe('no-referrer');
  expect(data.form).toBeGreaterThan(200);
});

test('recuperación desde query conserva token exacto hasta el POST',async({page})=>{
  const token='e'.repeat(64);
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  let request=null;
  await page.route('**/api/v1/recuperacion/restablecer',r=>{
    request=r.request().postDataJSON();
    return json(r,{mensaje:'Contraseña cambiada'});
  });
  await page.goto('/?recuperar='+token);
  const recovery=page.getByRole('dialog',{name:'Crear nueva contraseña'});
  await recovery.locator('#recovery-password').fill('UnaClaveLargaPara2026!');
  await recovery.locator('#recovery-confirmation').fill('UnaClaveLargaPara2026!');
  await recovery.locator('#recoverySubmit').click();
  await expect(recovery.locator('#recoveryStatus')).toContainText('actualizada correctamente');
  expect(request?.token).toEqual(token);
  await expect(page.locator('#loginDialog')).toBeHidden();
});


test('un sondeo de estado transitorio no expulsa a una sesión JWT ya autenticada',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.route('**/api/v1/sesion',r=>json(r,{
    token:'aaaa.bbbb.cccc',token_type:'Bearer',
    usuario:{id:1,nombre:'Admin QA',rol:'administrador',permisos:[]}
  }));
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('qa@example.invalid');
  await page.locator('#loginPassword').fill('clave-sintetica-para-qa');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
  await page.evaluate(()=>{
    document.dispatchEvent(new CustomEvent('rutahd:api-estado',{detail:{disponible:false}}));
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.RutaHDAccesos.authenticated())).toBe(true);
  await expect(page.locator('#loginDialog')).toBeHidden();
  await page.evaluate(()=>{
    document.dispatchEvent(new CustomEvent('rutahd:api-estado',{detail:{disponible:true}}));
  });
  await expect(page.locator('#appShell')).toBeVisible();
});

test('401 de una solicitud anterior no cierra la sesión JWT recién autenticada',async({page})=>{
  await page.route('**/api/v1/estado',r=>json(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  let resolveOld;
  const pendingOld=new Promise(resolve=>{resolveOld=resolve;});
  await page.route('**/api/v1/usuarios',async r=>{
    if(r.request().headers().authorization==='Bearer aaaa.bbbb.cccc'){
      await pendingOld;
      return json(r,{message:'Token anterior revocado'},401);
    }
    return json(r,{usuarios:[],roles:[]});
  });
  await page.route('**/api/v1/sesion',r=>json(r,{
    token:'aaaa.bbbb.cccc',token_type:'Bearer',
    usuario:{id:1,nombre:'Admin QA',rol:'administrador',permisos:[]}
  }));
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('qa@example.invalid');
  await page.locator('#loginPassword').fill('clave-sintetica');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
  const request=page.evaluate(()=>window.RutaHDApiCatalogos.usersAll().then(
    ()=>({ok:true}),e=>({status:e.status})
  ));
  await page.waitForTimeout(250);
  await page.evaluate(()=>{
    window.RutaHDApiCatalogos.authenticate('dddd.eeee.ffff');
    window.RutaHDAccesos.setSession({nombre:'Admin actualizado',rol:'administrador',permisos:[]});
  });
  resolveOld();
  const result=await request;
  expect(result.status).toBe(401);
  expect(await page.evaluate(()=>window.RutaHDAccesos.authenticated())).toBe(true);
  await expect(page.locator('#loginDialog')).toBeHidden();
});
