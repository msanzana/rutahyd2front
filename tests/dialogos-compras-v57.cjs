'use strict';
// V57: pruebas visuales y geométricas con API simulada, sin datos ni SMTP reales.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const tag of ['ordenes-compra-v55.js?v=20261123-v61',
  'ordenes-compra-v55.css?v=20261123-v59',
  'select-buscable-v56.js?v=20261123-v56'])
  assert(html.includes(tag),'Falta versión '+tag);

async function run(){
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1920,height:950},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="workspace"></main>');
  // Aplicar hojas de estilo reales en el mismo orden de producción: esto
  // detecta cuando .modal global sobrescribe diálogos específicos.
  const hrefs=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
    .map(m=>m[1].split('?')[0]).filter(v=>v.endsWith('.css'));
  for(const href of hrefs){
    const file=path.join(root,href);
    assert(fs.existsSync(file),'Falta stylesheet '+href);
    await page.addStyleTag({path:file});
  }
  await page.evaluate(()=>{
    window.RutaHDAccesos={authenticated:()=>true,has:()=>true,isAdmin:()=>true};
    window.__queries=[];
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[{id:1,nombre:'Activa',codigo:'ACTIVA'}]}),
      purchaseOrders:async()=>({data:[
        {id:7,numero:'OC-2026-0000007',proveedor_id:9,
        proveedor_nombre:'Proveedor de muestra',estado_codigo:'ACTIVA',estado_nombre:'Activa',
        solicitada_en:'2026-11-23',subtotal_neto:'100',total_impuestos:'19',total_bruto:'119'}
      ],total:1,last_page:1}),
      orderSuppliers:async(page,term)=>{
        window.__queries.push({page,term});
        return {data:[{id:9,nombre:'Proveedor de muestra',rut:'12345678-5',
          correo_electronico:'test@example.invalid'}],total:1,last_page:1};
      },
      getPurchaseOrder:async()=>({id:7,numero:'OC-2026-0000007',
        proveedor_id:9,proveedor_nombre:'Proveedor de muestra',
        estado_nombre:'Activa',estado_codigo:'ACTIVA',
        solicitada_en:'2026-11-23',detalles:[]}),
    };
    window.RutaHDBuscadorProductos={open:async()=>[]};
  });
  await page.addScriptTag({path:path.join(root,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.querySelector('#workspace')));
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  const editor=page.locator('dialog.hd-oc-modal--editor[open]');
  assert.equal(await editor.count(),1,'Nueva OC abierta');
  const box=await editor.boundingBox();
  assert(box.width<=831&&box.height<=621,'Editor excesivo: '+JSON.stringify(box));
  const scrolling=editor.locator('.hd-oc-form-scroll');
  const initial=await scrolling.evaluate(n=>({content:n.scrollHeight,viewport:n.clientHeight}));
  assert(initial.content>0&&initial.viewport>0,'Área de formulario visible');
  const head=editor.locator('.hd-oc-modal-heading');
  const footer=editor.locator('.hd-oc-form > .hd-oc-actions');
  const h1=await head.boundingBox(),f1=await footer.boundingBox();
  await scrolling.evaluate(n=>{
    const filler=document.createElement('div');filler.style.height='1100px';
    filler.setAttribute('data-ui-test','filler');n.append(filler);
    n.scrollTop=420;
  });
  const sc=await scrolling.evaluate(n=>({top:n.scrollTop,sh:n.scrollHeight,ch:n.clientHeight}));
  const h2=await head.boundingBox(),f2=await footer.boundingBox();
  assert(sc.top>0&&sc.sh>sc.ch,'Scroll vertical interior');
  assert(Math.abs(h1.y-h2.y)<2&&Math.abs(f1.y-f2.y)<2,
    'Cabecera o acciones se desplazan fuera de la ventana');
  await scrolling.locator('[data-ui-test=filler]').evaluate(n=>n.remove());

  await editor.getByRole('button',{name:'Buscar proveedor'}).click();
  const supplier=page.locator('dialog.hd-oc-modal--supplier[open]');
  await supplier.getByText('Proveedor de muestra').waitFor();
  const r=await supplier.boundingBox();
  assert(r.width<=781&&r.width>=680,'Proveedor no tiene ancho proporcionado '+r.width);
  assert(r.height<650,'Proveedor desproporcionadamente alto '+r.height);
  assert(r.x>450&&r.x+r.width<1470,'Proveedor debe estar centrado');
  const geometry=await supplier.evaluate(d=>{
    const input=d.querySelector('.hd-oc-inline-search input');
    const button=d.querySelector('.hd-oc-inline-search button');
    const ir=input.getBoundingClientRect(),br=button.getBoundingClientRect(),
      mr=d.getBoundingClientRect(),body=d.querySelector('.hd-oc-modal-body');
    return {inputX:ir.x,inputRight:ir.right,inputW:ir.width,
      buttonX:br.x,buttonRight:br.right,buttonY:br.y,
      inputY:ir.y,modalRight:mr.right,
      bodyScroll:body.scrollWidth,bodyWidth:body.clientWidth};
  });
  assert(geometry.inputW>=350,'Buscador demasiado estrecho');
  assert(geometry.inputRight+4<=geometry.buttonX,'Input invade el botón');
  assert(geometry.buttonRight<=geometry.modalRight-8,'Botón desborda modal');
  assert(Math.abs(geometry.buttonY-geometry.inputY)<3,'Input/botón desalineados');
  assert(geometry.bodyScroll<=geometry.bodyWidth+2,'Desborde horizontal del buscador');
  await supplier.getByRole('searchbox',{name:'Buscar proveedor'}).fill('proveedor');
  await supplier.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.waitForFunction(()=>window.__queries.some(q=>q.term==='proveedor'));
  await supplier.getByRole('button',{name:/Seleccionar Proveedor de muestra/}).click();
  assert.equal(await supplier.count(),0,'Se cerró selector tras elegir proveedor');
  await page.waitForFunction(()=>[...document.querySelectorAll('dialog.hd-oc-modal--editor[open] fieldset.hd-oc-details')].some(n=>!n.disabled));
  assert.equal(await editor.locator('fieldset.hd-oc-details').evaluate(n=>n.disabled),false);

  await editor.getByRole('button',{name:'Cerrar ventana'}).click();
  await page.getByRole('button',{name:/Editar orden OC-2026-0000007/}).click();
  const edit=page.locator('dialog.hd-oc-modal--editor[open]');
  assert.equal(await edit.count(),1,'Edición abierta');
  const er=await edit.boundingBox();
  assert(er.width<=831&&er.height<=621,'Edición desproporcionada');
  await edit.getByRole('button',{name:'Cerrar ventana'}).click();
  await page.setViewportSize({width:390,height:760});
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  const mobileEditor=page.locator('dialog.hd-oc-modal--editor[open]');
  const mer=await mobileEditor.boundingBox();
  assert(mer.width<=390&&mer.height<=760,'Editor no responsive móvil');
  await mobileEditor.getByRole('button',{name:'Buscar proveedor'}).click();
  const mobileSupplier=page.locator('dialog.hd-oc-modal--supplier[open]');
  await mobileSupplier.getByText('Proveedor de muestra').waitFor();
  const ms=await mobileSupplier.boundingBox();
  assert(ms.width<=390&&ms.height<=760,'Buscador no responsive móvil');
  const overflow=await mobileSupplier.evaluate(d=>{
    const n=d.querySelector('.hd-oc-modal-body');
    const table=d.querySelector('.hd-oc-table-scroll');
    return {body:n.scrollWidth-n.clientWidth,tableScroll:table.scrollWidth-table.clientWidth};
  });
  assert(overflow.body<=2,'Modal móvil tiene overflow horizontal');
  assert(overflow.tableScroll>=0,'Tabla conserva scroll interno');
  assert.deepEqual(errors,[],'Errores JS');
  console.log('V57_MODAL_OK: crear/editar <=830x620, scroll interno y acciones fijas.');
  console.log('V57_SUPPLIER_OK: 780px, buscador alineado, tabla interna, móviles 390px.');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
