// V55: el HTML conserva anti-cache V53 y versiona estrictamente los JS cambiados.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ht=fs.readFileSync(path.join(__dirname,'../.htaccess'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.match(ht,/FilesMatch.*index/);
assert.match(ht,/no-store, no-cache, must-revalidate/);
assert.match(html,/rutahd-release" content="v53-cache-20261123"/);
for(const tag of [
  'modulos-oficiales.js?v=20261123-v52',
  'clientes-v50.css?v=20261123-v52',
  'ordenes-compra-v55.js?v=20261123-v57',
  'ordenes-compra-v55.css?v=20261123-v57',
  'app-produccion.js?v=20261123-v55',
  'buscador-productos-v39.js?v=20261123-v55',
  'catalogos-api.js?v=20261123-v55',
  'listados-ui.js?v=20261123-v55'
])assert(html.includes(tag),'Falta etiqueta de recurso: '+tag);
assert(!html.includes('catalogos.js')&&!html.includes('app.js?v='));
console.log('V55_CACHE_COMPATIBLE_OK');
