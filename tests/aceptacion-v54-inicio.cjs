// V54: proteger arranque del menú y CRUD Clientes con APIs simuladas.
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/app-produccion.js'),'utf8');
assert.match(js,/\$\$\('#ubicacionesSubnav \[data-nav\]'\)\.forEach/,
 'La navegación debe iterar NodeList de Ubicaciones, no un elemento único');
assert.doesNotMatch(js,/(?<!\$)\$\('#ubicacionesSubnav \[data-nav\]'\)\.forEach/);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="workspace"></div>');
  await page.evaluate(()=>{
    window.RutaHDAccesos={authenticated:()=>false,isAdmin:()=>false,
      usuario:()=>null,canSeeSubmodule:()=>false,canViewCatalog:()=>false};
    window.RutaHDRecuperacion={isActive:()=>false};
    document.body.innerHTML=`
      <button id="navUsuarios"></button><button id="navPerfiles"></button>
      <button id="toggleAdminSubnav"></button>
      <button id="toggleUbicacionesSubnav"></button>
      <div id="ubicacionesSubnav"><button data-nav="ubicaciones.paises"></button>
        <button data-nav="ubicaciones.regiones"></button></div>
      <button id="toggleProviderSubnav"></button>
      <button id="toggleClientSubnav"></button>
      <button id="toggleProductSubnav"></button>
      <div id="clientSubnav"><button data-nav="clientes_listado"></button></div>
      <div id="providerSubnav"><button data-nav="proveedores_productos"></button>
        <button data-nav="proveedores"></button></div>
      <div id="productSubnav"><button data-nav="productos"></button>
        <button data-nav="listas_precios"></button></div>
      <div id="adminSubnav"></div>
      <div class="profile-label"><small></small><b></b></div>
      <div class="profile"><div class="avatar"></div></div>
      <div id="menuFinder"></div>
      <div id="homeView"></div><div id="workspaceView"></div>
      <div class="environment-notice"></div><input id="globalSearch" />
      <div class="sidebar"><div class="nav"></div></div>`;
  });
  await page.addScriptTag({path:path.join(__dirname,'../assets/js/app-produccion.js')});
  // API pública del módulo debe existir sin error de evaluación del script.
  assert.equal(await page.evaluate(()=>typeof window.RutaHDProduccion?.navigate),'function');
  assert.deepEqual(errors,[]);
  console.log('V54_BOOT_SELECTOR_OK; sin excepciones en evaluación del menú.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
