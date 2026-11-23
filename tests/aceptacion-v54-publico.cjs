// V54: prueba read-only de HTML en producción con navegación NORMAL.
// No usa credenciales, JWT, POST, DDL ni parámetros para invalidar caché.
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const origin='https://rutahyd2.free.nf';
const release='v53-cache-20261123';
const expectedAssets=[
 'modulos-oficiales.js?v=20261123-v52',
 'giros-sii-v39.js?v=20261123-v52',
 'buscador-productos-v39.js?v=20261123-v52',
 'clientes-v50.css?v=20261123-v52'
];
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  // Contexto persistente dentro de la prueba; cache de Chromium no se deshabilita.
  const context=await browser.newContext({viewport:{width:1366,height:820},locale:'es-CL'});
  const observations=[];
  for(const path of ['/', '/', '/index.html']){
   const page=await context.newPage();
   const htmlResponses=[];
   page.on('response',response=>{
    try{
     const url=new URL(response.url());
     if(url.origin===origin && (url.pathname==='/'||url.pathname==='/index.html'))
      htmlResponses.push({status:response.status(),
        cacheControl:response.headers()['cache-control']||'',
        expires:response.headers().expires||''});
    }catch(_ignored){}
   });
   const response=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:65000});
   // InfinityFree puede intercalar su verificación ?i=1. Esperar el HTML de la aplicación.
   await page.waitForFunction(ver=>document.querySelector('meta[name="rutahd-release"]')?.content===ver,
     release,{timeout:45000});
   assert.equal(await page.title(),'Ruta H&D2 · Gestión Comercial');
   const source=await page.content();
   for(const asset of expectedAssets)assert(source.includes(asset),'Falta recurso versionado: '+asset);
   const final=htmlResponses.at(-1)||{
    status:response?.status()||0,cacheControl:response?.headers()['cache-control']||''};
   assert.equal(final.status,200,'La navegación normal debe devolver HTML 200');
   assert(/(?:^|[ ,])no-cache|no-store/i.test(final.cacheControl),
     'El HTML normal debe exigir revalidación, recibido: '+final.cacheControl);
   observations.push({path,status:final.status,cacheControl:final.cacheControl,
     expires:final.expires||'',release});
   // Recarga ordinaria, SIN reload forzado ni querystring artificial.
   if(path==='/'){
    const reloaded=await page.reload({waitUntil:'domcontentloaded',timeout:65000});
    await page.waitForFunction(ver=>document.querySelector('meta[name="rutahd-release"]')?.content===ver,
      release,{timeout:45000});
    assert.equal(reloaded.status(),200);
   }
   await page.close();
  }
  await context.close();
  console.log('V54_PUBLIC_CACHE_OK',JSON.stringify(observations));
 }finally{await browser.close();}
})().catch(error=>{console.error('V54_PUBLIC_CACHE_FAIL',error.message);process.exitCode=1;});
