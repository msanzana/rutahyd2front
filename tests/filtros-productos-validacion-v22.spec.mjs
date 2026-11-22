import {test,expect} from '@playwright/test';

const catalogos={
 rubros:[{id:1,nombre:'Alimentos',activo:true},{id:2,nombre:'Ferretería',activo:true}],
 departamentos:[{id:11,nombre:'Abarrotes',parentId:1,activo:true},{id:12,nombre:'Herramientas',parentId:2,activo:true}],
 familias:[{id:21,nombre:'Conservas',parentId:11,activo:true},{id:22,nombre:'Taladros',parentId:12,activo:true}],
 lineas:[{id:31,nombre:'Vegetales',parentId:21,activo:true}],
 marcas:[{id:41,nombre:'Marca Norte',activo:true},{id:42,nombre:'Marca Sur',activo:true}],
 modelos:[{id:51,nombre:'Clásico',parentId:41,activo:true},{id:52,nombre:'Especial',parentId:42,activo:true}],
 tipos_unidad:[{id:61,nombre:'Unidad',activo:true}],
 tipos_envasado:[{id:71,nombre:'Lata',activo:true}],
 condiciones_tributarias:[{id:81,nombre:'Exento',activo:true},{id:82,nombre:'Afecto',activo:true}],
 tipos_codigos_barras:[{id:91,nombre:'EAN-13',activo:true}],
};
const classification={
 rubroId:1,departamentoId:11,familiaId:21,lineaId:31,marcaId:41,modeloId:51,
 tipoUnidadId:61,tipoEnvasadoId:71,condicionTributariaId:81
};
const product={
 id:14,sku:'SKU-14',nombre:'Conserva Norte',descripcion:'Verduras',
 activo:true,proveedorId:null,clasificacion:classification,
 presentacion:{id:2,nombre:'Unidad',precioNeto:1500,tasaIva:0,unidadesPorEnvase:1},codigosVenta:[],stock:0
};
const respond=(route,data,code=200)=>route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)});
async function setup(page){
 const queries=[];
 await page.route('**/api/v1/**',route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(path==='/api/v1/estado')return respond(route,{estado:'disponible',servicio:'Ruta H&D2 API'});
  if(path==='/api/v1/sesion'&&req.method()==='POST')return respond(route,{
   token:'header.payload.signature',token_type:'Bearer',
   usuario:{id:1,nombre:'Administrador QA',rol:'administrador',
    permisos:['productos.gestionar','clientes.gestionar']}
  });
  if(path.startsWith('/api/v1/catalogos/')){
   const code=path.split('/').at(-1);return respond(route,{items:catalogos[code]||[]});
  }
  if(path==='/api/v1/productos'&&req.method()==='GET'){
   const params=url.searchParams;queries.push(Object.fromEntries(params));
   let data=[product];
   if(params.get('activo')==='0'||params.get('marca_id')==='42'||params.get('familia_id')==='22')data=[];
   if(params.get('precio_min')&&Number(params.get('precio_min'))>1500)data=[];
   if(params.get('codigo_barras')&&params.get('codigo_barras')!=='7801234567890')data=[];
   return respond(route,{data,last_page:1,total:data.length,filtros_aplicados:true});
  }
  if(path==='/api/v1/productos/14')return respond(route,product);
  return respond(route,{},404);
 });
 await page.goto('/#inicio');
 await expect(page.locator('#loginSubmit')).toBeEnabled();
 await page.locator('#loginEmail').fill('qa@example.invalid');
 await page.locator('#loginPassword').fill('DEMO-NO-REAL');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 if((await page.viewportSize())?.width<900)await page.locator('#menuToggle').click();
 await page.locator('.nav-link[data-nav="productos"]').click();
 await expect(page.locator('#productosRealesListado')).toContainText('Conserva Norte');
 return queries;
}
test('filtros completos del catálogo consultan todo el servidor y persisten al paginar',async({page})=>{
 const queries=await setup(page);
 const list=page.locator('#productosReales');
 await expect(list.getByRole('button',{name:'Búsqueda avanzada'})).toHaveCount(1);
 await list.getByRole('button',{name:'Búsqueda avanzada'}).click();
 const dlg=page.locator('dialog.product-advanced-dialog[open]');
 await expect(dlg).toBeVisible();
 for(const name of ['rubro_id','departamento_id','familia_id','linea_id','marca_id','modelo_id',
   'tipo_unidad_id','tipo_envasado_id','condicion_tributaria_id','activo','codigo_barras',
   'tipo_codigo_barra_id','sku','nombre','descripcion','precio_min','precio_max','iva',
   'presentacion','unidades_min','unidades_max','proveedor_id']){
  await expect(dlg.locator('[name="'+name+'"]')).toHaveCount(1);
 }
 await dlg.locator('[name="rubro_id"]').selectOption('1');
 await expect(dlg.locator('[name="departamento_id"] option')).toHaveCount(2);
 await dlg.locator('[name="departamento_id"]').selectOption('11');
 await dlg.locator('[name="familia_id"]').selectOption('21');
 await dlg.locator('[name="marca_id"]').selectOption('41');
 await expect(dlg.locator('[name="modelo_id"] option')).toHaveCount(2);
 await dlg.locator('[name="modelo_id"]').selectOption('51');
 await dlg.locator('[name="activo"]').selectOption('1');
 await dlg.locator('[name="precio_min"]').fill('1200');
 await dlg.locator('[name="precio_max"]').fill('1800');
 await dlg.locator('[name="codigo_barras"]').fill('7801234567890');
 await dlg.locator('[name="tipo_codigo_barra_id"]').selectOption('91');
 await dlg.getByRole('button',{name:'Aplicar filtros'}).click();
 await expect(dlg).toBeHidden();
 await expect(list.locator('.hd-filter-active')).toContainText('filtros avanzados aplicados');
 await expect(list.locator('tbody tr')).toHaveCount(1);
 const last=queries.at(-1);
 for(const [key,val] of Object.entries({rubro_id:'1',departamento_id:'11',familia_id:'21',
  marca_id:'41',modelo_id:'51',activo:'1',precio_min:'1200',precio_max:'1800',
  codigo_barras:'7801234567890',tipo_codigo_barra_id:'91'})){
  expect(last[key],key).toBe(val);
 }
 await list.getByRole('button',{name:'Búsqueda avanzada'}).click();
 const again=page.locator('dialog.product-advanced-dialog[open]');
 await expect(again.locator('[name="modelo_id"]')).toHaveValue('51');
 await again.getByRole('button',{name:'Limpiar filtros'}).click();
 await expect(again).toBeHidden();
 await expect(list.locator('.hd-filter-active')).toHaveCount(0);
 expect(queries.at(-1)).not.toHaveProperty('marca_id');
});
test('rango incorrecto muestra aviso bonito y no ejecuta peticiones',async({page})=>{
 const queries=await setup(page);
 await page.locator('#productosReales').getByRole('button',{name:'Búsqueda avanzada'}).click();
 const dlg=page.locator('dialog.product-advanced-dialog[open]');
 const initial=queries.length;
 await dlg.locator('[name="precio_min"]').fill('2000');
 await dlg.locator('[name="precio_max"]').fill('1000');
 await dlg.getByRole('button',{name:'Aplicar filtros'}).click();
 await expect(dlg.locator('.hd-validation-summary')).toBeVisible();
 await expect(dlg.locator('.hd-validation-summary')).toContainText('máximo');
 await expect(dlg.locator('[name="precio_max"]')).toHaveAttribute('aria-invalid','true');
 expect(queries.length).toBe(initial);
 await dlg.locator('[name="precio_max"]').fill('3000');
 await expect(dlg.locator('.hd-validation-summary')).toBeHidden();
});
test('nuevo producto usa validación elegante sin tooltip nativo',async({page})=>{
 await setup(page);
 await page.locator('#productosReales').getByRole('button',{name:'Nuevo Producto'}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 await expect(dlg).toBeVisible();
 await dlg.getByRole('button',{name:'Guardar'}).click();
 await expect(dlg.locator('.hd-validation-summary')).toBeVisible();
 await expect(dlg.locator('.hd-validation-summary')).toContainText('obligatorio');
 await expect(dlg.locator('input[required]').first()).toHaveAttribute('aria-invalid','true');
 await dlg.locator('input[required]').first().fill('SKU-VALID');
 await expect(dlg.locator('input[required]').first()).not.toHaveAttribute('aria-invalid','true');
 await expect(dlg.locator('.hd-validation-summary')).toBeVisible();
});
test('búsqueda avanzada de producto es adaptable a 390 píxeles',async({page})=>{
 await page.setViewportSize({width:390,height:830});
 await setup(page);
 await page.locator('#productosReales').getByRole('button',{name:'Búsqueda avanzada'}).click();
 const dlg=page.locator('dialog.product-advanced-dialog[open]');
 const rect=await dlg.evaluate(element=>({left:element.getBoundingClientRect().left,
  right:element.getBoundingClientRect().right,overflow:element.scrollWidth>element.clientWidth+2}));
 expect(rect.left).toBeGreaterThanOrEqual(0);
 expect(rect.right).toBeLessThanOrEqual(391);
 expect(rect.overflow).toBe(false);
 await dlg.getByRole('button',{name:'Cerrar filtros'}).click();
 await expect(dlg).toBeHidden();
});
