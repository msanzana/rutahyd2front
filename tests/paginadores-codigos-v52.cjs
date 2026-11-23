// V52 · Paginador general compartido en buscador SII y PK visual readonly.
// En Chromium con API simulada, sin solicitudes al hosting productivo.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const src=n=>path.join(__dirname,'..',n);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1120,height:820}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="fixture"></main>');
  await page.addStyleTag({path:src('assets/css/listados-tema-v20.css')});
  await page.evaluate(()=>{
    window.__calls=[];
    window.RutaHDApiCatalogos={
      girosSii:async ({buscar,page,perPage})=>{
        window.__calls.push({buscar,page,perPage});
        const total=66,last_page=3;
        return {total,last_page,data:Array.from({length:Math.max(0,Math.min(25,total-(page-1)*25))},
          (_,i)=>({codigo:String((page-1)*25+i+100000),descripcion:'Actividad '+((page-1)*25+i+1),
            afecta_iva:'SI',categoria_tributaria:'PRIMERA'}))};
      }
    };
  });
  await page.addScriptTag({path:src('assets/js/listados-ui.js')});
  await page.addScriptTag({path:src('assets/js/giros-sii-v39.js')});
  const id=await page.evaluate(()=>{
    const host=document.querySelector('#fixture');
    const n=window.RutaHDListUI.recordCode(host,null);
    return {value:n.value,readOnly:n.readOnly,disabled:n.disabled,name:n.name};
  });
  assert.deepEqual(id,{value:'Automático',readOnly:true,disabled:false,name:''});
  const actual=await page.evaluate(()=>{
    const host=document.querySelector('#fixture');
    const n=window.RutaHDListUI.recordCode(host,451);
    return {value:n.value,readOnly:n.readOnly};
  });
  assert.deepEqual(actual,{value:'451',readOnly:true});
  await page.evaluate(()=>{
    window.__chosenPromise=window.RutaHDGirosSii.open({buscar:''});
  });
  const dialog=page.locator('dialog.hd-giro-dialog[open]');
  await dialog.waitFor();
  const pager=dialog.locator('nav.hd-numbered-pagination');
  await pager.first().getByRole('button',{name:'Página 3'}).click();
  await page.waitForFunction(()=>window.__calls.some(entry=>entry.page===3));
  assert.equal(await pager.count(),2);
  for(const nav of [pager.nth(0),pager.nth(1)]){
    assert.equal(await nav.getByRole('button',{name:'Página 3'}).getAttribute('aria-current'),'page');
    assert.match(await nav.innerText(),/Página 3 de 3/);
  }
  // Volver mediante paginador inferior y comprobar sincronización superior.
  await pager.last().getByRole('button',{name:'Página 2'}).click();
  await page.waitForFunction(()=>window.__calls.filter(entry=>entry.page===2).length>=1);
  assert.equal(await pager.first().getByRole('button',{name:'Página 2'}).getAttribute('aria-current'),'page');
  // Una nueva búsqueda reinicia la página y mantiene ambos paginadores.
  await dialog.getByRole('searchbox',{name:'Buscar código o actividad económica SII'}).fill('comercio');
  await dialog.getByRole('button',{name:'Buscar giros'}).click();
  await page.waitForFunction(()=>window.__calls.at(-1)?.buscar==='comercio'&&window.__calls.at(-1)?.page===1);
  assert.equal(await pager.first().getByRole('button',{name:'Página 1'}).getAttribute('aria-current'),'page');
  await dialog.locator('.list-icon-action[aria-label^="Seleccionar giro"]').first().click();
  assert.equal(await dialog.count(),0);
  const chosen=await page.evaluate(()=>window.__chosenPromise);
  assert.match(chosen.codigo,/^[0-9]{6}$/);
  assert.deepEqual(errors,[]);
  console.log('V52_GIRO_PAGER_OK numeración compartida, arriba/abajo, consulta paginada, filtro, PK readonly.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
