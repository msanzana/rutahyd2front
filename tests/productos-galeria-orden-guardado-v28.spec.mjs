import {test,expect} from '@playwright/test';

const png=Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlphcwAAAAASUVORK5CYII=',
 'base64');
const base={id:1,codigo:'BASE',nombre:'LISTA BASE',es_base:true,activo:true};
const cats={
 rubros:[{id:1,nombre:'Alimentos',activo:true}],
 departamentos:[{id:2,nombre:'Abarrotes',parentId:1,activo:true}],
 familias:[{id:3,nombre:'Conservas',parentId:2,activo:true}],
 lineas:[{id:4,nombre:'Vegetales',parentId:3,activo:true,minimoMargenPrecioVenta:'15.0000'}],
 marcas:[{id:5,nombre:'Marca Norte',activo:true}],
 modelos:[{id:6,nombre:'Tradicional',parentId:5,activo:true}],
 tipos_unidad:[{id:7,nombre:'Unidad',activo:true}],
 tipos_envasado:[{id:8,nombre:'Lata',activo:true}],
 condiciones_tributarias:[{id:9,codigo:'EXENTO',nombre:'Exento',activo:true}],
 tipos_codigos_barras:[{id:10,codigo:'EAN13',nombre:'EAN-13',activo:true}]
};
const product={
 id:9,sku:'SKU-9',nombre:'Conserva del Sur',activo:true,costoNeto:'100',
 clasificacion:{rubroId:1,departamentoId:2,familiaId:3,lineaId:4,
  marcaId:5,modeloId:6,tipoUnidadId:7,tipoEnvasadoId:8,condicionTributariaId:9},
 clasificacionNombres:{rubroId:'Alimentos',departamentoId:'Abarrotes',
   familiaId:'Conservas',lineaId:'Vegetales',marcaId:'Marca Norte',modeloId:'Tradicional'},
 presentacion:{id:23,nombre:'Unidad',unidadesPorEnvase:1,precioNeto:'130',tasaIva:0},
 precios:[{listaPrecioId:1,listaNombre:'LISTA BASE',precioVenta:'130',
          margenPorcentaje:'30',activo:true}],
 codigosVenta:[{tipoNombre:'EAN-13',codigoBarras:'7801234567890'}],
 stock:'0',cantidadFotos:2,galeriaDisponible:true,minimoMargenPrecioVenta:'15.0000'
};
const send=(r,obj,status=200)=>r.fulfill({
 status,contentType:'application/json',body:JSON.stringify(obj)
});
async function fixture(page,{oldPrice=false,saveReject=false}={}){
 let photos=[
  {id:30,producto_id:9,sku:'SKU-9',mime_tipo:'image/png',
    nombre_archivo:'principal.png',tamano_bytes:png.length,posicion:1},
  {id:31,producto_id:9,sku:'SKU-9',mime_tipo:'image/png',
    nombre_archivo:'posterior.png',tamano_bytes:png.length,posicion:2}
 ],calls=[],sorts=[];
 const data={...product};
 if(oldPrice){
  data.presentacion={...product.presentacion,precioNeto:'90'};
  data.precios=[{...product.precios[0],precioVenta:'90',margenPorcentaje:null}];
 }
 await page.route('**/api/v1/**',route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,m=req.method();
  if(p==='/api/v1/estado')return send(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(p==='/api/v1/sesion')return send(route,{token:'header.payload.signature',token_type:'Bearer',
    usuario:{id:1,nombre:'Administrador Pruebas',rol:'administrador',
      permisos:['productos.gestionar']}});
  if(req.headers().authorization!=='Bearer header.payload.signature')return send(route,{},401);
  if(p.startsWith('/api/v1/catalogos/'))return send(route,{items:cats[p.split('/').at(-1)]||[]});
  if(p==='/api/v1/listas-precios'&&m==='GET')return send(route,{data:[base]});
  if(p==='/api/v1/productos'&&m==='GET'){
   sorts.push({order:url.searchParams.get('orden'),direction:url.searchParams.get('direccion')});
   return send(route,{data:[data],total:1,last_page:1,filtros_aplicados:true});
  }
  if(p==='/api/v1/productos/9'&&m==='GET')return send(route,data);
  if(p==='/api/v1/productos'&&m==='POST'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   return send(route,{...dto,id:10},201);
  }
  if(p==='/api/v1/productos/9'&&m==='PUT'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   if(saveReject)return send(route,{message:'Faltan datos',
     errors:{'precios.0.margenPorcentaje':['El margen está por debajo del mínimo de la línea.']}},422);
   Object.assign(data,dto);return send(route,{...data,stock:0});
  }
  if(p==='/api/v1/productos/9/fotos'&&m==='GET')
   return send(route,{producto_id:9,sku:'SKU-9',items:photos,total:photos.length});
  if(p==='/api/v1/productos/9/fotos'&&m==='POST'){
   calls.push({p,m,mime:req.headers()['content-type'],bytes:req.postDataBuffer()?.length});
   const id=photos.length?Math.max(...photos.map(x=>x.id))+1:40;
   photos.push({id,producto_id:9,sku:'SKU-9',mime_tipo:'image/png',
     nombre_archivo:'nueva.png',tamano_bytes:png.length,posicion:photos.length+1});
   return send(route,{producto_id:9,ids:[id],cantidad:1},201);
  }
  const image=p.match(/^\/api\/v1\/productos\/9\/fotos\/(\d+)$/);
  if(image&&m==='GET')return route.fulfill({
    status:200,contentType:'image/png',body:png,
    headers:{'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}
  });
  if(image&&m==='DELETE'){
   photos=photos.filter(x=>x.id!==Number(image[1]));
   return send(route,{id:Number(image[1]),eliminada:true});
  }
  return send(route,{},404);
 });
 await page.goto('/#inicio');
 await page.locator('#loginEmail').fill('ci@example.invalid');
 await page.locator('#loginPassword').fill('PASSWORD-FICTICIA');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 if((await page.viewportSize()).width<900)await page.locator('#menuToggle').click();
 await page.locator('.nav-link[data-nav="productos"]').click();
 await expect(page.locator('#productosRealesListado')).toContainText('SKU-9');
 return {calls,sorts};
}
test('listado compacto muestra taxonomía, etiquetas redondas y orden global',async({page})=>{
 const state=await fixture(page);
 const table=page.locator('.product-index-table');
 await expect(table).toBeVisible();
 for(const label of ['SKU','Nombre','Rubro','Depto.','Familia','Línea',
   'Marca','Modelo','Precios por lista','Códigos de barras','Acciones']){
   await expect(table.locator('thead')).toContainText(label);
 }
 await expect(table.locator('tbody')).toContainText('Alimentos');
 await expect(table.locator('tbody')).toContainText('Vegetales');
 await expect(table.locator('.product-data-pill-price')).toContainText('LISTA BASE');
 await expect(table.locator('.product-data-pill-barcode')).toContainText('EAN-13');
 await table.locator('th').filter({hasText:'Rubro'}).getByRole('button').click();
 await expect.poll(()=>state.sorts.at(-1)).toEqual({order:'rubro',direction:'asc'});
 await table.locator('th').filter({hasText:'Rubro'}).getByRole('button').click();
 await expect.poll(()=>state.sorts.at(-1)).toEqual({order:'rubro',direction:'desc'});
 await table.locator('th').filter({hasText:'Precios por lista'}).getByRole('button').click();
 await expect.poll(()=>state.sorts.at(-1)).toEqual({order:'precios',direction:'asc'});
});
for(const width of [1440,390]){
 test('galería con BLOB autenticado, fotos múltiples y carga desde archivos '+width,async({page})=>{
  await page.setViewportSize({width,height:850});
  const state=await fixture(page);
  await page.locator('#productosRealesListado [data-photo-action="9"]').click();
  const modal=page.locator('dialog.product-gallery-dialog[open]');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Conserva del Sur');
  await expect(modal.locator('.product-gallery-counter')).toHaveText('1 de 2');
  await expect(modal.locator('img.product-gallery-large')).toBeVisible();
  await modal.getByRole('button',{name:'Fotografía siguiente'}).click();
  await expect(modal.locator('.product-gallery-counter')).toHaveText('2 de 2');
  const rect=await modal.evaluate(node=>{
   const r=node.getBoundingClientRect();
   return {left:r.left,right:r.right,overflow:node.scrollWidth>node.clientWidth+3};
  });
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(width+1);
  expect(rect.overflow).toBeFalsy();
  await modal.getByLabel('Examinar fotos del producto').setInputFiles({
   name:'nueva.png',mimeType:'image/png',buffer:png
  });
  await expect(modal.getByRole('button',{name:'Guardar fotos'})).toBeEnabled();
  await modal.getByRole('button',{name:'Guardar fotos'}).click();
  await expect(modal.locator('.product-gallery-counter')).toHaveText(/de 3/);
  expect(state.calls.find(c=>c.p==='/api/v1/productos/9/fotos'&&c.m==='POST')?.mime)
   .toContain('multipart/form-data');
  await modal.getByRole('button',{name:'Cerrar galería'}).click();
  await expect(modal).toBeHidden();
 });
}
test('nueva ficha empieza con margen mínimo y guarda precio calculado sin ser negativo',async({page})=>{
 const state=await fixture(page);
 await page.getByRole('button',{name:'Nuevo Producto'}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 const price=dlg.locator('.product-price-row').filter({hasText:'LISTA BASE'});
 await dlg.getByLabel('SKU / Código').fill('SKU-NUEVO-CI');
 await dlg.getByLabel('Nombre del producto').fill('Prueba tarifa inicial');
 const fields=dlg.locator('.product-editor-form > label.field select');
 const values=[1,2,3,4,5,6,7,8,9];
 for(let i=0;i<values.length;i++)await fields.nth(i).selectOption(String(values[i]));
 // Antes de elegir Línea no se puede conocer su mínimo comercial.
 await expect(price.locator('input[type=number]').nth(1)).toHaveValue('15.0000');
 await dlg.locator('#productoCostoNeto').fill('100');
 await expect(price.locator('input[type=number]').nth(2)).toHaveValue('115.0000');
 await dlg.getByRole('button',{name:'Guardar en MySQL'}).click();
 await expect(dlg).toBeHidden();
 const dto=state.calls.find(c=>c.m==='POST'&&c.p==='/api/v1/productos')?.dto;
 expect(dto).toBeDefined();
 expect(dto.costoNeto).toBe('100');
 expect(dto.precios[0].margenPorcentaje).toBe('15');
 expect(Number(dto.presentacion.precioNeto)).toBe(115);
});
test('guardado de producto muestra error de margen del backend y nunca lo oculta',async({page})=>{
 const state=await fixture(page,{saveReject:true});
 await page.locator('#productosRealesListado').getByRole('button',{name:'Editar',exact:true}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 const row=dlg.locator('.product-price-row').filter({hasText:'LISTA BASE'});
 await row.locator('input[type=number]').nth(2).fill('140');
 await dlg.getByRole('button',{name:'Guardar en MySQL'}).click();
 await page.waitForTimeout(500);
 const check=await dlg.evaluate(node=>{
   const form=node.querySelector('form');
   return {valid:form.checkValidity(),
     invalid:[...form.querySelectorAll(':invalid')].map(n=>({
       type:n.type,name:n.name,value:n.value,message:n.validationMessage
     }))};
 });
 console.log('VALIDACION_PRODUCTO',JSON.stringify(check),
   'LLAMADAS',JSON.stringify(state.calls));
 await expect(dlg.locator('.form-error')).toContainText('El margen está por debajo del mínimo');
 await expect(dlg).toBeVisible();
 expect(state.calls.find(c=>c.m==='PUT'&&c.p==='/api/v1/productos/9')).toBeDefined();
});
