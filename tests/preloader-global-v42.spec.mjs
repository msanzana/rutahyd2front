import {test,expect} from '@playwright/test';

const reply=(route,data,status=200)=>route.fulfill({
  status,contentType:'application/json',body:JSON.stringify(data)
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(page,onRequest=async()=>false){
  await page.route('**/api/v1/**',async route=>{
    const r=route.request(),u=new URL(r.url()),path=u.pathname;
    if(path==='/api/v1/estado')
      return reply(route,{servicio:'Ruta H&D2 API',estado:'disponible'});
    if(path==='/api/v1/sesion'&&r.method()==='POST')
      return reply(route,{token:'header.payload.signature',token_type:'Bearer',
        usuario:{id:1,nombre:'Admin CI',rol:'administrador',
          permisos:['compras.gestionar','clientes.gestionar','productos.gestionar']}});
    if(r.headers().authorization!=='Bearer header.payload.signature')
      return reply(route,{message:'No autorizado'},401);
    if(await onRequest({route,request:r,url:u,path}))return;
    if(path==='/api/v1/recursos/proveedores')
      return reply(route,{data:[],total:0,last_page:1});
    if(path==='/api/v1/giros-sii')
      return reply(route,{data:[{codigo:'011101',descripcion:'CULTIVO DE TRIGO'}],total:1,last_page:1});
    if(path.startsWith('/api/v1/ubicaciones/'))
      return reply(route,{data:[],total:0,last_page:1});
    if(path.startsWith('/api/v1/catalogos/'))
      return reply(route,{items:[]});
    if(path==='/api/v1/perfil')
      return reply(route,{id:1,nombre:'Admin CI'});
    return reply(route,{data:[],items:[],total:0,last_page:1});
  });
  await page.goto('/#inicio');
  await page.locator('#loginEmail').fill('ci@example.invalid');
  await page.locator('#loginPassword').fill('Clave-MOCK-UI');
  await page.locator('#loginSubmit').click();
  await expect(page.locator('#loginDialog')).toBeHidden();
}
const loader=page=>page.locator('dialog.hd-loading-overlay[open]');

test('modal centrado y accesible cubre una búsqueda de giros lenta y desaparece',async({page})=>{
  await setup(page,async({route,path})=>{
    if(path==='/api/v1/giros-sii'){
      await sleep(850);
      await reply(route,{data:[{codigo:'469000',descripcion:'VENTA AL POR MAYOR'}],
        total:1,last_page:1});return true;
    }
    return false;
  });
  await page.locator('.nav-link[data-nav="proveedores"]').click();
  await page.getByRole('button',{name:'Nuevo registro'}).click();
  const editor=page.locator('dialog.official-editor[open]');
  await expect(editor).toBeVisible();
  await editor.getByRole('button',{name:'Buscar giro SII'}).click();
  await expect(page.locator('dialog.hd-giro-dialog[open]')).toBeVisible();
  await expect(loader(page)).toBeVisible();
  await expect(loader(page)).toContainText('Buscando giros SII');
  await expect(loader(page)).toHaveAttribute('aria-modal','true');
  await expect(loader(page)).toBeHidden({timeout:6000});
  await expect(page.locator('dialog.hd-giro-dialog[open]')).toContainText('VENTA AL POR MAYOR');
});

test('dos peticiones concurrentes no cierran indicador antes de completarse ambas',async({page})=>{
  await setup(page,async({route,path,url})=>{
    if(path==='/api/v1/giros-sii'){
      await sleep(url.searchParams.get('buscar')==='lento'?1150:380);
      await reply(route,{data:[],total:0,last_page:1});return true;
    }
    return false;
  });
  await page.evaluate(()=>{
    window.__v42done=0;
    const api=window.RutaHDApiCatalogos;
    void api.girosSii({buscar:'rápido'}).then(()=>window.__v42done++);
    void api.girosSii({buscar:'lento'}).then(()=>window.__v42done++);
  });
  await expect(loader(page)).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__v42done)).toBe(1);
  await expect(loader(page)).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__v42done)).toBe(2);
  await expect(loader(page)).toBeHidden();
  expect(await page.evaluate(()=>window.RutaHDCarga.isLoading())).toBe(false);
});

test('al fallar un POST libera el modal y permite seguir operando',async({page})=>{
  let failed=true;
  await setup(page,async({route,path,request})=>{
    if(path==='/api/v1/proveedores-productos/lote'&&request.method()==='POST'){
      await sleep(490);
      await reply(route,failed?{message:'Producto repetido'}:{cantidad:1},
        failed?409:201);
      failed=false;
      return true;
    }
    return false;
  });
  await page.evaluate(()=>{
    window.__v42error='';
    window.RutaHDApiCatalogos.createProductSuppliersBatch({
      proveedor_id:1,productos:[{producto_id:25}]
    }).catch(e=>window.__v42error=e.message);
  });
  await expect(loader(page)).toBeVisible();
  await expect(loader(page)).toContainText('Guardando productos seleccionados');
  await expect.poll(()=>page.evaluate(()=>window.__v42error)).not.toBe('');
  await expect(loader(page)).toBeHidden();
  await page.evaluate(()=>{
    window.__v42ok=false;
    window.RutaHDApiCatalogos.createProductSuppliersBatch({
      proveedor_id:1,productos:[{producto_id:26}]
    }).then(()=>window.__v42ok=true);
  });
  await expect.poll(()=>page.evaluate(()=>window.__v42ok)).toBe(true);
  await expect(loader(page)).toBeHidden();
});

test('peticiones rápidas no provocan parpadeo del modal',async({page})=>{
  await setup(page);
  await page.evaluate(()=>{
    window.__v42fast=false;
    window.RutaHDApiCatalogos.girosSii({buscar:'trigo'})
      .then(()=>window.__v42fast=true);
  });
  await expect.poll(()=>page.evaluate(()=>window.__v42fast)).toBe(true);
  await expect(loader(page)).toHaveCount(0);
});

test('la carga siempre termina y conserva el resultado cuando se cancela un error',async({page})=>{
  await setup(page,async({route,path})=>{
    if(path==='/api/v1/giros-sii'){
      await sleep(340);
      await reply(route,{message:'Servicio temporalmente ocupado'},503);
      return true;
    }
    return false;
  });
  await page.evaluate(()=>{
    window.__errorV42=null;
    window.RutaHDApiCatalogos.girosSii({buscar:'prueba'})
      .catch(err=>window.__errorV42=err.status);
  });
  await expect(loader(page)).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__errorV42)).toBe(503);
  await expect(loader(page)).toBeHidden();
  await expect(page.locator('.hd-loading-overlay')).not.toBeVisible();
});
