'use strict';
// V63 - CRUD Documentos: DOM/Playwright con APIs simuladas; no SQL ni DTE real.
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const tag of ['tipos-documentos-v63.js?v=20261124-v63',
 'tipos-documentos-v63.css?v=20261124-v63','catalogos-api.js?v=20261124-v63'])
 assert(html.includes(tag),'Recurso V63 faltante: '+tag);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:900},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<section id="workspaceContent"></section>');
  await page.addStyleTag({path:path.join(root,'assets/css/tipos-documentos-v63.css')});
  await page.evaluate(()=>{
   window.__docTest={list:[],updates:[],created:[],states:[]};
   const seed=[
    {id:1,codigo:'FACTURA_ELECTRONICA',codigo_sii:33,nombre:'Factura electrónica',
     familia:'FACTURA',documento_venta:1,documento_compra:1,disponible_pos:1,
     documento_electronico:1,dias_vencimiento:0,activo:1,orden:10},
    {id:9,codigo:'ORDEN_COMPRA',codigo_sii:null,nombre:'Orden de Compra',
     familia:'INTERNO',documento_venta:0,documento_compra:0,disponible_pos:0,
     documento_electronico:0,dias_vencimiento:0,activo:1,orden:90}
   ];
   window.RutaHDAccesos={isAdmin:()=>true,has:()=>true};
   window.RutaHDApiCatalogos={
    documentTypes:async params=>{
     window.__docTest.list.push(params);
     return {data:seed.filter(x=>!params.buscar||x.nombre.toLowerCase().includes(params.buscar.toLowerCase())),
      total:2,last_page:1,current_page:1};
    },
    updateDocumentType:async(id,data)=>{
     window.__docTest.updates.push({id,data});
     const original=seed.find(x=>x.id===id);
     Object.assign(original,data);
     return {id,mensaje:'Documento actualizado'};
    },
    createDocumentType:async data=>{
     window.__docTest.created.push(data);
     seed.push({...data,id:11});return {id:11};
    },
    setDocumentTypeActive:async(id,activo)=>{
     window.__docTest.states.push({id,activo});
     seed.find(x=>x.id===id).activo=activo;
     return {id,activo};
    }
   };
  });
  await page.addScriptTag({path:path.join(root,'assets/js/listados-ui.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/tipos-documentos-v63.js')});
  await page.evaluate(()=>window.RutaHDTiposDocumentos.mount(
   document.getElementById('workspaceContent')));
  await page.getByRole('heading',{name:'Documentos',exact:true}).waitFor();
  await page.getByText('Factura electrónica',{exact:true}).waitFor();
  assert.equal(await page.locator('.hd-doc-table tbody tr').count(),2);
  assert.equal(await page.locator('.hd-doc-pager').count(),2);
  const idCell=await page.locator('.hd-doc-table tbody tr').first().locator('td').first().innerText();
  assert.equal(idCell,'1','Código debe mostrar ID de tabla');
  await page.getByRole('button',{name:'Modificar Factura electrónica'}).click();
  const dlg=page.locator('dialog.hd-doc-modal[open]');
  await dlg.waitFor();
  assert.equal(await dlg.locator('.hd-record-id-input').inputValue(),'1');
  const code=dlg.locator('label.hd-doc-field').filter({hasText:'Código interno'}).locator('input');
  assert(await code.isDisabled(),'Los códigos oficiales deben quedar bloqueados');
  const days=dlg.locator('label.hd-doc-field').filter({hasText:'Días de vencimiento'}).locator('input');
  await days.fill('30');
  await dlg.getByRole('button',{name:'Guardar'}).click();
  await page.waitForFunction(()=>window.__docTest.updates.length===1);
  assert.equal((await page.evaluate(()=>window.__docTest.updates[0])).data.dias_vencimiento,30);
  assert.equal(await dlg.count(),0);
  await page.getByRole('button',{name:'Nuevo documento'}).click();
  const newDlg=page.locator('dialog.hd-doc-modal[open]');
  assert.equal(await newDlg.locator('.hd-record-id-input').inputValue(),'Automático');
  await newDlg.locator('label.hd-doc-field').filter({hasText:'Código interno'}).locator('input').fill('DOCUMENTO_INTERNO_TEST');
  await newDlg.locator('label.hd-doc-field').filter({hasText:'Nombre del documento'}).locator('input').fill('Documento interno CI');
  await newDlg.locator('label.hd-doc-field').filter({hasText:'Familia'}).locator('select').selectOption('INTERNO');
  await newDlg.getByRole('button',{name:'Guardar'}).click();
  await page.waitForFunction(()=>window.__docTest.created.length===1);
  const created=await page.evaluate(()=>window.__docTest.created[0]);
  assert.equal(created.codigo_sii,null);
  assert.equal(created.documento_electronico,0);
  assert.equal(created.codigo,'DOCUMENTO_INTERNO_TEST');
  await page.getByRole('searchbox',{name:'Buscar documentos'}).fill('Factura');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.waitForFunction(()=>window.__docTest.list.at(-1).buscar==='Factura');
  await page.setViewportSize({width:390,height:740});
  await page.getByRole('button',{name:'Nuevo documento'}).click();
  const bounds=await page.locator('dialog.hd-doc-modal[open]').boundingBox();
  assert(bounds.width<=390&&bounds.height<=740,'Modal se sale del móvil '+JSON.stringify(bounds));
  await page.getByRole('button',{name:'Cerrar ventana'}).click();
  assert.deepEqual(errors,[]);
  console.log('V63_DOCUMENTOS_CRUD_OK: IDs, catálogo, bloqueo, validación, crear, editar, búsqueda y móvil');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
