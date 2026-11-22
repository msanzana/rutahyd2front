import {test,expect} from '@playwright/test';

const payload={token:'test.jwt.fixtures',token_type:'Bearer',
  usuario:{id:10,nombre:'Administradora de prueba',rol:'administrador',permisos:[]}};
const reply=(route,data,status=200)=>route.fulfill({
  status,contentType:'application/json',body:JSON.stringify(data)
});

async function login(page,token=payload){
  await page.route('**/api/v1/estado',r=>reply(r,{servicio:'Ruta H&D2 API',estado:'disponible'}));
  await page.route('**/api/v1/sesion',r=>reply(r,token));
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('ci@example.invalid');
  await page.locator('#loginPassword').fill('Clave-FICTICIA-2026');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
}
test('Clientes: lista real, alta, edición y baja lógica desde Laravel',async({page})=>{
  const rows=[{id:8,codigo:'ANT-08',nombre:'Cliente anterior',rut:'11111111-1',
    correo_electronico:null,telefono:null,direccion:null,comuna:'Temuco',
    sector:null,observaciones:null,activo:1}];
  const writes=[];
  await page.route('**/api/v1/recursos/clientes**',r=>{
    const req=r.request(),method=req.method(),path=new URL(req.url()).pathname;
    expect(req.headers().authorization).toBe('Bearer test.jwt.fixtures');
    if(method==='GET')return reply(r,{data:rows,last_page:1,total:rows.length});
    const data=method==='DELETE'?null:req.postDataJSON();
    writes.push({method,path,data});
    if(method==='POST'){
      const row={id:9,activo:1,...data};rows.unshift(row);return reply(r,row,201);
    }
    if(method==='PUT'){
      const row=rows.find(x=>String(x.id)===path.split('/').at(-1));
      Object.assign(row,data);return reply(r,row);
    }
    if(method==='DELETE'){
      const row=rows.find(x=>String(x.id)===path.split('/').at(-1));
      row.activo=0;return reply(r,{id:row.id,activo:false,eliminacion:'logica'});
    }
    return reply(r,{},405);
  });
  await login(page);
  await page.locator('.nav-link[data-nav="clientes"]').click();
  await expect(page.locator('#workspaceContent')).toContainText('Cliente anterior');
  await page.getByRole('button',{name:'Nuevo registro'}).click();
  const editor=page.getByRole('dialog',{name:'Crear Clientes'});
  await expect(editor).toBeVisible();
  await editor.locator('[name="codigo"]').fill('CLI-009');
  await editor.locator('[name="nombre"]').fill('Cliente nuevo real');
  await editor.locator('[name="correo_electronico"]').fill('nuevo@example.invalid');
  await editor.getByRole('button',{name:'Crear registro'}).click();
  await expect(editor).toBeHidden();
  await expect(page.locator('#workspaceContent')).toContainText('Cliente nuevo real');
  await page.locator('#workspaceContent tbody tr').filter({hasText:'Cliente nuevo real'})
    .getByRole('button',{name:'Editar'}).click();
  const edit=page.getByRole('dialog',{name:'Editar Clientes'});
  await edit.locator('[name="nombre"]').fill('Cliente actualizado real');
  await edit.getByRole('button',{name:'Guardar cambios'}).click();
  await expect(page.locator('#workspaceContent')).toContainText('Cliente actualizado real');
  await page.locator('#workspaceContent tbody tr').filter({hasText:'Cliente actualizado real'})
    .getByRole('button',{name:'Desactivar'}).click();
  const confirm=page.getByRole('dialog',{name:'Confirmar desactivación'});
  await expect(confirm).toContainText('No se borrará su historial comercial');
  await confirm.getByRole('button',{name:'Sí, desactivar'}).click();
  await expect(page.locator('#workspaceContent tbody tr')
    .filter({hasText:'Cliente actualizado real'})).toContainText('Inactivo');
  expect(writes.some(x=>x.method==='POST'&&x.data.nombre==='Cliente nuevo real')).toBe(true);
  expect(writes.some(x=>x.method==='PUT'&&x.data.nombre==='Cliente actualizado real')).toBe(true);
  expect(writes.some(x=>x.method==='DELETE')).toBe(true);
});

test('Proveedores y Bodegas administran solo sus campos autorizados',async({page})=>{
  const calls=[];
  await page.route('**/api/v1/recursos/**',r=>{
    const method=r.request().method(),path=new URL(r.request().url()).pathname;
    if(method==='GET')return reply(r,{data:[],last_page:1,total:0});
    calls.push({method,path,data:r.request().postDataJSON()});
    return reply(r,{id:44,nombre:'Creado en prueba',activo:1},201);
  });
  await login(page);
  for(const [nav,resource,values] of [
    ['proveedores','proveedores',{nombre:'Proveedor de prueba',correo_electronico:'prov@example.invalid'}],
    ['bodega','bodegas',{codigo:'BOD-44',nombre:'Bodega de prueba',tipo:'general'}],
  ]){
    await page.locator('.nav-link[data-nav="'+nav+'"]').click();
    await page.getByRole('button',{name:'Nuevo registro'}).click();
    const dlg=page.getByRole('dialog',{name:'Crear '+(nav==='bodega'?'Bodegas':'Proveedores')});
    for(const [key,value] of Object.entries(values))await dlg.locator('[name="'+key+'"]').fill(value);
    await dlg.getByRole('button',{name:'Crear registro'}).click();
    await expect(dlg).toBeHidden();
  }
  expect(calls.map(v=>v.path)).toEqual([
    '/api/v1/recursos/proveedores','/api/v1/recursos/bodegas'
  ]);
  expect(calls.every(c=>c.method==='POST')).toBe(true);
  expect(calls[1].data.codigo).toBe('BOD-44');
  expect(calls[0].data.nombre).toBe('Proveedor de prueba');
});

test('Permisos y whitelist: usuarios sin gestión no pueden crear registros',async({page})=>{
  await page.route('**/api/v1/recursos/clientes**',r=>reply(r,{data:[],last_page:1,total:0}));
  const vendedor={token:'lector.jwt.fake',token_type:'Bearer',
    usuario:{id:7,nombre:'Operador CI',rol:'vendedor',permisos:['clientes.ver']}};
  await login(page,vendedor);
  await page.locator('.nav-link[data-nav="clientes"]').click();
  await expect(page.locator('#workspaceContent')).toContainText('No existen registros');
  await expect(page.getByRole('button',{name:'Nuevo registro'})).toHaveCount(0);
  const rejected=await page.evaluate(async()=>{
    try{
      await window.RutaHDApiCatalogos.createResource('ventas',{nombre:'No autorizado'});
      return false;
    }catch{return true;}
  });
  expect(rejected).toBe(true);
});
