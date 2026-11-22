import {test,expect} from '@playwright/test';

/* Inspección visual de diálogos reales con respuestas API locales interceptadas.
   No toca MariaDB ni almacena credenciales reales. */
const response=(route,data,status=200)=>route.fulfill({
  status,contentType:'application/json',body:JSON.stringify(data)
});
async function fixture(page){
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/v1/estado')return response(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
    if(path==='/api/v1/sesion')return response(route,{token:'fixture.header.signature',token_type:'Bearer',
      usuario:{id:1,nombre:'Gestor de interfaz CI',rol:'administrador',
        permisos:['clientes.gestionar','productos.gestionar','compras.gestionar']}});
    if(path==='/api/v1/recursos/clientes')return response(route,{data:[{
      id:13,codigo:'CLI-13',nombre:'Cliente visual CI',rut:'11111111-1',activo:true,
      telefono:null,correo_electronico:null,direccion:null}],last_page:1,total:1});
    if(path.startsWith('/api/v1/catalogos/'))return response(route,{items:[{
      id:1,nombre:'Catálogo CI',activo:true,parentId:null}]});
    if(path==='/api/v1/productos')return response(route,{data:[],last_page:1,total:0});
    if(path==='/api/v1/proveedores-productos')return response(route,{data:[],last_page:1,total:0});
    if(path==='/api/v1/recursos/proveedores')return response(route,{data:[],last_page:1,total:0});
    if(path==='/api/v1/perfiles/catalogos')return response(route,{roles:[]});
    return response(route,{},404);
  });
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('ci@example.invalid');
  await page.locator('#loginPassword').fill('credencial-ci-falsa');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
}
async function menu(page,width,selector){
  if(width<1000)await page.locator('#menuToggle').click();
  await page.locator(selector).click();
}
const inside=async dlg=>dlg.evaluate(n=>{
  const r=n.getBoundingClientRect(),heading=n.querySelector('.crud-heading,.official-editor-heading,.product-editor-heading,.supplier-dialog-header');
  return {left:r.left,right:r.right,width:r.width,overflow:n.scrollWidth>n.clientWidth+2,
    headerBackground:heading?getComputedStyle(heading).backgroundImage:'',
    close:!!n.querySelector('.crud-close')};
});
for(const width of [1440,820,390]){
  test('CRUD de cliente estilizado y acciones a la derecha '+width,async({page})=>{
    await page.setViewportSize({width,height:850});
    await fixture(page);
    await expect(page.getByRole('button',{name:'Cerrar sesión',exact:true})).toHaveCount(1);
    await menu(page,width,'.nav-link[data-nav="clientes"]');
    const row=page.locator('.official-table tbody tr').first();
    await expect(row).toContainText('Cliente visual CI');
    const cell=await row.locator('td').last().evaluate(el=>({
      display:getComputedStyle(el).display,aligned:getComputedStyle(el).textAlign,
      last:el.cellIndex===el.parentElement.cells.length-1
    }));
    expect(cell.display).toBe('table-cell');expect(cell.aligned).toBe('right');expect(cell.last).toBe(true);
    await page.getByRole('button',{name:'Nuevo registro'}).click();
    const dlg=page.getByRole('dialog',{name:'Crear Clientes'});
    await expect(dlg).toBeVisible();
    const d=await inside(dlg);
    expect(d.left).toBeGreaterThanOrEqual(0);expect(d.right).toBeLessThanOrEqual(width+1);
    expect(d.overflow).toBe(false);expect(d.close).toBe(true);
    expect(d.headerBackground).toContain('gradient');
    await dlg.getByRole('button',{name:'Cerrar ventana'}).click();
    await expect(dlg).toBeHidden();
  });
}
test('Producto v18 conserva formulario ancho y cierre accesible',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await fixture(page);
  await menu(page,1440,'.nav-link[data-nav="productos"]');
  await page.getByRole('button',{name:'Nuevo producto real'}).click();
  const dlg=page.locator('dialog.product-editor-dialog[open]');
  await expect(dlg).toBeVisible();
  const d=await inside(dlg);
  expect(d.width).toBeGreaterThan(850);expect(d.overflow).toBe(false);
  expect(d.close).toBe(true);expect(d.headerBackground).toContain('gradient');
  await dlg.getByRole('button',{name:'Cerrar ventana'}).click();
  await expect(dlg).toBeHidden();
});
