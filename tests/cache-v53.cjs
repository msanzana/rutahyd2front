// V53 · El HTML se revalida, sin desactivar caché de recursos versionados.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ht=fs.readFileSync(path.join(__dirname,'..','.htaccess'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.match(ht,/<FilesMatch "\^index\\\.html\$">/);
assert.match(ht,/Header always set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"/);
assert.match(ht,/Header always set Expires/);
assert.doesNotMatch(ht,/<FilesMatch "[^"]*js/);
assert.doesNotMatch(ht,/<FilesMatch "[^"]*css/);
assert.doesNotMatch(ht,/RewriteRule|RewriteEngine|api-v2|Require all/);
assert.match(html,/<meta name="rutahd-release" content="v53-cache-20261123">/);
assert.match(html,/addEventListener\('pageshow'/);
assert.match(html,/event\.persisted\) window\.location\.reload\(\)/);
for(const dep of [
 'modulos-oficiales.js?v=20261123-v52',
 'giros-sii-v39.js?v=20261123-v52',
 'buscador-productos-v39.js?v=20261123-v52',
 'clientes-v50.css?v=20261123-v52',
 'app-produccion.js?v=20261122-v50',
 'catalogos-api.js?v=20261122-v50'
]) assert(html.includes(dep),'Version must be retained: '+dep);
console.log('V53_CACHE_CONTRACT_OK: no-store HTML; assets versioned; bfcache recovery; API untouched.');
