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
 costoPromedioPonderado:'74.1250',
 clasificacion:{rubroId:1,departamentoId:2,familiaId:3,lineaId:4,
  marcaId:5,modeloId:6,tipoUnidadId:7,tipoEnvasadoId:8,condicionTributariaId:9},
 clasificacionNombres:{rubroId:'Alimentos',departamentoId:'Abarrotes',
   familiaId:'Conservas',lineaId:'Vegetales',marcaId:'Marca Norte',modeloId:'Tradicional'},
 presentacion:{id:23,nombre:'Unidad',unidadesPorEnvase:1,precioNeto:'130',tasaIva:0},
 precios:[{listaPrecioId:1,listaNombre:'LISTA BASE',precioVenta:'130',
          margenPorcentaje:'30',activo:true}],
 codigosVenta:[{id:81,tipoNombre:'EAN-13',tipoCodigoBarraId:10,
   codigoBarras:'7801234567890',unidadesPorCodigo:'1',activo:true}],
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
 // Sin costo el margen no existe; al ingresar costo se aplica el mínimo de Línea.
 await expect(price.locator('input[type=number]').nth(1)).toHaveValue('');
 await expect(price.locator('input[type=number]').nth(1)).toBeDisabled();
 await dlg.locator('#productoCostoNeto').fill('100');
 await expect(price.locator('input[type=number]').nth(1)).toHaveValue('15.0000');
 await expect(price.locator('input[type=number]').nth(1)).toBeEnabled();
 await expect(price.locator('input[type=number]').nth(2)).toHaveValue('115.0000');
 await dlg.getByRole('button',{name:'Guardar'}).click();
 await expect(dlg).toBeHidden();
 const dto=state.calls.find(c=>c.m==='POST'&&c.p==='/api/v1/productos')?.dto;
 expect(dto).toBeDefined();
 expect(dto.costoNeto).toBe('100');
 expect(Number(dto.precios[0].margenPorcentaje)).toBe(15);
 expect(Number(dto.presentacion.precioNeto)).toBe(115);
});
test('guardado de producto muestra error de margen del backend y nunca lo oculta',async({page})=>{
 const state=await fixture(page,{saveReject:true});
 await page.locator('#productosRealesListado').getByRole('button',{name:'Editar',exact:true}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 const row=dlg.locator('.product-price-row').filter({hasText:'LISTA BASE'});
 await row.locator('input[type=number]').nth(2).fill('140');
 await dlg.getByRole('button',{name:'Guardar'}).click();
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


test('nuevo producto bloquea EAN-13 de doce dígitos sin enviar POST y permite corregirlo',async({page})=>{
 const state=await fixture(page);
 await page.getByRole('button',{name:'Nuevo Producto'}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 await dlg.getByLabel('SKU / Código').fill('SKU-CB-VALIDACION');
 await dlg.getByLabel('Nombre del producto').fill('Código GS1 validado');
 const fields=dlg.locator('.product-editor-form > label.field select');
 for(let i=0;i<9;i++)await fields.nth(i).selectOption(String(i+1));
 await dlg.getByRole('button',{name:'Agregar código de barras'}).click();
 const barcode=dlg.locator('.product-barcode-row').last();
 await barcode.locator('select').selectOption('10');
 await barcode.getByLabel('Código de barras',{exact:true}).fill('978020137962');
 await dlg.getByRole('button',{name:'Guardar'}).click();
 await expect(dlg.locator('.form-error')).toContainText('exactamente 13 dígitos');
 await expect(dlg).toBeVisible();
 expect(state.calls.some(x=>x.m==='POST'&&x.p==='/api/v1/productos')).toBe(false);
 await barcode.getByLabel('Código de barras',{exact:true}).fill('9780201379624');
 await dlg.getByRole('button',{name:'Guardar'}).click();
 await expect(dlg).toBeHidden();
 const dto=state.calls.find(x=>x.m==='POST'&&x.p==='/api/v1/productos')?.dto;
 expect(dto?.codigosVenta?.[0]?.codigoBarras).toBe('9780201379624');
});

test('conserva precio al dejar costo en cero y guarda margen indefinido',async({page})=>{
 const state=await fixture(page);
 await page.locator('#productosRealesListado').getByRole('button',{name:'Editar',exact:true}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 const row=dlg.locator('.product-price-row').filter({hasText:'LISTA BASE'});
 const margin=row.getByLabel('Margen porcentual LISTA BASE');
 const price=row.getByLabel('Precio de venta LISTA BASE');
 await margin.fill('30');
 await expect(price).toHaveValue('130.0000');
 await dlg.locator('#productoCostoNeto').fill('0');
 await expect(price).toHaveValue('130.0000');
 await expect(margin).toHaveValue('');
 await expect(margin).toBeDisabled();
 await dlg.getByRole('button',{name:'Guardar'}).click();
 await expect(dlg).toBeHidden();
 const dto=state.calls.find(c=>c.p==='/api/v1/productos/9'&&c.m==='PUT')?.dto;
 expect(dto).toBeDefined();
 expect(dto.costoNeto).toBe('0');
 expect(Number(dto.precios[0].precioVenta)).toBe(130);
 expect(dto.precios[0].margenPorcentaje).toBeUndefined();
});


test('ficha de consulta muestra precios por lista, márgenes y códigos de barras sin edición',async({page})=>{
 await fixture(page);
 await page.route('**/api/v1/productos/9',route=>send(route,{
  ...product,
  precios:[
   {...product.precios[0],esBase:true,costo:'100'},
   {listaPrecioId:2,listaNombre:'Mayoristas',precioVenta:'125',
    margenPorcentaje:'25',costo:'100',activo:true,esBase:false}
  ]
 }));
 await page.locator('#productosRealesListado').getByRole('button',{name:'Ver',exact:true}).click();
 const dialog=page.locator('dialog.product-detail-dialog[open]');
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Conserva del Sur'})).toBeVisible();
 await expect(dialog.locator('.product-detail-table')).toHaveCount(2);
 await expect(dialog.locator('.product-detail-table').first()).toContainText('LISTA BASE');
 await expect(dialog.locator('.product-detail-table').first()).toContainText('Mayoristas');
 await expect(dialog.locator('.product-detail-table').first()).toContainText('25.00 %');
 await expect(dialog.locator('.product-detail-barcodes')).toContainText('EAN-13');
 await expect(dialog.locator('.product-detail-barcodes')).toContainText('7801234567890');
 await expect(dialog.locator('.product-detail-content')).toContainText('Vegetales');
 await expect(dialog.locator('input')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Cerrar ficha'}).click();
 await expect(dialog).toBeHidden();
});
test('galería presenta fotos locales en zona de carga antes de subir y permite cerrar',async({page})=>{
 const state=await fixture(page);
 await page.locator('#productosRealesListado [data-photo-action="9"]').click();
 const dialog=page.locator('dialog.product-gallery-dialog[open]');
 await dialog.getByLabel('Examinar fotos del producto').setInputFiles([
  {name:'frontal.png',mimeType:'image/png',buffer:png},
  {name:'lateral.png',mimeType:'image/png',buffer:png}
 ]);
 await expect(dialog.locator('.product-gallery-drop.has-selection')).toBeVisible();
 await expect(dialog.locator('.product-gallery-pending-image')).toHaveCount(2);
 await expect(dialog.locator('.product-gallery-pending-image').first()).toBeVisible();
 await expect(dialog.locator('.product-gallery-drop')).toContainText('Todavía no están guardadas');
 expect(state.calls.some(x=>x.p==='/api/v1/productos/9/fotos'&&x.m==='POST')).toBe(false);
 await dialog.getByRole('button',{name:'Cerrar galería',exact:true}).click();
 await expect(dialog).toBeHidden();
});
test('galería limita la página de miniaturas a 25 fotografías sin perder navegación',async({page})=>{
 await fixture(page);
 const photos=Array.from({length:28},(_,i)=>({
  id:100+i,producto_id:9,sku:'SKU-9',mime_tipo:'image/png',
  nombre_archivo:'foto-'+i+'.png',tamano_bytes:png.length,posicion:i+1
 }));
 await page.route('**/api/v1/productos/9/fotos',route=>send(route,{
  producto_id:9,sku:'SKU-9',items:photos,total:28
 }));
 await page.locator('#productosRealesListado [data-photo-action="9"]').click();
 const dialog=page.locator('dialog.product-gallery-dialog[open]');
 await expect(dialog.locator('.product-gallery-thumb')).toHaveCount(25);
 await expect(dialog.locator('.product-gallery-thumb-count')).toHaveText(/Página 1 de 2/);
 await dialog.locator('.product-gallery-thumb-pages').getByRole('button',{name:'Siguiente'}).click();
 await expect(dialog.locator('.product-gallery-thumb')).toHaveCount(3);
 await dialog.locator('.product-gallery-thumb').last().click();
 await expect(dialog.locator('.product-gallery-counter')).toHaveText('28 de 28');
});


test('ficha consulta resuelve nombres de clasificación aunque GET individual entregue solo IDs',async({page})=>{
 await fixture(page);
 const older={...product};
 delete older.clasificacionNombres;
 await page.route('**/api/v1/productos/9',route=>send(route,older));
 await page.locator('#productosRealesListado').getByRole('button',{name:'Ver',exact:true}).click();
 const dialog=page.locator('dialog.product-detail-dialog[open]');
 const classification=dialog.locator('.product-detail-taxonomy');
 for(const expected of ['Alimentos','Abarrotes','Conservas','Vegetales','Marca Norte','Tradicional']){
  await expect(classification).toContainText(expected);
 }
 await expect(classification).not.toContainText('Asignado · ID 1');
 await dialog.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
});

test('switch de producto desactiva y reactiva sin botón Eliminar',async({page})=>{
 const state=await fixture(page);
 const table=page.locator('#productosRealesListado .product-index-table');
 await expect(table.getByRole('button',{name:/Eliminar|Desactivar/})).toHaveCount(0);
 const row=table.locator('tbody tr').first();
 await row.getByRole('checkbox',{name:'Desactivar Conserva del Sur'}).click();
 await page.locator('dialog.hd-status-confirm[open]').getByRole('button',{name:'Sí, desactivar'}).click();
 await expect(row.getByRole('checkbox',{name:'Activar Conserva del Sur'})).not.toBeChecked();
 await expect.poll(()=>state.calls.findLast(c=>c.p==='/api/v1/productos/9'&&c.m==='PUT')?.dto)
   .toMatchObject({activo:false});
 await row.getByRole('checkbox',{name:'Activar Conserva del Sur'}).click();
 await page.locator('dialog.hd-status-confirm[open]').getByRole('button',{name:'Sí, activar'}).click();
 await expect(row.getByRole('checkbox',{name:'Desactivar Conserva del Sur'})).toBeChecked();
 await expect.poll(()=>state.calls.findLast(c=>c.p==='/api/v1/productos/9'&&c.m==='PUT')?.dto)
   .toMatchObject({activo:true});
});
test('glóbulos de precios y códigos se apilan y tooltips salen debajo sin recorte',async({page})=>{
 await fixture(page);
 const table=page.locator('.product-index-table');
 const cell=table.locator('tbody .product-badges-cell').first();
 const positions=await cell.evaluate(node=>{
  const sample=node.querySelector('.product-data-pill');
  const copy=sample.cloneNode(true);
  node.append(copy);
  const a=sample.getBoundingClientRect(),b=copy.getBoundingClientRect();
  const layout=getComputedStyle(node.closest('table')).tableLayout;
  copy.remove();
  return {firstTop:a.top,secondTop:b.top,layout};
 });
 expect(positions.secondTop).toBeGreaterThan(positions.firstTop+5);
 expect(positions.layout).toBe('auto');
 const action=table.getByRole('button',{name:'Fotos de Conserva del Sur'});
 await action.hover();
 const tip=page.locator('body > .hd-floating-tooltip');
 await expect(tip).toBeVisible();
 await expect(tip).toContainText('Abrir galería de fotografías de Conserva del Sur');
 const locations=await page.evaluate(()=>{
  const button=document.querySelector('#productosRealesListado [data-photo-action="9"]');
  const tip=document.querySelector('body > .hd-floating-tooltip');
  return {buttonBottom:button.getBoundingClientRect().bottom,
    tipTop:tip.getBoundingClientRect().top,correctParent:tip.parentElement===document.body};
 });
 expect(locations.correctParent).toBe(true);
 expect(locations.tipTop).toBeGreaterThan(locations.buttonBottom);
});

test('ficha Producto presenta costo promedio ponderado junto al costo neto y no lo permite editar',async({page})=>{
 const state=await fixture(page);
 await page.locator('#productosRealesListado').getByRole('button',{name:'Editar',exact:true}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 const cost=dlg.locator('#productoCostoNeto');
 const average=dlg.locator('#productoCostoPromedioPonderado');
 await expect(cost).toHaveValue('100');
 await expect(average).toHaveValue('74.1250');
 await expect(average).toHaveJSProperty('readOnly',true);
 await expect(average).toHaveAttribute('aria-readonly','true');
 await expect(dlg).toContainText('Solo lectura · Se actualizará con las recepciones');
 const positions=await dlg.evaluate(()=>{
  const one=document.getElementById('productoCostoNeto').getBoundingClientRect();
  const two=document.getElementById('productoCostoPromedioPonderado').getBoundingClientRect();
  return {firstRight:one.right,secondLeft:two.left,firstTop:one.top,secondTop:two.top};
 });
 expect(positions.secondLeft).toBeGreaterThan(positions.firstRight);
 expect(Math.abs(positions.firstTop-positions.secondTop)).toBeLessThan(4);
 await dlg.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect(dlg).toBeHidden();
 const dto=state.calls.find(x=>x.m==='PUT'&&x.p==='/api/v1/productos/9')?.dto;
 expect(dto).toBeDefined();
 expect(dto.costoPromedioPonderado).toBeUndefined();
 expect(dto.costoNeto).toBe('100');
});

test('nuevo Producto muestra costo promedio inicial cero, sin enviarlo en el POST',async({page})=>{
 const state=await fixture(page);
 await page.getByRole('button',{name:'Nuevo Producto'}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 const average=dlg.locator('#productoCostoPromedioPonderado');
 await expect(average).toHaveValue('0.0000');
 await expect(average).toHaveJSProperty('readOnly',true);
 // El valor informativo no se puede modificar ni se sincroniza desde costo neto.
 await dlg.locator('#productoCostoNeto').fill('123');
 await expect(average).toHaveValue('0.0000');
 expect(state.calls.find(x=>x.m==='POST'&&x.p==='/api/v1/productos')).toBeUndefined();
});

test('consulta individual muestra promedio real devuelto por API, nunca lo recalcula con costo neto',async({page})=>{
 await fixture(page);
 await page.locator('#productosRealesListado').getByRole('button',{name:'Ver',exact:true}).click();
 const dlg=page.locator('dialog.product-detail-dialog[open]');
 await expect(dlg.getByText(/Costo promedio ponderado:/)).toBeVisible();
 await expect(dlg.getByText(/Costo promedio ponderado:/)).toContainText('74,1250');
 await expect(dlg.getByText(/Costo neto:/)).toContainText('100');
});
