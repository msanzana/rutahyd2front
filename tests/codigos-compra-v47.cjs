// V47: prueba aislada del formulario real de códigos de compra.
// API simulada en memoria; jamás ejecuta POST contra producción.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const source=p=>path.join(__dirname,'..',p);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({locale:'es-CL',viewport:{width:1280,height:850}});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.setContent('<main id="fixture"></main>');
  await page.addStyleTag({path:source('assets/css/interfaz-mix-validacion-v45.css')});
  await page.evaluate(()=>{
    window.__requests=[];
    window.__remoteFailure=true;
    window.__codes=[];
    window.RutaHDAccesos={authenticated:()=>true,isAdmin:()=>true,has:()=>true};
    window.RutaHDApiCatalogos={
      supplierMix:async()=>({data:[{id:4,nombre:'3M Chile S.A.',rut:'93626000-4',
        giro:'Fabricación',activo:1,cantidad_productos_mix:1}],total:1,last_page:1}),
      productSuppliers:async()=>({data:[{id:7,proveedor_id:4,producto_id:1,
        proveedor:'3M Chile S.A.',producto:'Scotch',
        codigo_producto:'1',activo:true}],total:1,last_page:1}),
      purchaseBarcodes:async()=>({items:window.__codes}),
      list:async()=>({items:[
        {id:1,codigo:'EAN13',nombre:'EAN-13',activo:true},
        {id:2,codigo:'CODE128',nombre:'Code 128',activo:true}
      ]}),
      createPurchaseBarcode:async(linkId,payload)=>{
        window.__requests.push({linkId,payload});
        if(window.__remoteFailure){
          const error=new Error('Error HTTP 422');
          error.status=422;
          error.userMessage='El código de compra no coincide con la simbología seleccionada.';
          error.validationErrors={codigo_barras:['El código no tiene formato permitido.']};
          throw error;
        }
        const row={id:11,codigo_barras:payload.codigo_barras,
          unidades_por_codigo:payload.unidades_por_codigo,tipo_nombre:'Code 128',
          tipo_codigo_barra_id:payload.tipo_codigo_barra_id,activo:true};
        window.__codes.push(row);
        return row;
      }
    };
  });
  await page.addScriptTag({path:source('assets/js/proveedores-productos.js')});
  await page.evaluate(()=>{
    window.RutaHDProveedoresProductos.mount(document.getElementById('fixture'));
  });
  await page.getByRole('button',{name:'Editar mix de 3M Chile S.A.'}).click();
  await page.getByRole('button',{name:'Códigos de compra'}).click();
  await page.getByRole('button',{name:'Añadir código de barras de compra'}).click();
  const form=page.locator('.supplier-barcode-form');
  await form.locator('select').selectOption('1');
  await form.locator('input[type=text]').fill('ABC-12');
  await form.locator('input[type=number]').fill('12');
  await form.getByRole('button',{name:'Añadir código'}).click();
  assert.match(await form.locator('.supplier-status').innerText(),/EAN13.*13 dígitos/);
  assert.equal(await page.evaluate(()=>window.__requests.length),0,
    'EAN inválido se rechaza ANTES del POST');
  assert.equal(await form.locator('input[type=text]').getAttribute('aria-invalid'),'true');

  await form.locator('select').selectOption('2');
  await form.locator('input[type=text]').fill('PACK-PROV-001');
  await form.locator('input[type=number]').fill('12.1234');
  await form.getByRole('button',{name:'Añadir código'}).click();
  assert.match(await form.locator('.supplier-status').innerText(),/hasta 3 decimales/);
  assert.equal(await page.evaluate(()=>window.__requests.length),0);

  await form.locator('input[type=number]').fill('12.125');
  await form.getByRole('button',{name:'Añadir código'}).click();
  assert.match(await form.locator('.supplier-status').innerText(),/El código de compra no coincide/);
  assert.equal(await page.evaluate(()=>window.__requests.length),1,
    'Un payload válido sí llega a la API y muestra el motivo exacto del 422');
  assert.equal(await form.locator('input[type=text]').getAttribute('aria-invalid'),'true');
  await page.evaluate(()=>window.__remoteFailure=false);
  await form.getByRole('button',{name:'Añadir código'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.supplier-barcode-item').length===1);
  assert.match(await page.locator('.supplier-barcode-item').innerText(),/PACK-PROV-001/);
  const requests=await page.evaluate(()=>window.__requests);
  assert.equal(requests.length,2);
  assert.deepEqual(requests[1],{linkId:7,payload:{
    tipo_codigo_barra_id:2,codigo_barras:'PACK-PROV-001',
    unidades_por_codigo:'12.125',activo:true
  }});
  assert.deepEqual(pageErrors,[]);
  console.log('V47_FRONT_OK: EAN13 inválido sin POST; decimal inválido sin POST; error 422 visible; CODE128 guardado.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
