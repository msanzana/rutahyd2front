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
  await page.addStyleTag({path:src('assets/css/crud-v18.css')});
  await page.addStyleTag({path:src('assets/css/clientes-v50.css')});
  await page.evaluate(()=>{
    window.__queries=[];window.__creates=[];window.__validation='';
    window.RutaHDValidacion={mostrar:(field,message)=>{window.__validation=message;}};

    window.RutaHDGirosSii={open:async()=>({codigo:'471100',descripcion:'Venta al por menor'})};
    window.RutaHDAccesos={authenticated:()=>true,isAdmin:()=>true,has:()=>true};
    window.RutaHDApiCatalogos={
      customerLegalTypes:async()=>({items:[
        {id:1,nombre:'Empresa',codigo:'EMPRESA',activo:true},
        {id:2,nombre:'Persona natural',codigo:'PERSONA_NATURAL',activo:true}]}),
      priceLists:async()=>({data:[
        {id:5,nombre:'LISTA BASE',es_base:true,activo:true},
        {id:9,nombre:'LISTA ESPECIAL',es_base:false,activo:true}
      ],last_page:1}),
      customerPriceList:async()=>({lista:{id:5,nombre:'LISTA BASE'}}),
      locations:async(tipo,options)=>{
        const places={
          paises:[{id:1,nombre:'Chile',activo:true}],
          regiones:[{id:2,nombre:'La Araucanía',activo:true}],
          provincias:[{id:3,nombre:'Cautín',activo:true}],
          comunas:[{id:4,nombre:'Temuco',activo:true}],
          ciudades:[{id:24,nombre:'Temuco',activo:true}]
        };
        return {data:places[tipo]||[],total:(places[tipo]||[]).length,last_page:1};
      },
      locationPath:async id=>({ciudad:'Temuco',region:'La Araucanía'}),
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
  await page.addScriptTag({path:src('assets/js/ubicaciones.js')});
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
  const idCode=form.locator('input[name=codigo]');
  assert.equal(await idCode.inputValue(),'Automático');
  assert.equal(await idCode.getAttribute('readonly'),'');
  assert.equal(await idCode.getAttribute('aria-readonly'),'true');
  const type=form.locator('select[name=tipo_juridico_id]');
  const giroCode=form.locator('input[name=actividad_economica_codigo]');
  const giroName=form.locator('input[name=giro]');
  const giroButton=form.getByRole('button',{name:'Buscar giro SII'});
  assert.equal(await giroButton.isHidden(),true,'Giro stays hidden until company');
  await type.selectOption('2');
  assert.equal(await giroButton.isHidden(),true,'Natural person has no giro');
  await type.selectOption('1');
  assert.equal(await giroButton.isVisible(),true,'Company can select giro SII');
  await giroButton.click();
  assert.equal(await giroCode.inputValue(),'471100');
  await type.selectOption('2');
  assert.equal(await giroButton.isHidden(),true);
  assert.equal(await giroCode.inputValue(),'');
  assert.equal(await giroName.inputValue(),'');
  await type.selectOption('1');
  await giroButton.click();
  const firstRow=form.locator('.hd-customer-identity-row');
  assert.equal(await firstRow.locator('input').count(),3);
  const rects=await firstRow.locator('input').evaluateAll(nodes=>
    nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,height:r.height};}));
  assert(rects.every(r=>Math.abs(r.y-rects[0].y)<=1),
    'Los tres primeros campos deben comenzar en la misma línea');
  assert(rects.every(r=>Math.abs(r.height-rects[0].height)<=1),
    'Los tres controles deben medir exactamente lo mismo');
  const geo=form.locator('.location-chain');
  await geo.waitFor();
  for(const label of ['País','Región','Provincia','Comuna','Ciudad / localidad'])
    assert.equal(await geo.getByRole('combobox',{name:label,exact:true}).count(),1);
  assert.equal(await form.getByRole('searchbox',{name:'Buscar ciudad del cliente'}).count(),0);
  await geo.getByRole('combobox',{name:'Región',exact:true}).selectOption('2');
  await geo.getByRole('combobox',{name:'Provincia',exact:true}).selectOption('3');
  await geo.getByRole('combobox',{name:'Comuna',exact:true}).selectOption('4');
  await geo.getByRole('combobox',{name:'Ciudad / localidad',exact:true}).selectOption('24');
  const price=form.getByRole('combobox',{name:'Lista de precios activa del cliente'});
  assert.equal(await price.inputValue(),'5','LISTA BASE debe venir seleccionada');
  assert.match(await form.locator('.hd-customer-price-status').innerText(),/LISTA BASE asignada por defecto/);
  await price.selectOption('9');
  assert.match(await form.locator('.hd-customer-price-status').innerText(),/LISTA ESPECIAL/);
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
  assert.equal(created.data.actividad_economica_codigo,'471100');
  assert.equal(Object.hasOwn(created.data,'codigo'),false);
  assert.equal(created.data.ciudad_id,24);
  assert.equal(created.data.lista_precio_id,9);
  assert.equal(created.data.rut,'12345678-5');
  assert.equal(Object.hasOwn(created.data,'sector'),false);
  assert.equal(Object.hasOwn(created.data,'comuna'),false);
  // En un segundo cliente nuevo, LISTA BASE se selecciona nuevamente por defecto.
  await list.getByRole('button',{name:'Nuevo cliente'}).click();
  const second=page.locator('dialog.official-editor[open] form');
  await second.waitFor();
  const secondPrice=second.getByRole('combobox',{name:'Lista de precios activa del cliente'});
  assert.equal(await second.locator('input[name=codigo]').inputValue(),'Automático');
  assert.equal(await second.getByRole('button',{name:'Buscar giro SII'}).isHidden(),true);
  assert.equal(await secondPrice.inputValue(),'5');
  await second.locator('input[name=nombre]').fill('Segundo comprador');
  await second.locator('input[name=rut]').fill('11111111-1');
  await second.locator('select[name=tipo_juridico_id]').selectOption('2');
  await second.getByRole('button',{name:'Guardar'}).click();
  await page.waitForFunction(()=>window.__creates.length===2);
  const baseCreated=await page.evaluate(()=>window.__creates[1]);
  assert.equal(baseCreated.data.lista_precio_id,5);
  assert.equal(baseCreated.data.actividad_economica_codigo,null);
  assert.equal(baseCreated.data.giro,null);
  assert.equal(Object.hasOwn(baseCreated.data,'codigo'),false);
  await list.locator('.list-icon-action[aria-label^="Editar"]').first().click();
  const editing=page.locator('dialog.official-editor[open] form');
  await editing.waitFor();
  assert.equal(await editing.locator('input[name=codigo]').inputValue(),'7');
  assert.equal(await editing.locator('input[name=codigo]').getAttribute('readonly'),'');
  await editing.getByRole('button',{name:'Cancelar'}).click();
  await page.setViewportSize({width:390,height:760});
  const scroll=await list.locator('.hd-customers-scroll').evaluate(el=>({
    clientWidth:el.clientWidth,scrollWidth:el.scrollWidth
  }));
  assert(scroll.scrollWidth>scroll.clientWidth,'Mobile table needs horizontal scroll');
  assert.deepEqual(errors,[]);
  console.log('V52_FRONT_OK giro empresa condicionado, código Automático/ID, ubicación, precios, validación y móvil.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
