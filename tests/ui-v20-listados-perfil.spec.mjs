import {test,expect} from '@playwright/test';
const catalogs=['rubros','departamentos','familias','lineas','marcas','modelos',
 'tipos_unidad','tipos_envasado','condiciones_tributarias','tipos_codigos_barras'];
const respond=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
async function mock(page){
 let current=1,saved=null;
 const clients=[
  {id:1,codigo:'CLI-001',nombre:'Comercial Norte',rut:'11111111-1',activo:true},
  {id:2,codigo:'CLI-002',nombre:'Distribuidora Sur',rut:'22222222-2',activo:false}
 ];
 await page.route('**/api/v1/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/v1/estado')return respond(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
  if(path==='/api/v1/sesion'&&req.method()==='POST'){
   const data=req.postDataJSON();
   current=data.correo_electronico.startsWith('segundo')?2:1;
   return respond(route,{token:'header.payload.signature',token_type:'Bearer',
    usuario:{id:current,nombre:'Usuario '+current,rol:'administrador',
     permisos:['clientes.gestionar','productos.gestionar','compras.gestionar']}});
  }
  if(path==='/api/v1/sesion'&&req.method()==='DELETE')return route.fulfill({status:204,body:''});
  if(path==='/api/v1/perfil')return respond(route,{id:current,nombre:'Usuario '+current,
    correo_electronico:current===1?'primero@example.invalid':'segundo@example.invalid',
    rol:'administrador',permisos:[]});
  if(path==='/api/v1/recursos/clientes')return respond(route,{data:clients,total:2,last_page:1});
  if(path==='/api/v1/perfiles/catalogos'){
   const base=Object.fromEntries(catalogs.map(c=>[c,{ver:false,gestionar:false}]));
   return respond(route,{catalogos:Object.fromEntries(catalogs.map(c=>[c,c])),
    roles:[{id:1,nombre:'Administrador',codigo:'administrador',editable:false,
      modulos:Object.fromEntries(catalogs.map(c=>[c,{ver:true,gestionar:true}]))},
      {id:2,nombre:'Vendedor',codigo:'vendedor',editable:true,modulos:base}]});
  }
  if(path==='/api/v1/perfiles/usuarios')return respond(route,{usuarios:[]});
  if(path==='/api/v1/perfiles/2/catalogos'&&req.method()==='PUT'){
   saved=req.postDataJSON();return respond(route,{guardado:true});
  }
  if(path.startsWith('/api/v1/catalogos/'))return respond(route,{items:[]});
  if(path==='/api/v1/productos')return respond(route,{data:[{
   id:8,sku:'P-888',nombre:'Producto código QR',activo:true,
   presentacion:{precioNeto:1200,tasaIva:19}
  }],total:1,last_page:1});
  if(path==='/api/v1/productos/8')return respond(route,{id:8,sku:'P-888',nombre:'Producto código QR',activo:true,
   clasificacion:Object.fromEntries(['rubroId','departamentoId','familiaId','lineaId',
    'marcaId','modeloId','tipoUnidadId','tipoEnvasadoId','condicionTributariaId'].map(k=>[k,1])),
   presentacion:{id:1,nombre:'Unidad',precioNeto:1200,unidadesPorEnvase:1},
   codigosVenta:[],stock:0});
  return respond(route,{},404);
 });
 return {getSaved:()=>saved};
}
async function login(page,email='primero@example.invalid'){
 await page.goto('/#inicio');
 await page.locator('#loginSubmit').waitFor({state:'visible'});
 await expect(page.locator('#loginSubmit')).toBeEnabled();
 await page.locator('#loginEmail').fill(email);
 await page.locator('#loginPassword').fill('MOCK-2026');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
}
test('header user menu, logout and theme per account without server indicator',async({page})=>{
 await mock(page);await login(page);
 await expect(page.locator('#heroLogin')).toHaveCount(0);
 await expect(page.locator('#apiStatus')).toHaveCount(0);
 await expect(page.locator('#userMenuTrigger')).toBeVisible();
 await page.locator('#userMenuTrigger').click();
 await expect(page.locator('#userMenuPopup')).toBeVisible();
 await expect(page.locator('#menuProfile')).toBeVisible();
 await page.locator('#menuDarkMode').check({force:true});
 await expect(page.locator('html')).toHaveAttribute('data-theme','oscuro');
 const key='rutahyd2.apariencia.usuario.1';
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('oscuro');
 await page.locator('#menuSignOut').click();
 await expect(page.locator('#loginDialog')).toBeVisible();
 await page.locator('#loginEmail').fill('segundo@example.invalid');
 await page.locator('#loginPassword').fill('MOCK-2026');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('#loginDialog')).toBeHidden();
 await expect(page.locator('html')).toHaveAttribute('data-theme','claro');
 await page.locator('#userMenuTrigger').click();
 await page.locator('#menuSignOut').click();
 await page.locator('#loginEmail').fill('primero@example.invalid');
 await page.locator('#loginPassword').fill('MOCK-2026');
 await page.locator('#loginSubmit').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','oscuro');
});
test('listado de clientes usa iconos y búsqueda avanzada filtrada',async({page})=>{
 await mock(page);await login(page);
 await page.locator('.nav-link[data-nav="clientes"]').click();
 const listing=page.locator('.official-module');
 await expect(listing.locator('.normalized-table tbody tr')).toHaveCount(2);
 const buttons=listing.locator('tbody tr').first().locator('.list-icon-action');
 await expect(buttons.first()).toHaveAttribute('aria-label','Editar');
 expect((await buttons.first().textContent())?.trim()||'').toBe('');
 await expect(listing.getByRole('button',{name:'Búsqueda avanzada'})).toBeVisible();
 await listing.getByRole('button',{name:'Búsqueda avanzada'}).click();
 const dialog=page.locator('dialog.advanced-search-dialog[open]');
 await expect(dialog).toContainText('Filtros');
 await dialog.getByLabel('Nombre',{exact:true}).fill('Norte');
 await dialog.getByRole('button',{name:'Aplicar filtros'}).click();
 await expect(listing.locator('tbody tr').first()).toBeVisible();
 await expect(listing.locator('tbody tr').last()).toBeHidden();
 await page.locator('#globalSearch').fill('inexistente');
 await expect(listing.locator('tbody tr').first()).toBeHidden();
});
test('permisos muestran árbol con subítems editables y generales protegidos',async({page})=>{
 const state=await mock(page);await login(page);
 await page.locator('#toggleAdminSubnav').click();
 await page.locator('#navPerfiles').click();
 await page.locator('#selectorPerfil').selectOption('2');
 const tree=page.locator('#permissionTree');
 await expect(tree).toContainText('Administración');
 await expect(tree).toContainText('Proveedores productos');
 await expect(tree).toContainText('Listado de productos');
 const rubros=tree.locator('[data-modulo="rubros"]');
 await rubros.getByRole('checkbox',{name:'Ver Rubros'}).check();
 await rubros.getByRole('checkbox',{name:'Gestionar Rubros'}).check();
 await expect(tree.locator('[data-modulo="proveedores_productos"] input')).toHaveCount(0);
 await page.getByRole('button',{name:'Guardar permisos del perfil'}).click();
 await expect.poll(()=>state.getSaved()?.modulos?.rubros?.gestionar).toBe(true);
 expect(Object.keys(state.getSaved().modulos)).toHaveLength(10);
});
test('productos muestran acceso destacado a agregar códigos de barra',async({page})=>{
 await mock(page);await login(page);
 await page.locator('.nav-link[data-nav="productos"]').click();
 await expect(page.locator('.normalized-table tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Códigos de barras'}).click();
 const dlg=page.locator('dialog.product-editor-dialog[open]');
 await expect(dlg).toBeVisible();
 await expect(dlg.getByRole('button',{name:'Agregar código de barras al producto'})).toBeVisible();
 await dlg.getByRole('button',{name:'Agregar código de barras al producto'}).click();
 await expect(dlg.locator('.product-barcode-row')).toHaveCount(1);
});
