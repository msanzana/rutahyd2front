import {test,expect} from '@playwright/test';

const reply=(route,data,status=200)=>route.fulfill({
 status,contentType:'application/json',body:JSON.stringify(data)
});
async function login(page){
 await page.goto('/#inicio');
 await page.locator('#loginEmail').fill('ci@example.invalid');
 await page.locator('#loginPassword').fill('Clave-MOCK-V39');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
}
async function fixture(page,additional=null){
 const writes=[],lookups=[];
 await page.route('**/api/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url()),
    path=url.pathname,method=request.method();
  if(path==='/api/v1/estado')return reply(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(path==='/api/v1/sesion')return reply(route,{
    token:'header.payload.signature',token_type:'Bearer',
    usuario:{id:1,nombre:'CI',rol:'administrador',permisos:[
      'compras.gestionar','productos.gestionar','clientes.gestionar','ventas.gestionar']}
  });
  if(request.headers().authorization!=='Bearer header.payload.signature')
   return reply(route,{},401);
  if(additional&&await additional({route,request,path,url,method,lookups}))return;
  if(path==='/api/v1/recursos/proveedores'){
   if(method==='POST'){
    writes.push(request.postDataJSON());
    return reply(route,{id:98,...request.postDataJSON(),activo:true},201);
   }
   return reply(route,{data:[],total:0,last_page:1});
  }
  if(path==='/api/v1/giros-sii')return reply(route,{
   data:[{codigo:'469000',descripcion:'VENTA AL POR MAYOR NO ESPECIALIZADA',
     afecta_iva:'SI',categoria_tributaria:'1'}],last_page:1,total:1});
  if(path.startsWith('/api/v1/ubicaciones/')){
   const tipo=path.split('/').at(-1);
   return reply(route,{data:tipo==='paises'?[{id:1,nombre:'Chile',activo:true}]:[],
     last_page:1,total:tipo==='paises'?1:0});
  }
  if(path.startsWith('/api/v1/catalogos/'))return reply(route,{items:[]});
  return reply(route,{},404);
 });
 await login(page);
 return {writes,lookups};
}

test('RUT MOD11 reconoce DV correcto y errores sin aceptar valores fabricados',async({page})=>{
 await fixture(page);
 const check=await page.evaluate(()=>{
  const f=window.RutaHDRut;
  return {
   normal:f.normalizar('12.345.678-5'),
   plain:f.normalizar('123456785'),
   invalid:f.normalizar('12.345.678-0'),
   chars:f.normalizar('1234XD5'),
   blank:f.normalizar('')
  };
 });
 expect(check).toEqual({normal:'12345678-5',plain:'12345678-5',
  invalid:null,chars:null,blank:null});
});

test('proveedor: elimina campos antiguos, valida RUT y selecciona código oficial SII',async({page})=>{
 const {writes}=await fixture(page);
 await page.locator('.nav-link[data-nav="proveedores"]').click();
 await page.getByRole('button',{name:'Nuevo registro'}).click();
 const dlg=page.locator('dialog.official-editor[open]');
 await expect(dlg).toBeVisible();
 for(const removed of [
  'inicio_actividades','situacion_tributaria','correo_dte','telefono_secundario',
  'sitio_web','representante_legal','representante_rut','contacto_nombre',
  'contacto_cargo','contacto_telefono','contacto_correo',
  'direccion_detalle','codigo_postal','moneda_preferida','observaciones'
 ])await expect(dlg.locator('[name="'+removed+'"]')).toHaveCount(0);
 await dlg.locator('[name="nombre"]').fill('Nuevo proveedor');
 await dlg.locator('[name="rut"]').fill('12.345.678-0');
 await dlg.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect(dlg.locator('.hd-rut-validation')).toContainText('RUT inválido');
 expect(writes).toHaveLength(0);
 await dlg.locator('[name="rut"]').fill('12.345.678-5');
 await dlg.locator('[name="rut"]').blur();
 await dlg.getByRole('button',{name:'Buscar giro SII'}).click();
 const giro=page.locator('dialog.hd-giro-dialog[open]');
 await expect(giro).toContainText('VENTA AL POR MAYOR NO ESPECIALIZADA');
 await giro.getByRole('button',{name:'Seleccionar giro 469000'}).click();
 await expect(dlg.locator('[name="actividad_economica_codigo"]')).toHaveValue('469000');
 await dlg.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect(dlg).toBeHidden();
 expect(writes).toHaveLength(1);
 expect(writes[0]).toMatchObject({
  nombre:'Nuevo proveedor',rut:'12345678-5',actividad_economica_codigo:'469000',
  giro:'VENTA AL POR MAYOR NO ESPECIALIZADA'
 });
 expect(writes[0]).not.toHaveProperty('correo_dte');
 expect(writes[0]).not.toHaveProperty('moneda_preferida');
});

test('buscador compartido: filtros bloqueados + múltiples páginas + salida múltiple',async({page})=>{
 const found=[];
 await fixture(page,({route,path,url,method})=>{
  if(path!=='/api/v1/productos/buscador'||method!=='GET')return false;
  found.push({
    proveedor:url.searchParams.get('proveedor_id'),
    rubro:url.searchParams.get('rubro_id'),
    page:url.searchParams.get('page')
  });
  const pg=Number(url.searchParams.get('page')||1);
  const data=pg===1?[
   {id:71,sku:'SKU71',nombre:'Producto setenta y uno',
     clasificacion:{rubro_id:1},codigosVenta:['780000001']},
   {id:72,sku:'SKU72',nombre:'Producto setenta y dos',
     clasificacion:{rubro_id:1},codigosVenta:['780000002']}
  ]:[{id:73,sku:'SKU73',nombre:'Producto setenta y tres',
      clasificacion:{rubro_id:1},codigosVenta:[]}];
  return reply(route,{data,total:3,last_page:2,current_page:pg}),true;
 });
 await page.evaluate(()=>{
  window.__picked=null;
  window.RutaHDBuscadorProductos.openMultiple({
   title:'Selector de abastecimiento',
   preset:{rubro_id:1},lockedFilters:{proveedor_id:4},fields:[]
  }).then(x=>window.__picked=x);
 });
 const dlg=page.locator('dialog.hd-product-finder[open]');
 await expect(dlg).toBeVisible();
 await dlg.getByRole('checkbox',{name:'Seleccionar Producto setenta y uno'}).check();
 await dlg.getByRole('button',{name:'Siguiente ›'}).first().click();
 await dlg.getByRole('checkbox',{name:'Seleccionar Producto setenta y tres'}).check();
 await dlg.getByRole('button',{name:'Usar productos seleccionados'}).click();
 await expect(dlg).toBeHidden();
 const selected=await page.evaluate(()=>window.__picked);
 expect(selected.map(x=>x.id)).toEqual([71,73]);
 expect(found.length).toBeGreaterThanOrEqual(2);
 expect(found.every(x=>x.proveedor==='4'&&x.rubro==='1')).toBe(true);
});

test('directorio proveedores usa iconos accesibles en columna acciones',async({page})=>{
 await fixture(page,({route,path})=>{
  if(path==='/api/v1/recursos/proveedores'){
   return reply(route,{data:[{
    id:1,nombre:'Proveedor ejemplo',rut:'12345678-5',activo:true,
    correo_electronico:'contacto@example.invalid'
   }],total:1,last_page:1}),true;
  }
  return false;
 });
 await page.locator('.nav-link[data-nav="proveedores"]').click();
 const actions=page.locator('.official-table tbody .official-row-actions');
 await expect(actions.locator('button')).toHaveCount(1);
 const button=actions.locator('button');
 await expect(button).toHaveAttribute('aria-label',/Editar/);
 await expect(button.locator('svg')).toHaveCount(1);
 await expect(button).not.toContainText('Editar');
});
