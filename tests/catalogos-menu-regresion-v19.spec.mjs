import {test,expect} from '@playwright/test';

const catalogNames={
  rubros:'Rubros',departamentos:'Departamentos',familias:'Familias',lineas:'Líneas',
  marcas:'Marcas',modelos:'Modelos',tipos_unidad:'Tipos de unidad',
  tipos_envasado:'Tipos de envasado',condiciones_tributarias:'Condición tributaria',
  tipos_codigos_barras:'Tipos de códigos de barras'
};
const respond=(route,value,code=200)=>route.fulfill({
  status:code,contentType:'application/json',body:JSON.stringify(value)
});
async function setup(page,{failBarcodes=false,delayedRubro=false,emptyCatalogs=[]}={}){
 const records=Object.fromEntries(Object.keys(catalogNames).map(k=>[k,[
  {id:1,nombre:'Inicial '+catalogNames[k],activo:true,parentId:null}
 ]]));
 let requestNames=[],writes=[];
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method();
  if(path==='/api/v1/estado')return respond(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(path==='/api/v1/sesion')return respond(route,{token:'header.payload.signature',token_type:'Bearer',
    usuario:{id:1,nombre:'Administrador CI',rol:'administrador',
      permisos:['productos.gestionar','compras.gestionar']}});
  if(path.startsWith('/api/v1/catalogos/')){
    const key=path.split('/')[4];
    if(method==='GET'){
      requestNames.push(key);
      if(delayedRubro&&key==='rubros')await new Promise(resolve=>setTimeout(resolve,450));
      if(failBarcodes&&key==='tipos_codigos_barras')return respond(route,{error:'Sin permiso'},403);
      return respond(route,{items:emptyCatalogs.includes(key)?[]:records[key]||[]});
    }
    if(method==='POST'){
      const row={id:records[key].length+10,...req.postDataJSON()};
      records[key].push(row);writes.push({key,method,row});
      return respond(route,row,201);
    }
    return respond(route,{},404);
  }
  if(path==='/api/v1/productos'&&method==='GET')return respond(route,{
    data:[{id:7,sku:'SKU-REAL-MOCK',nombre:'Producto del servidor',activo:true,
      presentacion:{precioNeto:1590,tasaIva:19}}],total:1,last_page:1
  });
  if(path.startsWith('/api/v1/recursos/'))return respond(route,{data:[],total:0,last_page:1});
  return respond(route,{},404);
 });
 await page.goto('/#inicio');
 await page.locator('#loginEmail').fill('ci@example.invalid');
 await page.locator('#loginPassword').fill('FAKE-NO-REAL');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 return {records,requestNames,writes};
}
test('ocho módulos y subítems oficiales planos y ordenados',async({page})=>{
 await setup(page);
 const items=await page.locator('.sidebar .nav .nav-link').allTextContents();
 expect(items.filter(x=>['Administración','Compras','Ventas','Proveedores','Clientes','Productos','Bodega','Cuentas corrientes'].includes(x.trim())))
  .toEqual(['Administración','Compras','Ventas','Proveedores','Clientes','Productos','Bodega','Cuentas corrientes']);
 expect((await page.locator('#adminSubnav .nav-sublink').allTextContents()).map(x=>x.trim()))
  .toEqual(['Tipos de unidad','Tipos de envasado','Condición tributaria','Tipos de códigos de barras','Usuarios','Perfiles y permisos']);
 expect((await page.locator('#productSubnav .nav-sublink').allTextContents()).map(x=>x.trim()))
  .toEqual(['Listado de productos','Rubros','Departamentos','Familias','Líneas','Marcas','Modelos']);
 expect((await page.locator('#providerSubnav .nav-sublink').allTextContents()).map(x=>x.trim()))
  .toEqual(['Listado de proveedores','Proveedores productos']);
 await page.locator('#toggleAdminSubnav').click();
 await expect(page.locator('#adminSubnav')).toBeVisible();
 await expect(page.locator('#productSubnav')).toBeHidden();
 await page.locator('#toggleProductSubnav').click();
 await expect(page.locator('#productSubnav')).toBeVisible();
 await expect(page.locator('#adminSubnav')).toBeHidden();
 await page.locator('#toggleProviderSubnav').click();
 await expect(page.locator('#providerSubnav')).toBeVisible();
 await expect(page.locator('#productSubnav')).toBeHidden();
 expect(await page.locator('.nav-depth-1,.nav-depth-2,.subnav-heading').count()).toBe(0);
});
test('Nuevo Rubro abre y guarda en API simulada incluso sin otras cargas',async({page})=>{
 const state=await setup(page);
 await page.locator('#toggleProductSubnav').click();
 await page.locator('#productSubnav [data-nav="catalogos.rubros"]').click();
 await expect(page.locator('#adminRemoto')).toContainText('Inicial Rubros');
 expect(state.requestNames.every(k=>k==='rubros')).toBe(true);
 await page.getByRole('button',{name:'Nuevo registro de Rubros'}).click();
 const dlg=page.locator('dialog.remote-catalog-dialog[open]');
 await expect(dlg).toBeVisible();
 await dlg.locator('input[required]').fill('Rubro nuevo QA');
 await dlg.getByRole('button',{name:'Guardar cambios'}).click();
 await expect(dlg).toBeHidden();
 await expect(page.locator('#adminRemoto')).toContainText('Rubro nuevo QA');
 expect(state.writes).toHaveLength(1);
 expect(state.writes[0].key).toBe('rubros');
});
test('Nuevo Departamento muestra relación con Rubro y permite abrir desde lista vacía',async({page})=>{
 await setup(page);
 await page.locator('#toggleProductSubnav').click();
 await page.locator('#productSubnav [data-nav="catalogos.departamentos"]').click();
 await expect(page.locator('#adminRemoto')).toContainText('Inicial Departamentos');
 await page.getByRole('button',{name:'Nuevo registro de Departamentos'}).click();
 const dlg=page.locator('dialog.remote-catalog-dialog[open]');
 await expect(dlg).toBeVisible();
 await expect(dlg.getByText('Pertenece a Rubros')).toBeVisible();
 await expect(dlg.locator('select[required]')).toHaveCount(1);
});
test('un fallo de código de barras no oculta el listado de productos',async({page})=>{
 await setup(page,{failBarcodes:true});
 await page.locator('.nav-link[data-nav="productos"]').click();
 await expect(page.locator('#productosRealesListado')).toContainText('SKU-REAL-MOCK');
 await page.getByRole('button',{name:'Nuevo producto real'}).click();
 const warn=page.locator('dialog.crud-dialog[open]');
 await expect(warn).toContainText('tipos_codigos_barras');
 await expect(warn.getByRole('button',{name:'Reintentar'})).toBeVisible();
});
test('cambio rápido Rubros a Marcas no deja el submódulo vacío',async({page})=>{
 await setup(page,{delayedRubro:true});
 await page.locator('#toggleProductSubnav').click();
 await page.locator('#productSubnav [data-nav="catalogos.rubros"]').click();
 await page.locator('#productSubnav [data-nav="catalogos.marcas"]').click();
 await expect(page.locator('#adminRemoto')).toContainText('Inicial Marcas');
 await expect(page.locator('#adminRemoto')).not.toContainText('Inicial Rubros');
 await page.getByRole('button',{name:'Nuevo registro de Marcas'}).click();
 await expect(page.locator('dialog.remote-catalog-dialog[open]')).toBeVisible();
});
test('catálogo vacío genuino permite crear el primer registro',async({page})=>{
 await setup(page,{emptyCatalogs:['marcas']});
 await page.locator('#toggleProductSubnav').click();
 await page.locator('#productSubnav [data-nav="catalogos.marcas"]').click();
 await expect(page.locator('#adminRemoto')).toContainText('No hay registros guardados');
 await page.getByRole('button',{name:'Nuevo registro de Marcas'}).click();
 await expect(page.locator('dialog.remote-catalog-dialog[open]')).toBeVisible();
});
