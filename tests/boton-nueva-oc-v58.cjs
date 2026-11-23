'use strict';
// V58: asegurar CTA Nueva OC visible tras filtros, búsqueda y remount.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const v of ['ordenes-compra-v55.css?v=20261123-v59',
 'ordenes-compra-v55.js?v=20261123-v61'])
 assert(html.includes(v),'Falta caché V58: '+v);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="workspaceContent"></main>');
  const css=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
    .map(m=>m[1].split('?')[0]).filter(p=>p.endsWith('.css'));
  for(const sheet of css){
    const file=path.join(root,sheet);
    assert(fs.existsSync(file),'No existe CSS '+sheet);
    await page.addStyleTag({path:file});
  }
  await page.evaluate(()=>{
    window.__ocCalls=[];
    window.RutaHDAccesos={authenticated:()=>true,has:()=>true,isAdmin:()=>true};
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[
        {id:1,codigo:'ACTIVA',nombre:'Activa'},
        {id:2,codigo:'RECEPCIONADA',nombre:'Recepcionada'}]}),
      purchaseOrders:async q=>{
        window.__ocCalls.push(q);
        return {data:[],total:0,last_page:1};
      },
      orderSuppliers:async()=>({data:[],total:0,last_page:1})
    };
  });
  await page.addScriptTag({path:path.join(root,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/select-buscable-v56.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.querySelector('#workspaceContent')));
  const button=page.locator('#hd-oc-new-order');
  await button.waitFor({state:'visible'});
  const filter=page.locator('.hd-oc-module .hd-choice input[role="combobox"]');
  await filter.waitFor({state:'visible'});
  async function assertButton(width,height){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(70);
    assert.equal(await button.count(),1,'Debe existir solo un CTA nueva OC');
    assert(await button.isVisible(),'Nueva OC no visible '+width);
    const geometry=await button.evaluate(b=>{
      const r=b.getBoundingClientRect();
      const panel=b.closest('.hd-oc-module').getBoundingClientRect();
      const heading=b.closest('.panel-heading');
      return {x:r.x,y:r.y,w:r.width,h:r.height,
        panelRight:panel.right,
        inHeading:!!heading,overflow:document.documentElement.scrollWidth-innerWidth,
        display:getComputedStyle(b).display};
    });
    assert(geometry.inHeading,'CTA debe estar en el encabezado');
    assert(geometry.w>90&&geometry.h>=34,'CTA colapsado');
    assert(geometry.x>=0&&geometry.x+geometry.w<=width+1,
      'CTA fuera del viewport: '+JSON.stringify(geometry));
    assert(geometry.display!=='none','CTA oculto por CSS');
    const toolbar=page.locator('.hd-oc-toolbar');
    const t=await toolbar.boundingBox(),b=await button.boundingBox();
    assert(b.y+b.height<=t.y+1,'CTA debe estar encima de filtros');
  }
  for(const w of [1920,1440,900,700,390,320])await assertButton(w,800);
  await page.setViewportSize({width:1200,height:850});
  // El selector de estado buscable no desplaza el botón.
  await filter.click();await filter.fill('Activa');
  await page.getByRole('option',{name:'Activa',exact:true}).click();
  await page.waitForFunction(()=>window.__ocCalls.some(x=>String(x.estadoId)==='1'));
  await assertButton(1200,850);
  const search=page.locator('.hd-oc-module input[aria-label="Buscar órdenes de compra"]');
  await search.fill('OC-2026');
  await page.locator('.hd-oc-toolbar button[type="submit"]').click();
  await page.waitForFunction(()=>window.__ocCalls.some(x=>x.buscar==='OC-2026'));
  await assertButton(1200,850);
  // Comprobar interacción real del CTA y apertura correcta del editor.
  await button.click();
  const dialog=page.locator('dialog.hd-oc-modal--editor[open]');
  await dialog.waitFor({state:'visible'});
  assert(await dialog.getByRole('heading',{name:'Nueva orden de compra'}).isVisible());
  await dialog.getByRole('button',{name:'Cerrar ventana'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('dialog.hd-oc-modal--editor[open]').length===0);
  await assertButton(1200,850);
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.querySelector('#workspaceContent')));
  await page.locator('#hd-oc-new-order').waitFor({state:'visible'});
  await assertButton(1200,850);
  assert.deepEqual(errors,[],'Errores JavaScript');
  console.log('V58_NEW_OC_VISIBLE_OK: CTA único, clic funcional, filtros buscables y remount');
  console.log('V58_RESPONSIVE_OK: 1920/1440/900/700/390/320 px sin CTA fuera del viewport');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
