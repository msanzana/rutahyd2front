/* V103: semántica visual centralizada. No modifica datos, controles ni validaciones. */
(()=>{
 'use strict';
 const scope='dialog:not(#loginDialog):not([data-hd-loading]),#workspaceContent';
 const roles={
   brand:'violeta',
   identity:'azul',
   catalog:'indigo',
   inventory:'petroleo',
   financial:'bronce',
   notes:'pizarra'
 };
 const groups=[
   ['identity','.hd-v70-docs,.hd-oc-identity,.hd-oc-fields,.supplier-mix-provider-block,.hd92-identity,.hd-customer-identity-row'],
   ['catalog','.supplier-location-section,.location-chain'],
   ['inventory','.hd98-stock,.hd-oc-details,.hd102-lines-scroll'],
   ['financial','.hd-customer-prices,.hd-oc-totals'],
   ['notes','.hd-advanced-panel']
 ];
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 const titles=new Map();
 for(const [role,names] of Object.entries({
   identity:['información del producto','información comercial','datos generales','datos del proveedor','datos del cliente','datos personales','identificación','documento de compra','orden de compra','datos del documento','antecedentes','información de contacto','datos de contacto'],
   catalog:['clasificación comercial','clasificación del producto','ubicación geográfica','códigos de barras de venta','códigos de barras de compra','perfiles y permisos','permisos por módulo','usuarios y sus perfiles','clasificaciones','catálogos'],
   inventory:['existencias por bodega','detalle de productos','productos consolidados','productos recibidos','recepciones','movimientos de inventario','kardex','productos del proveedor','productos asociados'],
   financial:['datos de envase y costo','precios','precios por lista','lista de precios del cliente','listas de precios','costos','totales','resumen de importes','resumen de costos'],
   notes:['observaciones','información complementaria','búsqueda avanzada','saldo pendiente de la orden','notas','observaciones y diferencias']
 }))for(const name of names)titles.set(normalize(name),role);
 const sectionHeadings='.product-editor-section,.official-editor-section,.product-detail-section>h3,.hd92-section>h3,.hd-v70-docs>h3,.hd-oc-details>legend,.hd-customer-prices-title,.hd98-stock>h3,.supplier-location-section>h3,.hd-doc-modal-scroll>section>h3,.hd-advanced-panel>h3';
 function apply(root){
   if(!root?.querySelectorAll)return;
   for(const [role,selector] of groups)for(const node of root.querySelectorAll(selector))
     node.dataset.hdSectionTone=roles[role];
   for(const heading of root.querySelectorAll('h3,h4,legend')){
     const role=titles.get(normalize(heading.textContent));
     const isSection=heading.matches(sectionHeadings);
     if(!role&&!isSection)continue;
     // Las advertencias y errores conservan su semántica original.
     if(heading.closest('.hd92-acceptance,[role="alert"],.hd93-error,.hd92-result.warning'))continue;
     heading.dataset.hdHeadingTone=roles[role||'brand'];
     const parent=heading.parentElement;
     if(role&&parent?.matches('.product-detail-section,.hd92-section,.hd-doc-modal-scroll>section')&&parent.querySelector(':scope > h3,:scope > h4,:scope > legend')===heading)
       parent.dataset.hdSectionTone=roles[role];
   }
 }
 let queued=false;
 function refresh(){queued=false;for(const root of document.querySelectorAll(scope))apply(root);}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
 function init(){
   refresh();
   // Solo cambios de estructura/texto: no observa los atributos que añade.
   new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
