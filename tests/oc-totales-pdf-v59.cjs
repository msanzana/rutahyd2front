'use strict';
// V59 · IVA, bruto y PDF OC con API SIMULADA; jamás hace POST productivo.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const tag of [
 'ordenes-compra-v55.js?v=20261123-v62',
 'ordenes-compra-v55.css?v=20261123-v59',
 'catalogos-api.js?v=20261124-v63'
])assert(html.includes(tag),'Falta versión de caché '+tag);
const api=fs.readFileSync(path.join(root,'assets/js/catalogos-api.js'),'utf8');
assert(api.includes("calculatePurchaseOrder: data=>send('/ordenes-compra/calcular','POST',data)"));

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1000},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="workspaceContent"></main>');
  const styles=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
    .map(m=>m[1].split('?')[0]).filter(x=>x.endsWith('.css'));
  for(const file of styles){
    const p=path.join(root,file);
    assert(fs.existsSync(p),'No existe '+file);
    await page.addStyleTag({path:p});
  }
  await page.evaluate(()=>{
    window.__v59={preview:[],save:[],pdf:[]};
    window.RutaHDAccesos={authenticated:()=>true,has:()=>true,isAdmin:()=>true};
    const supplier={id:9,nombre:'Proveedor de prueba',rut:'12345678-5',
      correo_electronico:'test@example.invalid'};
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[{id:1,codigo:'ACTIVA',nombre:'Activa'}]}),
      purchaseOrders:async()=>({data:[{
        id:7,numero:'OC-2026-0000007',proveedor_id:9,
        proveedor_nombre:supplier.nombre,solicitada_en:'2026-11-23',
        estado_id:1,estado_codigo:'ACTIVA',estado_nombre:'Activa',
        subtotal_neto:'2500.00',total_impuestos:'475.00',total_bruto:'2975.00'
      }],total:1,last_page:1}),
      purchaseProductCosts:async()=>({costos:[{producto_id:21,costo_unitario_neto:'1250.0000'}]}),
      orderSuppliers:async()=>({data:[supplier],total:1,last_page:1}),
      getPurchaseOrder:async()=>({
        id:7,numero:'OC-2026-0000007',proveedor_id:9,
        proveedor_nombre:supplier.nombre,estado_nombre:'Activa',estado_codigo:'ACTIVA',
        solicitada_en:'2026-11-23',
        subtotal_neto:'2500.00',total_impuestos:'475.00',total_bruto:'2975.00',
        detalles:[{producto_id:21,sku:'PROD-021',nombre:'Producto afecto',
          cantidad:'2.000',costo_unitario_neto:'1250.0000'}]
      }),
      calculatePurchaseOrder:async payload=>{
        window.__v59.preview.push(payload);
        const net=payload.detalles.reduce((sum,item)=>sum+
          Math.round(Number(item.cantidad)*Number(item.costo_unitario_neto)*100)/100,0);
        const tax=Math.round(net*0.19*100)/100;
        return {subtotal_neto:net.toFixed(2),total_impuestos:tax.toFixed(2),
          total_bruto:(net+tax).toFixed(2)};
      },
      createPurchaseOrder:async payload=>{
        window.__v59.save.push(payload);
        return {id:8,numero:'OC-2026-0000008',correo_enviado:true,
          subtotal_neto:'2500.00',total_impuestos:'475.00',total_bruto:'2975.00',
          mensaje:'Orden creada y enviada'};
      },
      updatePurchaseOrder:async()=>({id:7,total_bruto:'2975.00',
        total_impuestos:'475.00',subtotal_neto:'2500.00',mensaje:'Actualizada'}),
      purchaseOrderPdf:async id=>{
        window.__v59.pdf.push(id);
        return new Blob(['%PDF-1.4\n'.padEnd(160,'0')],{type:'application/pdf'});
      }
    };
    window.RutaHDBuscadorProductos={open:async()=>[
      {id:21,sku:'PROD-021',nombre:'Producto afecto'}]};
  });
  await page.addScriptTag({path:path.join(root,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/select-buscable-v56.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.querySelector('#workspaceContent')));
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  const modal=page.locator('dialog.hd-oc-modal--editor[open]');
  await modal.getByRole('button',{name:'Buscar proveedor'}).click();
  const lookup=page.locator('dialog.hd-oc-modal--supplier[open]');
  await lookup.getByRole('button',{name:'Seleccionar Proveedor de prueba'}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog.hd-oc-modal--editor[open] fieldset.hd-oc-details').disabled);
  await modal.getByRole('button',{name:'Buscar productos del proveedor'}).click();
  await modal.getByRole('spinbutton',{name:'Costo neto de Producto afecto'}).fill('1250.0000');
  await modal.getByRole('spinbutton',{name:'Cantidad de Producto afecto'}).fill('2.000');
  await page.waitForFunction(()=>window.__v59.preview.length>0);
  const taxes=modal.locator('.hd-oc-totals input').nth(1);
  const gross=modal.locator('.hd-oc-totals input').nth(2);
  await page.waitForFunction(()=>{
    const inputs=document.querySelectorAll('dialog.hd-oc-modal--editor[open] .hd-oc-totals input');
    return inputs.length===3&&inputs[1].value.includes('475')&&inputs[2].value.includes('2.975');
  },null,{timeout:8000});
  const values=await modal.locator('.hd-oc-totals input').evaluateAll(nodes=>nodes.map(n=>n.value));
  assert(values[0].includes('2.500'),values[0]);
  assert(values[1].includes('475'),values[1]);
  assert(values[2].includes('2.975'),values[2]);
  assert(await taxes.getAttribute('readonly')!==null);
  assert(await gross.getAttribute('readonly')!==null);
  await modal.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.waitForFunction(()=>window.__v59.save.length===1);
  const saved=await page.evaluate(()=>window.__v59.save[0]);
  assert.equal(saved.detalles[0].producto_id,21);
  assert(!Object.hasOwn(saved,'total_impuestos')&&!Object.hasOwn(saved,'total_bruto'),
    'El usuario NO debe enviar totales modificables');

  // Editar recupera el importe registrado desde la API, sin placeholders.
  await page.getByRole('button',{name:/Editar orden OC-2026-0000007/}).click();
  const editor=page.locator('dialog.hd-oc-modal--editor[open]');
  await editor.waitFor({state:'visible'});
  await page.waitForFunction(()=>{
    const n=document.querySelectorAll('dialog.hd-oc-modal--editor[open] .hd-oc-totals input');
    return n.length===3&&n[1].value.includes('475')&&n[2].value.includes('2.975');
  },null,{timeout:8000});
  const edited=await editor.locator('.hd-oc-totals input').evaluateAll(nodes=>nodes.map(n=>n.value));
  assert(edited[1].includes('475'),edited[1]);
  assert(edited[2].includes('2.975'),edited[2]);
  await editor.getByRole('button',{name:'Cerrar ventana'}).click();

  // PDF ya no puede ocupar todo el ancho de 1920 px.
  await page.getByRole('button',{name:/Ver PDF de orden OC-2026-0000007/}).click();
  const pdf=page.locator('dialog.hd-oc-modal--pdf[open]');
  await pdf.locator('iframe.hd-oc-pdf-frame').waitFor({state:'attached'});
  const bounds=await pdf.boundingBox();
  assert(bounds.width<=761&&bounds.height<=751,'PDF desktop demasiado grande '+JSON.stringify(bounds));
  assert(bounds.x>100,'PDF descentrado');
  await pdf.getByRole('button',{name:'Cerrar ventana'}).click();
  assert.equal(await page.evaluate(()=>window.__v59.pdf[0]),7);
  await page.setViewportSize({width:390,height:740});
  await page.getByRole('button',{name:/Ver PDF de orden OC-2026-0000007/}).click();
  const mobile=page.locator('dialog.hd-oc-modal--pdf[open]');
  await mobile.locator('iframe.hd-oc-pdf-frame').waitFor({state:'attached'});
  const m=await mobile.boundingBox();
  assert(m.width<=390&&m.height<=740,'PDF móvil desbordado '+JSON.stringify(m));
  await mobile.getByRole('button',{name:'Cerrar ventana'}).click();
  assert.deepEqual(errors,[]);
  console.log('V59_TOTALS_PREVIEW_OK: subtotal 2500, impuestos 475, bruto 2975; lectura y guardado.');
  console.log('V59_PDF_COMPACT_OK: ancho <=760 escritorio y adaptativo móvil.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
