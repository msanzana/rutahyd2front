// V55 · Flujo funcional de OC con API simulada. NO realiza POST productivos.
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
assert.match(html,/id="purchaseSubnav"/);
assert.match(html,/data-nav="compras_ordenes"/);
assert.match(html,/ordenes-compra-v55[.]js[?]v=20261123-v(?:55|56|57|58|59|61|62)/);
assert.match(html,/ordenes-compra-v55[.]css[?]v=20261123-v(?:55|56|57|58|59)/);

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1250,height:840},locale:'es-CL'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="workspace"></main>');
  await page.addStyleTag({path:path.join(base,'assets/css/ordenes-compra-v55.css')});
  await page.evaluate(()=>{
    window.__calls={list:[],create:[],cancel:[],productFinder:[],pdf:[]};
    window.RutaHDAccesos={
      authenticated:()=>true,has:()=>true,isAdmin:()=>true
    };
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[
        {id:1,codigo:'ACTIVA',nombre:'Activa'},
        {id:2,codigo:'RECEPCIONADA',nombre:'Recepcionada'},
        {id:3,codigo:'NULA',nombre:'Nula'}
      ]}),
      purchaseOrders:async params=>{
        window.__calls.list.push(params);
        return {data:[{id:7,numero:'OC-2026-0000007',proveedor_id:9,
          proveedor_nombre:'Proveedor de pruebas',solicitada_en:'2026-11-23',
          estado_id:1,estado_codigo:'ACTIVA',estado_nombre:'Activa',
          subtotal_neto:'100.00',total_impuestos:'19.00',total_bruto:'119.00'
        }],total:26,last_page:2};
      },
      purchaseProductCosts:async()=>({costos:[{producto_id:21,costo_unitario_neto:'987.6500'}]}),
      orderSuppliers:async()=>({data:[{id:9,nombre:'Proveedor de pruebas',
        rut:'12345678-5',correo_electronico:'test@example.invalid'}],total:1,last_page:1}),
      getPurchaseOrder:async()=>({id:7,numero:'OC-2026-0000007',proveedor_id:9,
        proveedor_nombre:'Proveedor de pruebas',estado_nombre:'Activa',estado_codigo:'ACTIVA',
        solicitada_en:'2026-11-23',detalles:[],subtotal_neto:'0.00'}),
      createPurchaseOrder:async data=>{
        window.__calls.create.push(data);
        return {id:8,numero:'OC-2026-0000008',correo_enviado:true,
          mensaje:'Orden enviada correctamente'};
      },
      updatePurchaseOrder:async()=>({mensaje:'Actualizada'}),
      cancelPurchaseOrder:async id=>{window.__calls.cancel.push(id);return {id,estado:'NULA'};},
      resendPurchaseOrder:async()=>({mensaje:'Enviado'}),
      purchaseOrderPdf:async id=>{
        window.__calls.pdf.push(id);
        return new Blob(['%PDF-1.4\n'.padEnd(130,'X')],{type:'application/pdf'});
      }
    };
    window.RutaHDBuscadorProductos={open:async params=>{
      window.__calls.productFinder.push(params);
      return [{id:21,sku:'PROD-021',nombre:'Producto proveedor'}];
    }};
  });
  await page.addScriptTag({path:path.join(base,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(base,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.querySelector('#workspace')));
  await page.getByText('OC-2026-0000007').waitFor();
  const navs=page.locator('.hd-oc-module > nav.hd-numbered-pagination');
  await page.waitForTimeout(120);
  assert.equal(await navs.count(),2,'Dos paginadores sincronizados');
  await navs.first().getByRole('button',{name:'Página 2'}).click();
  await page.waitForFunction(()=>window.__calls.list.some(q=>q.page===2));
  assert.equal((await page.evaluate(()=>window.__calls.list.at(-1))).page,2);
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  const dialog=page.locator('dialog.hd-oc-modal[open]').last();
  const details=dialog.locator('fieldset.hd-oc-details');
  assert.equal(await details.evaluate(el=>el.disabled),true,'Detalle inactivo sin proveedor');
  assert.equal(await dialog.locator('input[type="date"]').isDisabled(),true,
    'Fecha inactiva hasta seleccionar proveedor');
  await dialog.getByRole('button',{name:'Buscar proveedor'}).click();
  const provider=page.locator('dialog.hd-oc-modal[open]').last();
  await provider.getByRole('button',{name:'Seleccionar Proveedor de pruebas'}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('dialog.hd-oc-modal[open] fieldset.hd-oc-details')].some(el=>!el.disabled));
  assert.equal(await details.evaluate(el=>el.disabled),false,'Detalle se habilita con proveedor');
  assert.equal(await dialog.locator('input[type="date"]').isEnabled(),true,
    'Fecha activa tras seleccionar proveedor');
  await dialog.getByRole('button',{name:'Buscar productos del proveedor'}).click();
  const finder=await page.evaluate(()=>window.__calls.productFinder[0]);
  assert.equal(finder.proveedorId,9);
  assert.equal(finder.context,'orden_compra');
  await dialog.getByRole('spinbutton',{name:'Costo neto de Producto proveedor'}).fill('1200.0000');
  await dialog.getByRole('button',{name:'Guardar'}).click();
  await page.waitForFunction(()=>window.__calls.create.length===1);
  const saved=await page.evaluate(()=>window.__calls.create[0]);
  assert.equal(saved.proveedor_id,9);
  assert.equal(saved.detalles.length,1);
  assert.equal(saved.detalles[0].producto_id,21);
  assert.equal(saved.detalles[0].costo_unitario_neto,'1200.0000');
  assert.equal(Object.hasOwn(saved,'estado_id'),false);
  assert.equal(Object.hasOwn(saved,'presentacion_id'),false);
  const view=page.getByRole('button',{name:'Ver PDF de orden OC-2026-0000007'});
  await view.click();
  const pdf=page.locator('dialog.hd-oc-modal[open]').last();
  await pdf.locator('iframe.hd-oc-pdf-frame').waitFor();
  assert.equal(await page.evaluate(()=>window.__calls.pdf[0]),7);
  await pdf.getByRole('button',{name:'Cerrar ventana'}).click();
  assert.deepEqual(errors,[]);
  console.log('V55_FRONT_OK: dos paginadores, proveedor habilita detalle,');
  console.log('filtro entrada proveedorId=9, producto_id, estado readonly, PDF JWT modal.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
