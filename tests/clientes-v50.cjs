// V50 Playwright: mocks en memoria, sin API productiva.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const src=p=>path.join(__dirname,'..',p);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:830},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="workspaceView"><input id="globalSearch"><main id="fixture"></main></div>');
  await page.addStyleTag({path:src('assets/css/clientes-v50.css')});
  await page.evaluate(()=>{
    window.__queries=[];window.__creates=[];window.__validation='';
    window.RutaHDValidacion={mostrar:(field,message)=>{window.__validation=message;}};
    window.RutaHDUbicaciones={mountSelector:async host=>{
      const note=document.createElement('p');note.textContent='Ciudad / localidad';
      host.append(note);return {value:()=>null};
    }};
    window.RutaHDGirosSii={open:async()=>({codigo:'471100',descripcion:'Venta al por menor'})};
    window.RutaHDAccesos={authenticated:()=>true,isAdmin:()=>true,has:()=>true};
    window.RutaHDApiCatalogos={
      customerLegalTypes:async()=>({items:[
        {id:1,nombre:'Empresa',codigo:'EMPRESA',activo:true},
        {id:2,nombre:'Persona natural',codigo:'PERSONA_NATURAL',activo:true}]}),
      priceLists:async()=>({data:[{id:5,nombre:'LISTA BASE',es_base:true,activo:true}],last_page:1}),
      customerPriceList:async()=>({lista:{id:5,nombre:'LISTA BASE'}}),
      customers:async args=>{
        window.__queries.push(args);
        return {data:[{id:7,rut:'12345678-5',nombre:'Comercial prueba',
          direccion:'Av. Centro 15',ciudad:'Temuco',correo_electronico:'ci@example.invalid',
          tipo_juridico_id:1,tipo_juridico_nombre:'Empresa',lista_precio_nombre:'LISTA BASE',
          lista_precio_id:5,activo:true,telefono:'+56 912345678',giro:null,
          actividad_economica_codigo:null,codigo:null,ciudad_id:null}],total:28,last_page:2};
      },
      createResource:async(resource,data)=>{window.__creates.push({resource,data});return {id:20};},
      updateResource:async()=>({activo:true}),deactivateResource:async()=>({activo:false})
    };
  });
  await page.addScriptTag({path:src('assets/js/listados-ui.js')});
  await page.addScriptTag({path:src('assets/js/rut-chileno-v39.js')});
  await page.addScriptTag({path:src('assets/js/modulos-oficiales.js')});
  await page.evaluate(()=>window.RutaHDOficial.mount(document.querySelector('#fixture'),'clientes'));
  const list=page.locator('.hd-customers');
  await page.getByRole('table',{name:'Listado de clientes'}).waitFor();
  const headers=await list.locator('table thead th').allTextContents();
  for(const title of ['RUT','Nombre completo','Dirección','Ciudad','Correo electrónico',
    'Tipo jurídico','Lista de precios activa','Acciones'])
    assert(headers.some(s=>s.includes(title)),'Missing header '+title);
  assert.equal(await list.locator('.hd-customers-price-pill').innerText(),'LISTA BASE');
  assert.equal(await list.locator('nav.hd-customers-pager').count(),2);
  assert.equal(await list.getByRole('button',{name:'Nuevo cliente'}).count(),1);
  assert.equal(await list.locator('.list-icon-action[aria-label^="Editar"]').count(),1);
  assert.equal(await list.locator('.list-icon-action[aria-label^="Desactivar"]').count(),1);
  await list.locator('nav.hd-customers-pager').first().getByRole('button',{name:'Página 2'}).click();
  await page.waitForFunction(()=>window.__queries.some(q=>q.page===2));
  await list.getByRole('button',{name:'Búsqueda avanzada'}).click();
  const advanced=page.locator('dialog.advanced-search-dialog[open]');
  await advanced.waitFor();
  await advanced.locator('select[name=tipo_juridico_id]').selectOption('2');
  await advanced.locator('select[name=activo]').selectOption('1');
  await advanced.getByRole('button',{name:'Aplicar filtros'}).click();
  await page.waitForFunction(()=>window.__queries.some(q=>q.filters.tipo_juridico_id==='2'));
  const filtered=await page.evaluate(()=>window.__queries.at(-1));
  assert.equal(filtered.filters.tipo_juridico_id,'2');
  assert.equal(filtered.filters.activo,'1');
  assert.equal(filtered.page,1);
  await list.getByRole('button',{name:'Nuevo cliente'}).click();
  const form=page.locator('dialog.official-editor[open] form');
  await form.waitFor();
  assert.equal(await form.locator('[name=sector],[name=comuna]').count(),0);
  assert.equal(await form.locator('select[name=tipo_juridico_id] option').count(),3);
  const phone=form.locator('input[name=telefono]');
  assert.equal(await phone.getAttribute('inputmode'),'tel');
  assert.equal(await phone.getAttribute('placeholder'),'+56 912345678');
  await form.locator('input[name=nombre]').fill('Comprador de prueba');
  await form.locator('input[name=rut]').fill('12345678-5');
  await form.locator('select[name=tipo_juridico_id]').selectOption('1');
  await phone.fill('+56912345678');
  await form.getByRole('button',{name:'Guardar'}).click();
  assert.equal(await page.evaluate(()=>window.__creates.length),0);
  assert.match(await page.evaluate(()=>window.__validation),/\+56 NNNNNNNNN/);
  await phone.fill('+56 912345678');
  await form.getByRole('button',{name:'Guardar'}).click();
  await page.waitForFunction(()=>window.__creates.length===1);
  const created=await page.evaluate(()=>window.__creates[0]);
  assert.equal(created.resource,'clientes');
  assert.equal(created.data.telefono,'+56 912345678');
  assert.equal(created.data.tipo_juridico_id,'1');
  assert.equal(created.data.rut,'12345678-5');
  assert.equal(Object.hasOwn(created.data,'sector'),false);
  assert.equal(Object.hasOwn(created.data,'comuna'),false);
  await page.setViewportSize({width:390,height:760});
  const scroll=await list.locator('.hd-customers-scroll').evaluate(el=>({
    clientWidth:el.clientWidth,scrollWidth:el.scrollWidth
  }));
  assert(scroll.scrollWidth>scroll.clientWidth,'Mobile table needs horizontal scroll');
  assert.deepEqual(errors,[]);
  console.log('V50_FRONT_OK columnas, lista activa, paginación, filtros, +56, jurídico y móvil.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
