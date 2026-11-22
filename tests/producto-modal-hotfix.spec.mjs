import {test,expect} from '@playwright/test';
const cats=['rubros','departamentos','familias','lineas','marcas','modelos','tipos_unidad','tipos_codigos_barras','tipos_envasado','condiciones_tributarias'];
const respond=(route,value,status=200)=>route.fulfill({
  status,contentType:'application/json',body:JSON.stringify(value)
});
for(const width of [1440,820,572,390]){
  test('popup producto avanzado ancho, centrado y sin scroll horizontal '+width,async({page})=>{
    await page.setViewportSize({width,height:820});
    await page.route('**/api/v1/**',r=>{
      const path=new URL(r.request().url()).pathname;
      if(path==='/api/v1/estado')return respond(r,{servicio:'Ruta H&D2 API',estado:'disponible'});
      if(path==='/api/v1/sesion')return respond(r,{token:'aaa.bbb.ccc',token_type:'Bearer',
        usuario:{id:1,nombre:'Admin CI',rol:'administrador',permisos:['productos.gestionar']}});
      if(path.startsWith('/api/v1/catalogos/')){
        const key=path.split('/').at(-1);
        return respond(r,{items:cats.includes(key)?[{id:1,nombre:key,activo:true,parentId:null}]:[]});
      }
      if(path==='/api/v1/productos')return respond(r,{data:[],last_page:1,total:0});
      return respond(r,{},404);
    });
    await page.goto('/#inicio');
    await page.locator('#loginEmail').fill('test@example.invalid');
    await page.locator('#loginPassword').fill('clave-ci-fixture');
    await page.locator('#loginSubmit').click();
    await expect(page.locator('#loginDialog')).toBeHidden();
    if(width<1000)await page.locator('#menuToggle').click();
    await page.locator('.nav-link[data-nav="productos"]').click();
    await page.getByRole('button',{name:'Nuevo producto real'}).click();
    const dialog=page.locator('.product-editor-dialog[open]');
    await expect(dialog).toBeVisible();
    const m=await dialog.evaluate(node=>{
      const rect=node.getBoundingClientRect();
      const form=node.querySelector('form');
      return {left:rect.left,right:rect.right,width:rect.width,viewport:innerWidth,
        noScrollX:node.scrollWidth<=node.clientWidth+1,
        cols:getComputedStyle(form).gridTemplateColumns.split(' ').length};
    });
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(width+1);
    expect(m.noScrollX).toBe(true);
    if(width>=1100)expect(m.width).toBeGreaterThan(850);
    expect(m.cols).toBe(width<=680?1:2);
    await expect(dialog).not.toContainText('ID de proveedor');
    await expect(dialog).not.toContainText('Gramajes');
    await expect(dialog).toContainText('Códigos de barras de venta');
    await expect(dialog).toContainText('Presentación, precio e IVA');
  });
}
