// V45: regresiones sin credenciales, producción ni API real.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const asset=p=>path.join(root,p);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850},locale:'es-CL'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<dialog id="loginDialog" class="modal login-modal" open>
    <form id="loginForm" class="login-form" novalidate><div class="login-body">
    <label class="field"><span>Correo electrónico</span><input id="loginEmail" type="email" required></label>
    <label class="field"><span>Contraseña</span><input id="loginPassword" type="password" required></label>
    <div class="login-actions"><button type="submit">Ingresar</button></div>
    </div></form></dialog>`);
  await page.addStyleTag({path:asset('assets/css/interfaz-mix-validacion-v45.css')});
  await page.addScriptTag({path:asset('assets/js/validacion-ui.js')});
  const missing=await page.evaluate(()=>{
   const form=document.getElementById('loginForm');
   const valid=form.reportValidity();
   return {
     valid,summary:!!form.querySelector('.login-body .hd-validation-summary:not([hidden])'),
     bubble:!!form.querySelector('.field .hd-validation-bubble:not([hidden])'),
     invalid:document.getElementById('loginEmail').getAttribute('aria-invalid')
   };
  });
  assert.equal(missing.valid,false);
  assert.equal(missing.summary,true,'Resumen debe quedar dentro de login-body');
  assert.equal(missing.bubble,true,'Globo corporativo debe aparecer');
  assert.equal(missing.invalid,'true');
  await page.locator('#loginEmail').fill('usuario@ejemplo.cl');
  assert.equal(await page.locator('#loginEmail').getAttribute('aria-invalid'),null);
  assert.equal(await page.locator('#loginEmail').locator('xpath=..').locator('.hd-validation-bubble').isHidden(),true);

  await page.setContent('<main id="fixture"></main>');
  await page.addStyleTag({path:asset('assets/css/interfaz-mix-validacion-v45.css')});
  await page.evaluate(()=>{
    window.RutaHDApiCatalogos={
      list:async()=>({items:[]}),
      buscarProductos:async()=>({data:[{id:1,sku:'SKU-1',nombre:'Scotch 10 mm',
        codigosVenta:['9780201379620'],clasificacion:{}}],total:1,last_page:1})
    };
  });
  await page.addScriptTag({path:asset('assets/js/buscador-productos-v39.js')});
  await page.evaluate(()=>{
    window.__pickV45=window.RutaHDBuscadorProductos.openMultiple({
      title:'Buscar productos para 3M'
    });
  });
  await page.waitForSelector('dialog.hd-product-finder[open] .hd-lookup-check');
  const shape=await page.locator('.hd-lookup-check').evaluate(e=>({
    type:e.type,radius:getComputedStyle(e).borderRadius,
    width:Math.round(e.getBoundingClientRect().width),
    appearance:getComputedStyle(e).appearance
  }));
  assert.equal(shape.type,'checkbox');
  assert.equal(shape.radius,'7px');
  assert.equal(shape.width,24);
  assert.equal(shape.appearance,'none');
  await page.locator('.hd-lookup-checkbox').click();
  assert.equal(await page.locator('.hd-lookup-check').isChecked(),true);
  assert.match(await page.locator('.hd-product-selection').innerText(),/Scotch 10 mm/);
  await page.getByRole('button',{name:'Usar productos seleccionados'}).click();
  const selected=await page.evaluate(()=>window.__pickV45);
  assert.deepEqual(selected.map(x=>x.id),[1]);

  await page.setContent('<main id="fixture"></main>');
  await page.addStyleTag({path:asset('assets/css/interfaz-mix-validacion-v45.css')});
  await page.evaluate(()=>{
    window.RutaHDAccesos={authenticated:()=>true,isAdmin:()=>true,has:()=>true};
    window.RutaHDApiCatalogos={
      supplierMix:async()=>({data:[{id:1,nombre:'3M Chile S.A.',rut:'93626000-4',
        giro:'Fabricación de otros productos químicos',activo:1,
        cantidad_productos_mix:0}],total:1,last_page:1}),
      productSuppliers:async()=>({data:[],total:0,last_page:1})
    };
  });
  await page.addScriptTag({path:asset('assets/js/proveedores-productos.js')});
  await page.evaluate(()=>window.RutaHDProveedoresProductos.mount(document.getElementById('fixture')));
  await page.getByRole('button',{name:'Editar mix de 3M Chile S.A.'}).click();
  await page.waitForSelector('dialog.supplier-mix-dialog[open] .supplier-mix-empty');
  assert.equal(await page.locator('.supplier-mix-stat').count(),3);
  assert.equal(await page.locator('.supplier-mix-provider-block').count(),1);
  assert.match(await page.locator('.supplier-mix-empty').innerText(),/Aún no hay productos asociados/);
  assert.equal(await page.locator('.supplier-mix-footer button').innerText(),'Cerrar panel');
  const gap=await page.locator('.supplier-mix-content').evaluate(e=>getComputedStyle(e).rowGap);
  assert.notEqual(gap,'0px');

  await page.setViewportSize({width:390,height:760});
  const widths=await page.locator('.supplier-mix-dialog').evaluate(e=>({
    modal:e.getBoundingClientRect().width,viewport:innerWidth
  }));
  assert.ok(widths.modal<=widths.viewport,'Modal no debe desbordarse en móvil');
  assert.deepEqual(errors,[],'Errores JavaScript de regresión');
  console.log('V45_UI_OK login-validación, checkbox múltiple, mix vacío, métricas y móvil');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
