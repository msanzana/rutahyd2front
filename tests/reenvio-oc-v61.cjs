'use strict';
// V61: el reenvío es manual y confirmado; sin envío real ni nuevas OC.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('ordenes-compra-v55.js?v=20261123-v61'));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="workspace"></main>');
  for(const f of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
   .map(m=>m[1].split('?')[0]).filter(x=>x.endsWith('.css')))
   await page.addStyleTag({path:path.join(root,f)});
  await page.evaluate(()=>{
    window.__resends=[];window.__createCount=0;window.__fail=false;
    window.RutaHDAccesos={authenticated:()=>true,has:()=>true,isAdmin:()=>true};
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[{id:1,codigo:'ACTIVA',nombre:'Activa'}]}),
      purchaseOrders:async()=>({data:[
        {id:7,numero:'OC-2026-0000007',estado_codigo:'ACTIVA',estado_nombre:'Activa',
          subtotal_neto:'100.00',total_impuestos:'19.00',total_bruto:'119.00'},
        {id:8,numero:'OC-2026-0000008',estado_codigo:'NULA',estado_nombre:'Nula',
          subtotal_neto:'100.00',total_impuestos:'19.00',total_bruto:'119.00'}
      ],total:2,last_page:1}),
      resendPurchaseOrder:async id=>{
        window.__resends.push(id);
        if(window.__fail)throw Error('SMTP temporalmente no disponible');
        return {mensaje:'Aviso reenviado'};
      },
      createPurchaseOrder:async()=>{window.__createCount++;throw Error('No debe crear OC');}
    };
  });
  await page.addScriptTag({path:path.join(root,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/select-buscable-v56.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.getElementById('workspace')));
  const active=page.getByRole('button',{name:'Reenviar correo de orden OC-2026-0000007'});
  const nullOrder=page.getByRole('button',{name:'Reenviar correo de orden OC-2026-0000008'});
  await active.waitFor({state:'visible'});
  assert.equal(await nullOrder.isDisabled(),true,'No reenviar una OC nula');
  assert.equal(await page.evaluate(()=>window.__resends.length),0);
  await active.click();
  await page.getByRole('heading',{name:'Reenviar aviso al proveedor'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__resends.length),0,
    'La apertura del modal nunca debe enviar');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__resends.length),0);
  await active.click();
  await page.getByRole('button',{name:'Reenviar correo con PDF'}).click();
  await page.waitForFunction(()=>window.__resends.length===1);
  assert.deepEqual(await page.evaluate(()=>window.__resends),[7]);
  await page.getByText(/No confirma entrega en la bandeja/).waitFor();
  assert.equal(await page.evaluate(()=>window.__createCount),0);
  // Un fallo conserva el diálogo abierto y permite recuperación explícita.
  await page.evaluate(()=>window.__fail=true);
  await active.click();
  await page.getByRole('button',{name:'Reenviar correo con PDF'}).click();
  await page.getByText(/SMTP temporalmente no disponible/).waitFor();
  const retry=page.getByRole('button',{name:'Reenviar correo con PDF'});
  assert.equal(await retry.isEnabled(),true);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('V61_REENVIO_OK: reenviar manual activo, confirmar primero, no OC duplicada ni envío automático');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
