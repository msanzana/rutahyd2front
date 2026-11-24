'use strict';
// V62: navegación principal abre primera subopción accesible, no módulo genérico.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(raw.includes('app-produccion.js?v=20261124-v63'));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},locale:'es-CL'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
  await page.setContent(html);
  await page.evaluate(()=>{
    history.replaceState=()=>{};
    window.__nav=[];
    const add=name=>({mount:(host,key)=>{
      window.__nav.push({name,key:key||null});
      host.textContent=name+(key?' '+key:'');
    }});
    window.RutaHDAccesos={
      authenticated:()=>true,isAdmin:()=>true,has:()=>true,
      usuario:()=>({nombre:'Operador CI',rol:'Administrador'}),
      canSeeSubmodule:()=>true,canViewCatalog:()=>true
    };
    window.RutaHDRecuperacion={isActive:()=>false};
    window.RutaHDLogin={show:()=>{throw Error('No debe abrir el login');}};
    window.RutaHDRemoto=add('Remoto');
    window.RutaHDOrdenesCompra=add('Ordenes');
    window.RutaHDProductosRemotos=add('Productos');
    window.RutaHDListasPrecios=add('Listas');
    window.RutaHDOficial=add('Oficial');
    window.RutaHDProveedoresProductos=add('ProductosProveedores');
    window.RutaHDUsuarios=add('Usuarios');
    window.RutaHDPerfiles=add('Perfiles');
    window.RutaHDVentasPrecios=add('Ventas');
  });
  await page.addScriptTag({path:path.join(root,'assets/js/app-produccion.js')});
  await page.evaluate(()=>window.RutaHDProduccion.loggedIn());
  for(const id of ['adminSubnav','purchaseSubnav','providerSubnav','clientSubnav','productSubnav'])
    assert.equal(await page.locator('#'+id).evaluate(n=>n.hidden),true,
      'El login inicia con menús cerrados');
  const cases=[
    ['administracion','catalogos.tipos_unidad','adminSubnav','Remoto'],
    ['compras','compras_ordenes','purchaseSubnav','Ordenes'],
    ['proveedores','proveedores','providerSubnav','Oficial'],
    ['clientes','clientes_listado','clientSubnav','Oficial'],
    ['productos','productos','productSubnav','Productos']
  ];
  for(const [main,first,container,module] of cases){
    const selector='.sidebar .nav-parent > .nav-link[data-nav="'+main+'"]';
    await page.locator(selector).click();
    const data=await page.evaluate(()=>({
      last:window.__nav.at(-1),
      expanded:[...document.querySelectorAll('.product-subnav')]
        .filter(n=>!n.hidden).map(n=>n.id),
      active:[...document.querySelectorAll('.nav-sublink.active')]
        .map(n=>n.dataset.adminCatalog?'catalogos.'+n.dataset.adminCatalog:n.dataset.nav),
      title:document.querySelector('#breadcrumbCurrent')?.textContent
    }));
    if(!data.active.includes(first))console.log('V62_MENU_DEBUG',JSON.stringify({main,data,errors}));
    assert(data.active.includes(first),main+' no selecciona primer subitem: '+JSON.stringify(data));
    assert(data.expanded.includes(container),'Submenú principal no expandido');
    assert.equal(data.last.name,module,main+' no abre el módulo esperado');
  }
  // Una opción principal elige la primera *visible y autorizada*.
  await page.locator('#adminSubnav [data-admin-catalog="tipos_unidad"]')
    .evaluate(n=>n.hidden=true);
  await page.locator('.sidebar .nav-parent > .nav-link[data-nav="administracion"]').click();
  assert(await page.locator('#adminSubnav [data-admin-catalog="tipos_envasado"]')
    .evaluate(n=>n.classList.contains('active')),'Omitir primer subitem oculto');
  // Un clic en subopción concreta no debe redirigir al primer elemento.
  await page.locator('.sidebar .nav-parent > .nav-link[data-nav="productos"]').click();
  await page.locator('#productSubnav [data-nav="listas_precios"]').click();
  assert(await page.locator('#productSubnav [data-nav="listas_precios"]')
    .evaluate(n=>n.classList.contains('active')),'Subopción seleccionada');
  assert(await page.locator('.sidebar .nav-parent > .nav-link[data-nav="productos"]')
    .evaluate(n=>n.classList.contains('active')),'Padre queda resaltado');
  await page.evaluate(()=>window.RutaHDProduccion.navigate('inicio'));
  await page.locator('.module-card[data-nav="compras"]').click();
  assert(await page.locator('#purchaseSubnav [data-nav="compras_ordenes"]')
    .evaluate(n=>n.classList.contains('active')),'Acceso desde tarjeta de inicio');
  assert.deepEqual(errors,[]);
  console.log('V62_FIRST_SUBMENU_OK: 5 principales, primer visible, directo y tarjetas');
 } finally {await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
