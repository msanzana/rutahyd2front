import {test,expect} from '@playwright/test';

const cats={
  rubros:[{id:1,nombre:'Alimentos',activo:true,parentId:null}],
  departamentos:[{id:2,nombre:'Abarrotes',activo:true,parentId:1}],
  familias:[{id:3,nombre:'Conservas',activo:true,parentId:2}],
  lineas:[{id:4,nombre:'Vegetales',activo:true,parentId:3}],
  marcas:[{id:5,nombre:'H&D',activo:true,parentId:null}],
  modelos:[{id:6,nombre:'Tradicional',activo:true,parentId:5}],
  tipos_unidad:[{id:7,nombre:'Unidad',activo:true,parentId:null}],
  tipos_envasado:[{id:9,nombre:'Caja',activo:true,parentId:null}],
  condiciones_tributarias:[{id:10,nombre:'Afecto',activo:true,parentId:null}],
  tipos_codigos_barras:[
    {id:11,codigo:'EAN13',nombre:'EAN-13 (GTIN-13)',activo:true,parentId:null},
    {id:12,codigo:'CODE128',nombre:'Code 128',activo:true,parentId:null}
  ]
};
const reply=(route,data,code=200)=>route.fulfill({
  status:code,contentType:'application/json',body:JSON.stringify(data)
});
async function intercept(page,cb=()=>false){
  await page.route('**/api/v1/**',async route=>{
    const r=route.request(),url=new URL(r.url()),path=url.pathname;
    if(path==='/api/v1/estado')return reply(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
    if(path==='/api/v1/sesion')return reply(route,{token:'header.payload.signature',token_type:'Bearer',
      usuario:{id:1,nombre:'Administrador CI',rol:'administrador',
        permisos:['productos.gestionar','compras.gestionar','usuarios.gestionar']}});
    if(r.headers().authorization!=='Bearer header.payload.signature')return reply(route,{},401);
    if(await cb({route,r,path,url}))return;
    if(path.startsWith('/api/v1/catalogos/')){
      const name=path.split('/').at(-1);
      return reply(route,{items:cats[name]||[]});
    }
    if(path==='/api/v1/productos'&&r.method()==='GET')
      return reply(route,{data:[],last_page:1,total:0});
    if(path==='/api/v1/productos/buscador'&&r.method()==='GET')
      return reply(route,{data:[{id:50,sku:'SKU-CI-V2',nombre:'Artículo local',activo:true,
        clasificacion:{rubro_id:1,marca_id:5},codigosVenta:[]}],last_page:1,total:1});
    if(path==='/api/v1/recursos/proveedores'&&r.method()==='GET')
      return reply(route,{data:[{id:16,nombre:'Proveedor principal',rut:'12345678-5'}],
        total:1,last_page:1});
    if(path==='/api/v1/proveedores/mix'&&r.method()==='GET')
      return reply(route,{data:[{id:16,nombre:'Proveedor principal',rut:'12345678-5',
        activo:true,cantidad_productos_mix:0}],last_page:1,total:1});
    if(path==='/api/v1/proveedores-productos'&&r.method()==='GET')
      return reply(route,{data:[],last_page:1,total:0});
    return reply(route,{},404);
  });
}
async function login(page){
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('ci@example.invalid');
  await page.locator('#loginPassword').fill('Passw0rd-Fixture-2026');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
}

test('menús administrativos exactos y submenús de proveedores',async({page})=>{
  await intercept(page);
  await login(page);
  await page.locator('#toggleAdminSubnav').click();
  const admin=await page.locator('#adminSubnav .nav-sublink').allTextContents();
  expect(admin.map(x=>x.trim())).toEqual([
    'Tipos de unidad','Tipos de envasado','Condición tributaria',
    'Tipos de códigos de barras','Ubicaciones','Países','Regiones',
    'Provincias','Comunas','Ciudades','Usuarios','Perfiles y permisos'
  ]);
  await expect(page.locator('#ubicacionesSubnav')).toBeHidden();
  await page.locator('#toggleUbicacionesSubnav').click();
  await expect(page.locator('#ubicacionesSubnav')).toBeVisible();
  await expect(page.locator('#ubicacionesSubnav [data-nav]')).toHaveCount(5);
  await page.locator('#toggleProviderSubnav').click();
  await expect(page.locator('#providerSubnav [data-nav="proveedores"]')).toBeVisible();
  await expect(page.locator('#providerSubnav [data-nav="proveedores_productos"]')).toBeVisible();
  await expect(page.locator('#productSubnav')).toBeHidden();
  const productNames=await page.locator('#productSubnav .nav-sublink').allTextContents();
  expect(productNames.map(x=>x.trim())).toEqual([
    'Listado de productos','Listas de precios','Rubros','Departamentos','Familias','Líneas','Marcas','Modelos'
  ]);
  expect(page.locator('text=Gramajes')).toHaveCount(0);
});

for(const width of [1440,820,390]){
 test('formulario producto profesional sin scroll lateral '+width,async({page})=>{
  await page.setViewportSize({width,height:900});
  await intercept(page);
  await login(page);
  if(width<1000)await page.locator('#menuToggle').click();
  await page.locator('.nav-link[data-nav="productos"]').click();
  await page.getByRole('button',{name:'Nuevo Producto'}).click();
  const dlg=page.locator('dialog.product-editor-dialog[open]');
  await expect(dlg).toBeVisible();
  const dimensions=await dlg.evaluate(node=>{
    const rect=node.getBoundingClientRect(),form=node.querySelector('.product-editor-form');
    return {left:rect.left,right:rect.right,viewport:innerWidth,
      width:rect.width,scroll:node.scrollWidth,client:node.clientWidth,
      cols:getComputedStyle(form).gridTemplateColumns.split(' ').length,
      h2:!!form.querySelector('.product-editor-heading h2')};
  });
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(width+1);
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+2);
  if(width>=1100)expect(dimensions.width).toBeGreaterThan(850);
  expect(dimensions.cols).toBe(width<=680?1:2);
  expect(dimensions.h2).toBe(true);
  await expect(dlg).not.toContainText('ID de proveedor');
  await expect(dlg).not.toContainText('Gramajes');
  await expect(dlg).toContainText('Códigos de barras de venta');
  expect(await dlg.locator('select').count()).toBe(10);
 });
}

test('nuevo producto envía códigos de venta sin proveedor ni gramajes',async({page})=>{
  let created=null;let list=[];
  await intercept(page,async({route,r,path})=>{
    if(path==='/api/v1/productos'&&r.method()==='POST'){
      created=r.postDataJSON();
      list=[{id:21,...created,activo:true,presentacion:{
        id:22,nombre:'Unidad',codigoBarras:null,
        precioNeto:created.presentacion.precioNeto,tasaIva:'19.00'}}];
      return reply(route,{...list[0],codigosVenta:created.codigosVenta},201),true;
    }
    if(path==='/api/v1/productos'&&r.method()==='GET')
      return reply(route,{data:list,last_page:1,total:list.length}),true;
    return false;
  });
  await login(page);
  await page.locator('.nav-link[data-nav="productos"]').click();
  await page.getByRole('button',{name:'Nuevo Producto'}).click();
  const dlg=page.locator('dialog.product-editor-dialog[open]');
  await dlg.getByLabel('SKU / Código').fill('SKU-CI-V2');
  await dlg.getByLabel('Nombre del producto').fill('Producto con códigos');
  const selects=dlg.locator('.product-editor-form > label.field select');
  expect(await selects.count()).toBe(9);
  const order=['rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','tipos_envasado','condiciones_tributarias'];
  for(let i=0;i<order.length;i++)await selects.nth(i).selectOption(String(cats[order[i]][0].id));
  await dlg.getByRole('button',{name:'Agregar código de barras al producto'}).click();
  const barcode=dlg.locator('.product-barcode-row');
  await barcode.getByLabel('Tipo de código de barras').selectOption('11');
  await barcode.getByLabel('Código de barras',{exact:true}).fill('7801234567890');
  await barcode.getByLabel('Unidades por código').fill('12');
  await dlg.getByRole('button',{name:'Guardar'}).click();
  await expect(dlg).toBeHidden();
  expect(created).not.toBe(null);
  expect(created.proveedorId).toBeUndefined();
  expect(created.clasificacion.gramajeId).toBeUndefined();
  expect(Object.keys(created.clasificacion)).toHaveLength(9);
  expect(created.codigosVenta).toHaveLength(1);
  expect(created.codigosVenta[0]).toMatchObject({
    tipoCodigoBarraId:11,codigoBarras:'7801234567890',unidadesPorCodigo:'12'
  });
});

test('mix lista proveedores y permite asociar un producto con código de compra',async({page})=>{
  let rows=[],saved=null,barcode=null;
  await intercept(page,async({route,r,path})=>{
    if(path==='/api/v1/proveedores/mix'&&r.method()==='GET'){
      return reply(route,{data:[{
        id:16,nombre:'Proveedor principal',rut:'12345678-5',giro:'Mayorista',
        activo:true,cantidad_productos_mix:rows.length
      }],total:1,last_page:1}),true;
    }
    if(path==='/api/v1/proveedores-productos'&&r.method()==='POST'){
      saved=r.postDataJSON();
      rows=[{...saved,id:100,producto:'Artículo local',codigo_producto:'SKU-CI-V2',
        proveedor:'Proveedor principal',activo:1,costo_proveedor:'1099.0000'}];
      return reply(route,{id:100,...saved},201),true;
    }
    if(path==='/api/v1/proveedores-productos'&&r.method()==='GET')
      return reply(route,{data:rows,total:rows.length,last_page:1}),true;
    if(path==='/api/v1/proveedores-productos/100/codigos-compra'&&r.method()==='GET')
      return reply(route,{items:barcode?[{id:500,tipo_nombre:'EAN-13',
        codigo_barras:barcode.codigo_barras,unidades_por_codigo:barcode.unidades_por_codigo,
        tipo_codigo_barra_id:barcode.tipo_codigo_barra_id,activo:true}]:[]}),true;
    if(path==='/api/v1/proveedores-productos/100/codigos-compra'&&r.method()==='POST'){
      barcode=r.postDataJSON();
      return reply(route,{id:500,...barcode},201),true;
    }
    if(path==='/api/v1/productos'&&r.method()==='GET')
      return reply(route,{data:[{id:50,sku:'SKU-CI-V2',nombre:'Artículo local'}],last_page:1,total:1}),true;
    return false;
  });
  await login(page);
  await page.locator('#toggleProviderSubnav').click();
  await page.locator('#providerSubnav [data-nav="proveedores_productos"]').click();
  const main=page.locator('.supplier-products-module');
  await expect(main).toBeVisible();
  await expect(main.locator('thead')).toContainText('Productos en mix');
  await expect(main.locator('tbody')).toContainText('Proveedor principal');
  await main.locator('.supplier-row-actions button').first().click();
  const panel=page.locator('dialog.supplier-mix-dialog[open]');
  await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:'Añadir producto al mix'}).click();
  const relation=page.locator('dialog.supplier-product-dialog:not(.supplier-mix-dialog)[open]');
  await relation.getByLabel('Producto del catálogo *').selectOption('50');
  await relation.getByLabel('Código de producto según proveedor').fill('P-CI-50');
  await relation.getByLabel('Costo neto acordado (CLP)').fill('1099');
  await relation.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(relation).toBeHidden();
  await expect(panel).toContainText('Artículo local');
  expect(saved).toMatchObject({producto_id:50,proveedor_id:16,codigo_proveedor_producto:'P-CI-50'});
  await panel.getByRole('button',{name:'Códigos de compra de Artículo local'}).click();
  const codes=page.locator('dialog.supplier-product-dialog[open]').last();
  await codes.getByRole('button',{name:'Añadir código de barras de compra'}).click();
  const form=codes.locator('form.supplier-barcode-form');
  await form.getByLabel('Tipo').selectOption('11');
  await form.getByLabel('Código de compra').fill('7801234567890');
  await form.getByLabel('Unidades por este código').fill('12');
  await form.getByRole('button',{name:'Añadir código'}).click();
  await expect(codes).toContainText('7801234567890');
  expect(barcode).toMatchObject({tipo_codigo_barra_id:11,codigo_barras:'7801234567890',unidades_por_codigo:'12'});
});
