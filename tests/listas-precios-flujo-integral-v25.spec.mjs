import {test,expect} from '@playwright/test';

const base={id:1,codigo:'BASE',nombre:'LISTA BASE',activo:true,es_base:true,observacion:'General'};
const special={id:2,codigo:'MAYOR',nombre:'Mayoristas',activo:true,es_base:false,observacion:null};
const cats={
 rubros:[{id:1,nombre:'Alimentos',activo:true}],
 departamentos:[{id:2,nombre:'Abarrotes',activo:true,parentId:1}],
 familias:[{id:3,nombre:'Conservas',activo:true,parentId:2}],
 lineas:[{id:4,nombre:'Vegetales',activo:true,parentId:3,minimoMargenPrecioVenta:'10.0000'}],
 marcas:[{id:5,nombre:'HD',activo:true}],
 modelos:[{id:6,nombre:'Tradicional',activo:true,parentId:5}],
 tipos_unidad:[{id:7,nombre:'Unidad',activo:true}],
 tipos_envasado:[{id:8,nombre:'Lata',activo:true}],
 condiciones_tributarias:[{id:9,nombre:'Exento',activo:true}],
 tipos_codigos_barras:[{id:10,nombre:'EAN-13',activo:true}]
};
const product={
 id:9,sku:'SKU-9',nombre:'Conserva HD',activo:true,costoNeto:'100',
 clasificacion:{rubroId:1,departamentoId:2,familiaId:3,lineaId:4,
  marcaId:5,modeloId:6,tipoUnidadId:7,tipoEnvasadoId:8,condicionTributariaId:9},
 presentacion:{id:12,nombre:'Unidad',unidadesPorEnvase:'1',precioNeto:'130',
  tasaIva:'0.00',activo:true},
 precios:[{listaPrecioId:1,listaNombre:'LISTA BASE',precioVenta:'130',margenPorcentaje:'30',activo:true}],
 codigosVenta:[],stock:'0',minimoMargenPrecioVenta:'10'
};
const customer={id:5,codigo:'C-5',nombre:'Distribuidora Centro',rut:'11111111-1',activo:true,
 direccion:'Temuco',correo_electronico:null,telefono:null,comuna:'Temuco',sector:null};
const send=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
async function prepare(page){
 const calls=[];
 let listChoices=[base,special],customerList=base,products=[product];
 await page.route('**/api/v1/**',route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,m=req.method();
  if(p==='/api/v1/estado')return send(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(p==='/api/v1/sesion')return send(route,{token:'header.payload.signature',token_type:'Bearer',
    usuario:{id:1,nombre:'Administradora CI',rol:'administrador',
    permisos:['productos.gestionar','clientes.gestionar','ventas.gestionar','ventas.ver']}});
  if(p.startsWith('/api/v1/catalogos/'))return send(route,{items:cats[p.split('/').at(-1)]||[]});
  if(p==='/api/v1/listas-precios'&&m==='GET')return send(route,{data:listChoices,last_page:1,total:listChoices.length});
  if(p==='/api/v1/listas-precios'&&m==='POST'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   const row={id:3,es_base:false,...dto};listChoices.push(row);return send(route,row,201);
  }
  if(p.startsWith('/api/v1/listas-precios/')&&m==='PUT'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   Object.assign(listChoices.find(l=>String(l.id)===p.split('/').at(-1)),dto);
   return send(route,listChoices.find(l=>String(l.id)===p.split('/').at(-1)));
  }
  if(p==='/api/v1/recursos/clientes'&&m==='GET')return send(route,{data:[customer],last_page:1,total:1});
  if(p==='/api/v1/clientes/5/lista-precio'&&m==='GET')
   return send(route,{cliente_id:5,lista:customerList});
  if(p==='/api/v1/recursos/clientes/5'&&m==='PUT'){
   calls.push({p,m,dto:req.postDataJSON()});return send(route,{...customer,...req.postDataJSON()});
  }
  if(p==='/api/v1/productos'&&m==='GET')return send(route,{data:products,last_page:1,total:products.length});
  if(p==='/api/v1/productos'&&m==='POST'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   const row={...product,...dto,id:10};products.push(row);return send(route,row,201);
  }
  if(p==='/api/v1/productos/9'&&m==='GET')return send(route,product);
  if(p==='/api/v1/productos/9'&&m==='PUT'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   Object.assign(product,dto);return send(route,{...product,stock:0});
  }
  if(p==='/api/v1/recursos/ventas'&&m==='GET')return send(route,{data:[],last_page:1,total:0});
  if(p==='/api/v1/ventas/precio-cliente'&&m==='GET'){
   const price=customerList.id===2?115:130;
   return send(route,{cliente_id:5,producto_id:9,lista_precio_id:customerList.id,
    lista_precio_nombre:customerList.nombre,precio_venta:price});
  }
  if(p==='/api/v1/ventas'&&m==='POST'){
   const dto=req.postDataJSON();calls.push({p,m,dto});
   return send(route,{id:83,numero_venta:'VEN-CI-83'},201);
  }
  return send(route,{},404);
 });
 await page.goto('/#inicio');
 await expect(page.locator('#loginSubmit')).toBeEnabled();
 await page.locator('#loginEmail').fill('ci@example.invalid');
 await page.locator('#loginPassword').fill('FICTICIA_NO_REAL');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 return {calls,setCustomerList:list=>{customerList=list}};
}
test('mantenedor de listas de precios crea lista especial sin alterar base',async({page})=>{
 const state=await prepare(page);
 await page.locator('#toggleProductSubnav').click();
 await page.locator('[data-nav="listas_precios"]').click();
 await expect(page.locator('#priceListsModule')).toContainText('LISTA BASE');
 await expect(page.locator('#priceListsModule')).toContainText('Mayoristas');
 await page.getByRole('button',{name:'Nueva lista de precios'}).click();
 const dialog=page.locator('dialog.price-list-dialog[open]');
 await dialog.getByText('Código',{exact:true}).locator('..').locator('input').fill('PREFERENTE');
 await dialog.getByText('Nombre',{exact:true}).locator('..').locator('input').fill('Preferente');
 await dialog.getByRole('button',{name:'Crear lista'}).click();
 await expect(dialog).toBeHidden();
 await expect(page.locator('#priceListsModule')).toContainText('Preferente');
 expect(state.calls.find(v=>v.p==='/api/v1/listas-precios'&&v.m==='POST')?.dto)
  .toMatchObject({codigo:'PREFERENTE',nombre:'Preferente',activo:true});
});
test('producto mantiene base obligatoria y calcula margen/precio sobre costo',async({page})=>{
 const state=await prepare(page);
 await page.locator('.nav-link[data-nav="productos"]').click();
 await page.locator('#productosRealesListado').getByRole('button',{name:'Editar'}).click();
 const dialog=page.locator('dialog.product-editor-dialog[open]');
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('Precios');
 await expect(dialog).not.toContainText('Presentación, precio e IVA');
 await expect(dialog).not.toContainText('Nombre de presentación');
 await expect(dialog.getByText('Mínimo margen precio venta de la línea (%)')).toBeVisible();
 await expect(dialog.locator('#productoCostoNeto')).toHaveValue('100');
 const baseRow=dialog.locator('.product-price-row').filter({hasText:'LISTA BASE'});
 await baseRow.locator('input[type=number]').nth(1).fill('40');
 await expect(baseRow.locator('input[type=number]').nth(2)).toHaveValue('140.0000');
 await dialog.getByRole('combobox',{name:'Agregar lista de precios al producto'}).selectOption('2');
 await dialog.getByRole('button',{name:'Agregar lista al producto'}).click();
 const specialRow=dialog.locator('.product-price-row').filter({hasText:'Mayoristas'});
 await specialRow.locator('input[type=number]').nth(2).fill('120');
 await expect(specialRow.locator('input[type=number]').nth(1)).toHaveValue('20.0000');
 await dialog.getByRole('button',{name:'Guardar'}).click();
 await expect(dialog).toBeHidden();
 const dto=state.calls.find(v=>v.p==='/api/v1/productos/9'&&v.m==='PUT').dto;
 expect(dto.presentacion).toMatchObject({nombre:'Unidad',precioNeto:'140.0000'});
 expect(dto.costoNeto).toBe('100');
 expect(dto.precios).toHaveLength(2);
 expect(dto.precios.find(p=>p.listaPrecioId===1)).toMatchObject({margenPorcentaje:'40'});
 expect(dto.precios.find(p=>p.listaPrecioId===2)).toMatchObject({precioVenta:'120'});
});
test('cliente elige solo una lista, y ventas muestran el precio exclusivo de esa lista',async({page})=>{
 const state=await prepare(page);
 await page.locator('.nav-link[data-nav="clientes"]').click();
 await page.getByRole('button',{name:'Editar'}).click();
 const modal=page.getByRole('dialog',{name:'Editar Clientes'});
 await expect(modal).toBeVisible();
 await modal.getByRole('combobox',{name:'Lista de precios asignada al cliente'}).selectOption('2');
 await modal.getByRole('button',{name:'Guardar cambios'}).click();
 await expect(modal).toBeHidden();
 const dto=state.calls.find(x=>x.p==='/api/v1/recursos/clientes/5'&&x.m==='PUT')?.dto;
 expect(dto.lista_precio_id).toBe(2);
 state.setCustomerList(special);
 await page.locator('.nav-link[data-nav="ventas"]').click();
 const sale=page.locator('#salePriceModule');
 await sale.getByLabel('Cliente').selectOption('5');
 await sale.getByLabel('Producto',{exact:true}).selectOption('9');
 await expect(sale.locator('.sale-effective-price')).toContainText('Mayoristas');
 await expect(sale.locator('.sale-effective-price')).toContainText('$115');
 await sale.getByLabel('Cantidad').fill('2');
 await sale.getByRole('button',{name:'Agregar producto a la venta'}).click();
 await sale.getByRole('button',{name:'Registrar venta'}).click();
 await expect(sale).toContainText('VEN-CI-83');
 const order=state.calls.find(x=>x.p==='/api/v1/ventas'&&x.m==='POST')?.dto;
 expect(order.detalles[0]).toMatchObject({producto_id:9,cantidad:2,precio_unitario:115});
});


test('switch activo violeta es compacto y el error 500 no cierra el formulario',async({page})=>{
 await prepare(page);
 await page.route('**/api/v1/listas-precios',route=>{
  if(route.request().method()==='POST')
    return send(route,{message:'Error interno del servidor'},500);
  return route.fallback();
 });
 await page.locator('#toggleProductSubnav').click();
 await page.locator('[data-nav="listas_precios"]').click();
 await page.getByRole('button',{name:'Nueva lista de precios'}).click();
 const dialog=page.locator('dialog.price-list-dialog[open]');
 const checked=dialog.getByRole('checkbox',{name:'Lista activa'});
 await expect(checked).toBeChecked();
 const style=await checked.evaluate(n=>{
  const css=getComputedStyle(n);
  return {appearance:css.appearance,width:parseFloat(css.width),
   height:parseFloat(css.height),radius:css.borderRadius,
   thumb:getComputedStyle(n,'::before').content};
 });
 expect(style.appearance).toBe('none');
 expect(style.width).toBeGreaterThanOrEqual(36);
 expect(style.width).toBeLessThanOrEqual(42);
 expect(style.height).toBeLessThanOrEqual(25);
 expect(style.radius).not.toBe('0px');
 expect(style.thumb).not.toBe('none');
 await checked.uncheck();
 await expect(checked).not.toBeChecked();
 await checked.check();
 await dialog.getByText('Código',{exact:true}).locator('..').locator('input').fill('PLATA');
 await dialog.getByText('Nombre',{exact:true}).locator('..').locator('input').fill('Lista Plata');
 await dialog.getByRole('button',{name:'Crear lista'}).click();
 await expect(dialog.locator('.form-error')).toContainText('HTTP 500');
 await expect(dialog).toBeVisible();
});

test('switch de Lista activa se renderiza compacto, violeta y sin checkbox gigante',async({page})=>{
 await prepare(page);
 await page.locator('#toggleProductSubnav').click();
 await page.locator('[data-nav="listas_precios"]').click();
 await page.getByRole('button',{name:'Nueva lista de precios'}).click();
 const dlg=page.locator('dialog.price-list-dialog[open]');
 const check=dlg.getByRole('checkbox',{name:'Lista activa'});
 await expect(check).toBeChecked();
 const appearance=await check.evaluate(node=>{
  const st=getComputedStyle(node),bar=node.getBoundingClientRect();
  return {appearance:st.appearance,width:bar.width,height:bar.height,
   radius:st.borderRadius,background:st.backgroundColor};
 });
 expect(appearance.appearance).toBe('none');
 expect(appearance.width).toBeGreaterThanOrEqual(39);
 expect(appearance.width).toBeLessThanOrEqual(45);
 expect(appearance.height).toBeLessThanOrEqual(26);
 expect(parseFloat(appearance.radius)).toBeGreaterThan(10);
 await check.uncheck();
 await expect(check).not.toBeChecked();
 await check.check();
 await expect(check).toBeChecked();
});
