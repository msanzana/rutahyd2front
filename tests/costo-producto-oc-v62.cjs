'use strict';
// V62: costo de compra = productos.costo_neto, nunca costo proveedor/venta.
// Las APIs están simuladas; no hay escrituras ni email en producción.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('ordenes-compra-v55.js?v=20261123-v62'));
assert(html.includes('catalogos-api.js?v=20261123-v62'));
const apiCode=fs.readFileSync(path.join(root,'assets/js/catalogos-api.js'),'utf8');
assert(apiCode.includes("purchaseProductCosts: data=>send('/ordenes-compra/costos-productos','POST',data)"));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1300,height:850},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="workspace"></main>');
  await page.addStyleTag({path:path.join(root,'assets/css/ordenes-compra-v55.css')});
  await page.evaluate(()=>{
    window.__costCalls=[];window.__saved=[];window.__mode='ok';
    window.RutaHDAccesos={authenticated:()=>true,has:()=>true,isAdmin:()=>true};
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[{id:1,codigo:'ACTIVA',nombre:'Activa'}]}),
      purchaseOrders:async()=>({data:[{id:7,numero:'OC-2026-0000007',
        estado_codigo:'ACTIVA',estado_nombre:'Activa',proveedor_id:9,
        proveedor_nombre:'Proveedor CI',subtotal_neto:'900.00',
        total_impuestos:'171.00',total_bruto:'1071.00'}],total:1,last_page:1}),
      orderSuppliers:async()=>({data:[{id:9,nombre:'Proveedor CI',
        rut:'11111111-1',correo_electronico:'ci@example.invalid'}],
        total:1,last_page:1}),
      purchaseProductCosts:async payload=>{
        window.__costCalls.push(payload);
        if(window.__mode==='fail')throw Error('Fallo al consultar costos');
        return {costos:[
          {producto_id:21,costo_unitario_neto:'1250.5000'},
          {producto_id:22,costo_unitario_neto:null}
        ]};
      },
      calculatePurchaseOrder:async payload=>{
        const net=payload.detalles.reduce((s,d)=>s+Number(d.cantidad)*Number(d.costo_unitario_neto),0);
        return {subtotal_neto:net.toFixed(2),total_impuestos:(net*.19).toFixed(2),
          total_bruto:(net*1.19).toFixed(2)};
      },
      createPurchaseOrder:async payload=>{
        window.__saved.push(payload);
        return {id:8,numero:'OC-2026-0000008',correo_enviado:true,
          subtotal_neto:'1312.50',total_impuestos:'249.38',total_bruto:'1561.88',
          mensaje:'Guardado'};
      },
      getPurchaseOrder:async()=>({id:7,numero:'OC-2026-0000007',
        estado_codigo:'ACTIVA',estado_nombre:'Activa',proveedor_id:9,
        proveedor_nombre:'Proveedor CI',solicitada_en:'2026-11-23',
        subtotal_neto:'900.00',total_impuestos:'171.00',total_bruto:'1071.00',
        detalles:[{producto_id:21,sku:'P-21',nombre:'Afecto 21',
          cantidad:'1.000',costo_unitario_neto:'900.0000'}]
      })
    };
    window.RutaHDBuscadorProductos={open:async()=>[
      {id:21,sku:'P-21',nombre:'Afecto 21',precio_venta:'5000.00'},
      {id:22,sku:'P-22',nombre:'Sin costo'}
    ]};
  });
  await page.addScriptTag({path:path.join(root,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.getElementById('workspace')));
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  let modal=page.locator('dialog.hd-oc-modal--editor[open]');
  await modal.getByRole('button',{name:'Buscar proveedor'}).click();
  await page.getByRole('button',{name:'Seleccionar Proveedor CI'}).click();
  await page.waitForFunction(()=>![...document.querySelectorAll('dialog.hd-oc-modal--editor[open] fieldset.hd-oc-details')][0].disabled);
  await modal.getByRole('button',{name:'Buscar productos del proveedor'}).click();
  await page.waitForFunction(()=>window.__costCalls.length===1);
  await modal.getByRole('spinbutton',{name:'Costo neto de Afecto 21'}).waitFor();
  assert.equal(await modal.getByRole('spinbutton',{name:'Costo neto de Afecto 21'}).inputValue(),
    '1250.5000','El costo debe obtenerse de productos.costo_neto, no de precio_venta');
  assert.equal(await modal.getByRole('spinbutton',{name:'Costo neto de Sin costo'}).inputValue(),
    '','No sustituir costo faltante por precio de venta');
  const call=await page.evaluate(()=>window.__costCalls[0]);
  assert.deepEqual(call,{proveedor_id:9,productos:[21,22]});
  await modal.getByRole('spinbutton',{name:'Costo neto de Afecto 21'}).fill('1300.0000');
  await modal.getByRole('spinbutton',{name:'Costo neto de Sin costo'}).fill('12.5000');
  await modal.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.waitForFunction(()=>window.__saved.length===1);
  const saved=await page.evaluate(()=>window.__saved[0]);
  assert.deepEqual(saved.detalles.map(x=>[x.producto_id,x.costo_unitario_neto]),
    [[21,'1300.0000'],[22,'12.5000']]);
  // Editar una OC existente conserva el costo histórico, no lo recalcula.
  await page.getByRole('button',{name:'Editar orden OC-2026-0000007'}).click();
  modal=page.locator('dialog.hd-oc-modal--editor[open]');
  await modal.getByRole('spinbutton',{name:'Costo neto de Afecto 21'}).waitFor();
  assert.equal(await modal.getByRole('spinbutton',{name:'Costo neto de Afecto 21'}).inputValue(),
    '900.0000','No sustituir costo histórico de una OC');
  assert.equal(await page.evaluate(()=>window.__costCalls.length),1);
  await modal.getByRole('button',{name:'Cerrar ventana'}).click();

  // Fallo en la consulta: no crear filas con costo inventado.
  await page.evaluate(()=>window.__mode='fail');
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  modal=page.locator('dialog.hd-oc-modal--editor[open]');
  await modal.getByRole('button',{name:'Buscar proveedor'}).click();
  await page.getByRole('button',{name:'Seleccionar Proveedor CI'}).click();
  await page.waitForFunction(()=>![...document.querySelectorAll('dialog.hd-oc-modal--editor[open] fieldset.hd-oc-details')][0].disabled);
  await modal.getByRole('button',{name:'Buscar productos del proveedor'}).click();
  await modal.getByText(/Fallo al consultar costos/).waitFor();
  assert.equal(await modal.getByRole('spinbutton',{name:'Costo neto de Afecto 21'}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('V62_COSTO_PRODUCTO_OK: autocompletar 1250.5000, editar manual, costo histórico y fallo seguro');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
