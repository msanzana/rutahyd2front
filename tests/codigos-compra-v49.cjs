// V49: regresión de campo de barcode tras error de validación EAN-13.
// Todos los datos y peticiones son simulados; nunca toca producción.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const asset=p=>path.join(__dirname,'..',p);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({locale:'es-CL',viewport:{width:1100,height:850}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="fixture"></main>');
  await page.addStyleTag({path:asset('assets/css/crud-v18.css')});
  await page.addStyleTag({path:asset('assets/css/interfaz-mix-validacion-v45.css')});
  await page.evaluate(()=>{
    window.__requests=[];
    window.__codes=[];
    window.RutaHDAccesos={authenticated:()=>true,isAdmin:()=>true,has:()=>true};
    window.RutaHDApiCatalogos={
      supplierMix:async()=>({data:[{id:4,nombre:'3M Chile S.A.',rut:'93626000-4',
        giro:'Fabricación',activo:1,cantidad_productos_mix:1}],total:1,last_page:1}),
      productSuppliers:async()=>({data:[{id:7,proveedor_id:4,producto_id:1,
        proveedor:'3M Chile S.A.',producto:'Scotch 10 mm x 20 mt',
        codigo_producto:'1',activo:true}],total:1,last_page:1}),
      purchaseBarcodes:async()=>({items:window.__codes}),
      list:async()=>({items:[
        {id:1,codigo:'EAN13',nombre:'EAN-13 (GTIN-13)',activo:true},
        {id:2,codigo:'CODE128',nombre:'Code 128',activo:true}
      ]}),
      createPurchaseBarcode:async(linkId,payload)=>{
        window.__requests.push({linkId,payload});
        const row={id:window.__requests.length,codigo_barras:payload.codigo_barras,
          unidades_por_codigo:payload.unidades_por_codigo,
          tipo_nombre:payload.tipo_codigo_barra_id===2?'Code 128':'EAN-13',
          tipo_codigo_barra_id:payload.tipo_codigo_barra_id,activo:true};
        window.__codes.push(row);
        return row;
      }
    };
  });
  await page.addScriptTag({path:asset('assets/js/validacion-ui.js')});
  await page.addScriptTag({path:asset('assets/js/proveedores-productos.js')});
  await page.evaluate(()=>window.RutaHDProveedoresProductos.mount(document.getElementById('fixture')));
  await page.getByRole('button',{name:'Editar mix de 3M Chile S.A.'}).click();
  await page.getByRole('button',{name:'Códigos de compra'}).click();
  await page.getByRole('button',{name:'Añadir código de barras de compra'}).click();
  let form=page.locator('.supplier-barcode-form');
  await form.locator('select').selectOption('1');
  const code=form.locator('input[type=text]');
  const properties=await code.evaluate(el=>({
    tag:el.tagName,type:el.type,disabled:el.disabled,readOnly:el.readOnly,
    inputMode:el.inputMode,maxLength:el.maxLength
  }));
  assert.deepEqual(properties,{tag:'INPUT',type:'text',disabled:false,
    readOnly:false,inputMode:'text',maxLength:100});
  await code.fill('252');
  await form.getByRole('button',{name:'Añadir código'}).click();
  assert.match(await form.locator('.supplier-status').innerText(),/13 dígitos/);
  assert.equal(await code.getAttribute('aria-invalid'),'true');
  assert.equal(await page.evaluate(()=>window.__requests.length),0);
  const alternative=form.getByRole('button',{name:'Usar Code 128 para este código'});
  assert.equal(await alternative.isVisible(),true);
  // Después del error, el campo debe seguir aceptando interacción real de teclado.
  await code.click();
  await code.press('ControlOrMeta+A');
  await page.keyboard.type('9780201379620');
  assert.equal(await code.inputValue(),'9780201379620');
  assert.equal(await code.getAttribute('aria-invalid'),null);
  assert.equal(await alternative.isHidden(),true);
  assert.equal((await form.locator('.supplier-status').innerText()).trim(),'');
  // Volver a un código corto y cambiar SOLO por decisión explícita del usuario.
  await code.fill('252');
  assert.equal(await alternative.isVisible(),true);
  assert.equal(await form.locator('select').inputValue(),'1');
  await alternative.click();
  assert.equal(await form.locator('select').inputValue(),'2');
  assert.equal(await code.inputValue(),'252');
  assert.equal(await code.getAttribute('aria-invalid'),null);
  await form.getByRole('button',{name:'Añadir código'}).click();
  await page.waitForFunction(()=>window.__requests.length===1);
  assert.deepEqual(await page.evaluate(()=>window.__requests[0]),{
    linkId:7,payload:{tipo_codigo_barra_id:2,codigo_barras:'252',
      unidades_por_codigo:'1',activo:true}
  });
  // Un verdadero EAN de 13 dígitos se puede pegar conservando ceros iniciales.
  await page.getByRole('button',{name:'Añadir código de barras de compra'}).click();
  form=page.locator('.supplier-barcode-form');
  await form.locator('select').selectOption('1');
  await form.locator('input[type=text]').fill('0000000000001');
  assert.equal(await form.locator('input[type=text]').inputValue(),'0000000000001');
  await form.getByRole('button',{name:'Añadir código'}).click();
  await page.waitForFunction(()=>window.__requests.length===2);
  assert.equal((await page.evaluate(()=>window.__requests[1])).payload.codigo_barras,
    '0000000000001');
  // La edición móvil no debe bloquearse ni perder foco.
  await page.setViewportSize({width:390,height:760});
  await page.getByRole('button',{name:'Añadir código de barras de compra'}).click();
  const mobile=page.locator('.supplier-barcode-form input[type=text]');
  await mobile.fill('252');
  await mobile.click();
  await mobile.press('ControlOrMeta+A');
  await page.keyboard.type('1111111111111');
  assert.equal(await mobile.inputValue(),'1111111111111');
  assert.deepEqual(errors,[]);
  console.log('V49_UI_OK código editable tras EAN inválido, sugerencia Code128, ceros iniciales, móvil y API.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
