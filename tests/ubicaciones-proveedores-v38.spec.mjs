import {test,expect} from '@playwright/test';

const json=(route,body,status=200)=>route.fulfill({
 status,contentType:'application/json',body:JSON.stringify(body)
});
const geo={
 paises:[{id:1,nombre:'Chile',codigo:'CL',activo:true,parentId:null}],
 regiones:[{id:9,nombre:'La Araucanía',codigo:'09',activo:true,parentId:1}],
 provincias:[{id:91,nombre:'Cautín',codigo:'091',activo:true,parentId:9}],
 comunas:[{id:9101,nombre:'Temuco',codigo:'09101',activo:true,parentId:91}],
 ciudades:[{id:9101,nombre:'Temuco',tipoLocalidad:'CIUDAD_REFERENCIADA',activo:true,parentId:9101}]
};
async function fixture(page){
 const writes=[];
 let providers=[{id:41,nombre:'Proveedor inicial',rut:'12345678-5',
  giro:'Servicios',activo:1,ciudad_id:null,ciudad:null,comuna_nombre:null}];
 await page.route('**/api/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname,method=request.method();
  if(p==='/api/v1/estado')return json(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(p==='/api/v1/sesion')return json(route,{token:'header.payload.signature',token_type:'Bearer',
    usuario:{id:1,nombre:'Administrador CI',rol:'administrador',
      permisos:['compras.gestionar','clientes.gestionar','usuarios.gestionar']}});
  if(request.headers().authorization!=='Bearer header.payload.signature')return json(route,{},401);
  if(p.startsWith('/api/v1/ubicaciones/')){
   const key=p.split('/').at(-1);
   if(key==='jerarquia')return json(route,{},404);
   const list=(geo[key]||[]).filter(x=>!url.searchParams.get('padre_id')||
     Number(x.parentId)===Number(url.searchParams.get('padre_id')));
   return json(route,{data:list,last_page:1,total:list.length});
  }
  if(p==='/api/v1/recursos/proveedores'){
   if(method==='POST'){
    const dto=request.postDataJSON();writes.push(dto);
    providers.push({id:42,...dto,ciudad:'Temuco',comuna_nombre:'Temuco'});
    return json(route,{id:42,...dto},201);
   }
   return json(route,{data:providers,last_page:1,total:providers.length});
  }
  if(p==='/api/v1/proveedores/mix'){
   return json(route,{data:providers.map(x=>({...x,
     cantidad_productos_mix:x.id===41?2:0})),last_page:1,total:providers.length});
  }
  return json(route,{},404);
 });
 await page.goto('/#inicio');
 await page.locator('#loginEmail').fill('ci@example.invalid');
 await page.locator('#loginPassword').fill('No-real-2026');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 return {writes};
}

test('tercer nivel de Administración oculto tras login y accesible desde el buscador',async({page})=>{
 await fixture(page);
 await expect(page.locator('#adminSubnav')).toBeHidden();
 await expect(page.locator('#ubicacionesSubnav')).toBeHidden();
 await page.locator('#toggleAdminSubnav').click();
 await page.locator('#toggleUbicacionesSubnav').click();
 await expect(page.locator('#ubicacionesSubnav')).toBeVisible();
 await page.locator('#ubicacionesSubnav [data-nav="ubicaciones.ciudades"]').click();
 await expect(page.locator('#workspaceTitle')).toHaveText('Ciudades');
 await expect(page.locator('.location-module')).toBeVisible();
 await expect(page.locator('.location-table')).toContainText('Temuco');
 await page.setViewportSize({width:390,height:820});
 await page.locator('#menuToggle').click();
 await expect(page.locator('#menuQuickSearch')).toBeVisible();
 await page.locator('#menuQuickSearch').fill('administracion ubicaciones ciudades');
 await expect(page.locator('#menuQuickResults')).toContainText('Ciudades');
});

test('nuevo proveedor SII guarda solo ciudad_id y todos los niveles se obtienen desde cascada',async({page})=>{
 const {writes}=await fixture(page);
 await page.locator('.nav-link[data-nav="proveedores"]').click();
 await page.getByRole('button',{name:'Nuevo registro'}).click();
 const dlg=page.locator('dialog.official-editor[open]');
 await expect(dlg).toBeVisible();
 await dlg.locator('input[name="nombre"]').fill('Proveedor territorial');
 await dlg.locator('input[name="razon_social"]').fill('Proveedor Territorial SpA');
 await dlg.locator('input[name="giro"]').fill('Distribución de mercaderías');
 await dlg.locator('input[name="correo_dte"]').fill('dte@example.invalid');
 const selects=dlg.locator('.location-chain select');
 await expect(selects).toHaveCount(5);
 await expect(selects.nth(0)).toHaveValue('1');
 await selects.nth(1).selectOption('9');
 await selects.nth(2).selectOption('91');
 await selects.nth(3).selectOption('9101');
 await selects.nth(4).selectOption('9101');
 await dlg.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect(dlg).toBeHidden();
 expect(writes).toHaveLength(1);
 expect(writes[0]).toMatchObject({nombre:'Proveedor territorial',
  razon_social:'Proveedor Territorial SpA',giro:'Distribución de mercaderías',
  correo_dte:'dte@example.invalid',ciudad_id:9101});
 for(const field of ['pais_id','region_id','provincia_id','comuna_id','comuna','ciudad']){
  expect(writes[0]).not.toHaveProperty(field);
 }
});

test('directorio de mix comparte columnas de proveedores y añade cantidad de productos',async({page})=>{
 await fixture(page);
 await page.locator('#toggleProviderSubnav').click();
 await page.locator('#providerSubnav [data-nav="proveedores_productos"]').click();
 const table=page.locator('.supplier-products-module table');
 for(const field of ['Nombre / razón social','RUT','Giro','Dirección','Ciudad','Comuna',
  'Teléfono','Correo','Estado','Productos en mix','Acciones']){
  await expect(table.locator('thead')).toContainText(field);
 }
 await expect(table.locator('tbody')).toContainText('Proveedor inicial');
 await expect(table.locator('tbody .supplier-mix-badge').first()).toHaveText('2');
});
