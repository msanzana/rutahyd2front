'use strict';
// V56: pruebas Chromium locales, sin backend, tokens ni datos productivos.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const asset of ['select-buscable-v56.js?v=20261123-v56','select-buscable-v56.css?v=20261123-v56',
 'ordenes-compra-v55.js?v=20261123-v61','ordenes-compra-v55.css?v=20261123-v59']){
 assert(index.includes(asset),'Falta versionado '+asset);
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent([
    '<form id="form">',
    '<label>Tipo jurídico<select id="legal" required>',
    '<option value="">Seleccionar...</option><option value="N">Persona natural</option>',
    '<option value="E">Empresa</option><option value="R">Región de prueba</option></select></label>',
    '<label>Listas<select id="dynamic"><option value="">Seleccione</option></select></label>',
    '<fieldset id="disabled-field" disabled><label>Ciudad<select id="city">',
    '<option value="">Seleccione ciudad</option><option value="2">Valdivia</option>',
    '</select></label></fieldset>',
    '<label>Etiquetas<select id="multi" multiple>',
    '<option value="1">Uno</option><option value="2">Dos</option></select></label></form>',
    '<dialog id="fixture-dialog"><label>Rubro<select id="dialog-select">',
    '<option value="">Seleccione</option><option value="X">Industrial</option>',
    '</select></label></dialog><main id="workspace"></main>'
  ].join(''));
  await page.addStyleTag({path:path.join(root,'assets/css/select-buscable-v56.css')});
  await page.addScriptTag({path:path.join(root,'assets/js/select-buscable-v56.js')});
  await page.waitForFunction(()=>Boolean(window.RutaHDSelectBuscable));
  assert.equal(await page.locator('.hd-choice').count(),5);
  await page.evaluate(()=>{window.__changes=0;
    document.querySelector('#legal').addEventListener('change',()=>window.__changes++);
  });
  const input=page.locator('#legal').locator('xpath=..').locator('input[role=combobox]');
  await input.click();
  assert((await page.getByRole('option').count())>=4,'Selector abrió listado completo');
  await input.fill('regio');
  await page.getByRole('option',{name:/Región de prueba/}).click();
  assert.equal(await page.locator('#legal').inputValue(),'R');
  assert.equal(await page.evaluate(()=>window.__changes),1);
  await input.click();await input.fill('empre');
  await input.press('ArrowDown');await input.press('Enter');
  assert.equal(await page.locator('#legal').inputValue(),'E');
  await page.locator('#legal').evaluate(s=>s.value='N');
  await page.waitForFunction(()=>document.querySelector('#legal').parentElement.querySelector('input').value==='Persona natural');
  await page.locator('#dynamic').evaluate(s=>s.append(new Option('Lista especial','999')));
  const dynamic=page.locator('#dynamic').locator('xpath=..').locator('input');
  await dynamic.click();await dynamic.fill('espec');
  await page.getByRole('option',{name:'Lista especial'}).click();
  assert.equal(await page.locator('#dynamic').inputValue(),'999');
  const city=page.locator('#city').locator('xpath=..').locator('input');
  assert.equal(await city.isDisabled(),true);
  await page.locator('#disabled-field').evaluate(n=>n.disabled=false);
  await page.waitForFunction(()=>!document.querySelector('#city').parentElement.querySelector('input').disabled);
  await city.click();await city.fill('vald');
  await page.getByRole('option',{name:'Valdivia'}).click();
  assert.equal(await page.locator('#city').inputValue(),'2');
  const multi=page.locator('#multi').locator('xpath=..').locator('input');
  await multi.click();await page.getByRole('option',{name:'Uno'}).click();
  await page.getByRole('option',{name:'Dos'}).click();
  assert.deepEqual(await page.locator('#multi').evaluate(s=>[...s.selectedOptions].map(o=>o.value)),['1','2']);
  await multi.press('Escape');
  await page.locator('#fixture-dialog').evaluate(d=>d.showModal());
  const modal=page.locator('#dialog-select').locator('xpath=..').locator('input');
  await modal.click();await modal.fill('indus');
  await page.getByRole('option',{name:'Industrial'}).click();
  assert.equal(await page.locator('#dialog-select').inputValue(),'X');
  await page.locator('#fixture-dialog').evaluate(d=>d.close());
  await page.addStyleTag({path:path.join(root,'assets/css/ordenes-compra-v55.css')});
  await page.evaluate(()=>{
    window.RutaHDAccesos={authenticated:()=>true,has:()=>true,isAdmin:()=>true};
    window.RutaHDApiCatalogos={
      orderStates:async()=>({items:[]}),
      purchaseOrders:async()=>({data:[],total:0,last_page:1}),
      orderSuppliers:async()=>({data:[],total:0,last_page:1})
    };
    window.RutaHDListUI={
      action:(text,fn)=>{
        const b=document.createElement('button');b.type='button';b.textContent=text;
        b.addEventListener('click',fn);return b;},
      renderPager:()=>{}
    };
  });
  await page.addScriptTag({path:path.join(root,'assets/js/ordenes-compra-v55.js')});
  await page.evaluate(()=>window.RutaHDOrdenesCompra.mount(document.querySelector('#workspace')));
  await page.getByRole('button',{name:'Nueva orden de compra'}).click();
  const editor=page.locator('dialog.hd-oc-modal--editor[open]');
  assert.equal(await editor.count(),1);
  let rect=await editor.boundingBox();
  assert(rect.width<=881&&rect.height<=701,'Editor no compacto '+JSON.stringify(rect));
  const scroller=editor.locator('.hd-oc-form-scroll');
  await scroller.evaluate(s=>{
    const d=document.createElement('div');d.style.height='1250px';
    d.className='test-spacer';s.append(d);
  });
  const state=await scroller.evaluate(s=>{s.scrollTop=320;
    return {scroll:s.scrollTop,content:s.scrollHeight,viewport:s.clientHeight};
  });
  assert(state.scroll>0&&state.content>state.viewport,'Sin scroll interno');
  await page.setViewportSize({width:390,height:740});
  rect=await editor.boundingBox();
  assert(rect.width<=390&&rect.height<=740,'Editor no responsive');
  assert.deepEqual(errors,[]);
  console.log('V56_CHOICES_OK: escritura, acentos, navegación, eventos, select nativo, dependientes, disabled, multiple y dialog.');
  console.log('V56_OC_SCROLL_OK: compacto desktop, scroll vertical y móvil.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
