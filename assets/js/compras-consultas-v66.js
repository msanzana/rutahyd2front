(()=>{
'use strict';
const columns={
facturas:{id:'Código',folio:'Folio',proveedor:'Proveedor',documento:'Documento',fecha_documento:'Fecha',total:'Total',signo_contable:'Signo',estado:'Estado'},
recepciones:{id:'Código',estado:'Estado'},
consolidaciones:{id:'Código',estado:'Estado'},
stock:{id:'Código',sku:'SKU',producto:'Producto',bodega:'Bodega',disponible:'Disponible',transito:'Tránsito',cantidad_fisica:'Físico'},
kardex:{id:'Código',sku:'SKU',producto:'Producto',bodega:'Bodega',fecha_movimiento:'Fecha',operacion_codigo:'Operación',cantidad_documento:'Cantidad',fisico_anterior:'Anterior',fisico_actual:'Actual',costo_unitario_neto:'Costo neto'},
libro:{id:'Código',periodo_tributario:'Período',folio:'Folio',rut_emisor:'RUT',razon_social_emisor:'Proveedor',monto_neto:'Neto',monto_exento:'Exento',monto_iva_recuperable:'IVA recuperable',monto_total:'Total',signo_contable:'Signo',estado_rcv:'Conciliación'}
};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
function mount(root,key){
 let fields=key==='kardex'?{sku:'SKU',producto:'Producto'}:columns[key];if(!fields)return;
 const panel=el('section',null,'surface-panel hd-documents hd-v67'), heading=el('div',null,'hd-doc-heading'), search=el('input'), form=el('form',null,'hd-doc-filter'), status=el('p',null,'hd-doc-status'), top=el('div',null,'hd-doc-pager'), bottom=el('div',null,'hd-doc-pager');
 heading.append(el('h2',({facturas:'Documentos de compra',recepciones:'Recepciones',consolidaciones:'Consolidaciones',stock:'Stock',kardex:'Kardex por producto',libro:'Libro de compras'})[key]));
 if(['recepciones','consolidaciones'].includes(key)){
  const create=el('button',key==='recepciones'?'+ Nueva recepción':'+ Nueva consolidación','button primary');create.type='button';create.dataset.action='nuevo-documento';create.onclick=()=>openNew();heading.append(create);
 }
 const warehouse=el('select'), state=el('select'), from=el('input'), to=el('input');
 const field=(title,input)=>{const l=el('label',title,'hd-doc-field');l.append(input);return l;};
 const option=(v,t)=>{const o=el('option',t);o.value=v;return o;};
 search.type='search';search.placeholder=key==='kardex'?'SKU o nombre':'Buscar registros';search.maxLength=120;
 form.append(field('Buscar',search));
 if(key==='kardex'){warehouse.append(option('','Seleccione bodega'));form.append(field('Bodega',warehouse));}
 if(['facturas','recepciones','consolidaciones'].includes(key)){state.append(option('','Todos los estados'));for(const v of ['ACTIVA','PENDIENTE','RECEPCIONADA','DESCUADRADA','FINALIZADA','CONSOLIDADA'])state.append(option(v,v));form.append(field('Estado',state));}
 from.type=to.type='date';if(key==='facturas')form.append(field('Desde',from),field('Hasta',to));
 const submit=el('button','Buscar','button primary');submit.type='submit';form.append(submit);
 const scroll=el('div',null,'hd-doc-table-scroll'), table=el('table',null,'hd-table hd-doc-table'), head=el('thead'), tr=el('tr'), body=el('tbody');
 Object.values(fields).forEach(name=>tr.append(el('th',name)));if(key==='kardex')tr.append(el('th','Acciones'));head.append(tr);table.append(head,body);scroll.append(table);
 status.setAttribute('role','status');panel.append(heading,form,status,top,scroll,bottom);root.replaceChildren(panel);
 let page=1,seq=0,applied={buscar:'',filters:{}};
 function pager(target,current,last,total,go){
  target.replaceChildren();target.append(el('span',total+' registros'));
  const btn=(label,p,disabled)=>{const b=el('button',label,'button ghost');b.type='button';b.disabled=disabled;if(p===current&&label===String(p)){b.classList.add('is-current');b.setAttribute('aria-current','page');}b.onclick=()=>go(p);target.append(b);};
  btn('‹',current-1,current<=1);let prev=0;
  for(const p of [...new Set([1,current-1,current,current+1,last])].filter(p=>p>=1&&p<=last).sort((a,b)=>a-b)){if(prev&&p-prev>1)target.append(el('i','…'));btn(String(p),p,p===current);prev=p;}
  btn('›',current+1,current>=last);
 }
 function up(target){target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 function openNew(){
  const api=window.RutaHDApiCatalogos;
  const name=key==='recepciones'?'Nueva recepción':'Nueva consolidación';
  const dialog=el('dialog',null,'hd-doc-modal hd-v67'),wrap=el('div',null,'hd-doc-form'),header=el('div',null,'hd-doc-modal-head'),close=el('button','×','hd-doc-close'),content=el('div',null,'hd-doc-modal-scroll'),footer=el('div',null,'hd-doc-modal-footer');
  close.type='button';close.setAttribute('aria-label','Cerrar');header.append(el('h2',name),close);
  const info=el('p','Seleccione una orden de compra activa para revisar sus antecedentes.'),filter=el('form',null,'hd-doc-filter'),query=el('input'),submit=el('button','Buscar','button primary'),msg=el('p',null,'hd-doc-status'),p1=el('div',null,'hd-doc-pager'),p2=el('div',null,'hd-doc-pager'),tableWrap=el('div',null,'hd-doc-table-scroll'),t=el('table',null,'hd-doc-table'),h=el('thead'),hr=el('tr'),tb=el('tbody'),detail=el('section',null,'hd-documents');
  query.type='search';query.placeholder='Número, proveedor o RUT';query.maxLength=120;submit.type='submit';filter.append(field('Buscar orden de compra',query),submit);
  const code=el('input');code.value='Automático';code.disabled=true;
  for(const k of ['Seleccionar','Orden de compra','Proveedor','Fecha','Total'])hr.append(el('th',k));h.append(hr);t.append(h,tb);tableWrap.append(t);
  const notice=el('p','La selección es una consulta preliminar. El guardado y cierre del documento aún no están habilitados.','hd-doc-help');notice.setAttribute('role','note');
  const cancel=el('button','Cerrar','button ghost');cancel.type='button';cancel.onclick=close.onclick=()=>dialog.close();footer.append(cancel);
  content.append(field('Código',code),info,filter,msg,p1,tableWrap,p2,detail,notice);wrap.append(header,content,footer);dialog.append(wrap);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  let estadoId=null,seq=0,detailSeq=0,selected=null,appliedQuery='';
  async function showOrder(item){
   selected=String(item.id);const token=++detailSeq;detail.replaceChildren(el('p','Cargando orden de compra…'));
   try{
    const d=await api.getPurchaseOrder(item.id);if(token!==detailSeq||!dialog.open)return;
    if(d.estado_codigo!=='ACTIVA'){detail.replaceChildren(el('p','La orden ya no está activa. Actualice la búsqueda.'));return;}
    const head=el('h3','Orden de compra '+(d.numero??d.id)),general=el('p',(d.proveedor_nombre??'')+' · '+(d.solicitada_en??'')+' · '+(d.estado_nombre??'ACTIVA'));
    const box=el('div',null,'hd-doc-table-scroll'),pt=el('table',null,'hd-doc-table'),ph=el('thead'),pr=el('tr'),pb=el('tbody');
    for(const k of ['SKU','Producto','Cantidad solicitada','Costo neto','Subtotal'])pr.append(el('th',k));ph.append(pr);
    for(const row of d.detalles||[]){const tr=el('tr');for(const k of ['sku','nombre','cantidad','costo_unitario_neto','subtotal_neto'])tr.append(el('td',row[k]??'—'));pb.append(tr);}
    pt.append(ph,pb);box.append(pt);detail.replaceChildren(head,general,box);
    if(key==='consolidaciones')detail.append(el('p','Los productos mostrados corresponden a la orden, no a recepciones consolidadas. La selección de recepciones elegibles requiere habilitar el servicio de consolidación.','hd-doc-help'));
   }catch(e){if(token===detailSeq&&dialog.open)detail.replaceChildren(el('p',e.userMessage||'No fue posible consultar la orden.'));}
  }
  async function loadOrders(n){
   const token=++seq;msg.textContent='Cargando órdenes…';tb.replaceChildren();p1.replaceChildren();p2.replaceChildren();
   try{
    if(!estadoId){const states=await api.orderStates();estadoId=(states.items||[]).find(s=>s.codigo==='ACTIVA')?.id;if(!estadoId)throw Error('Estado activo no disponible');}
    const d=await api.purchaseOrders({page:n,buscar:appliedQuery,estadoId});if(token!==seq||!dialog.open)return;
    for(const item of d.data||[]){if(item.estado_codigo!=='ACTIVA')continue;const tr=el('tr'),td=el('td'),radio=el('input');radio.type='radio';radio.name='oc-seleccion';radio.setAttribute('aria-label','Seleccionar orden '+(item.numero??item.id));radio.checked=selected===String(item.id);radio.onchange=()=>void showOrder(item);td.append(radio);tr.append(td);for(const k of ['numero','proveedor_nombre','solicitada_en','total_bruto'])tr.append(el('td',item[k]??'—'));tb.append(tr);}
    if(!tb.children.length){const tr=el('tr'),td=el('td','No hay órdenes activas para esta búsqueda.');td.colSpan=5;tr.append(td);tb.append(tr);}
    msg.textContent=(d.total??0)+' órdenes activas';for(const p of [p1,p2])pager(p,n,Math.max(1,d.last_page||1),d.total??0,loadOrders);
   }catch(e){if(token===seq&&dialog.open)msg.textContent=e.userMessage||'No fue posible consultar las órdenes activas.';}
  }
  filter.onsubmit=e=>{e.preventDefault();appliedQuery=query.value.trim();void loadOrders(1);};void loadOrders(1);
 }
 function eye(item){
  const b=el('button',null,'button ghost hd-v67-eye');b.type='button';b.title='Ver Kardex';b.setAttribute('aria-label','Ver Kardex de '+item.producto);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','19');svg.setAttribute('height','19');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');
  const p=document.createElementNS(ns,'path');p.setAttribute('d','M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z');const circ=document.createElementNS(ns,'circle');circ.setAttribute('cx','12');circ.setAttribute('cy','12');circ.setAttribute('r','3');svg.append(p,circ);b.append(svg);b.onclick=()=>details(item);return b;
 }
 function details(item){
  if(!warehouse.value){status.textContent='Seleccione una bodega antes de consultar el Kardex.';warehouse.focus();return;}
  const dialog=el('dialog',null,'hd-doc-modal hd-v67'), wrap=el('div',null,'hd-doc-form'), header=el('div',null,'hd-doc-modal-head'), close=el('button','×','hd-doc-close'), content=el('div',null,'hd-doc-modal-scroll'), msg=el('p',null,'hd-doc-status'), p1=el('div',null,'hd-doc-pager'),p2=el('div',null,'hd-doc-pager'), box=el('div',null,'hd-doc-table-scroll'),t=el('table',null,'hd-doc-table'),h=el('thead'),r=el('tr'),tb=el('tbody');
  const fs=columns.kardex;Object.values(fs).forEach(v=>r.append(el('th',v)));h.append(r);t.append(h,tb);box.append(t);header.append(el('h2','Kardex · '+item.producto),el('p',warehouse.selectedOptions[0].textContent),close);content.append(msg,p1,box,p2);wrap.append(header,content);dialog.append(wrap);document.body.append(dialog);close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  const bodega=warehouse.value;let req=0;
  async function fetchPage(n){const token=++req;msg.textContent='Cargando…';tb.replaceChildren();try{const d=await window.RutaHDApiCatalogos.purchaseConsultation('kardex',n,'',{producto_id:String(item.id),bodega_id:bodega});if(token!==req||!dialog.open)return;for(const row of d.data||[]){const line=el('tr');Object.keys(fs).forEach(k=>line.append(el('td',row[k]??'—')));tb.append(line);}msg.textContent=d.total?d.total+' movimientos':'Sin movimientos en esta bodega.';for(const p of [p1,p2])pager(p,n,Math.max(1,d.last_page||1),d.total,fetchPage);content.scrollTop=0;}catch(e){if(token===req&&dialog.open)msg.textContent=e.userMessage||'No fue posible consultar el Kardex.';}}
  void fetchPage(1);
 }
 async function load(scrollUp=false){
  const request=++seq;status.textContent='Cargando…';body.replaceChildren();top.replaceChildren();bottom.replaceChildren();
  try{
   const data=await window.RutaHDApiCatalogos.purchaseConsultation(key,page,applied.buscar,applied.filters);
   if(request!==seq||!panel.isConnected)return;
   if(key==='kardex'&&Array.isArray(data.bodegas)){const old=warehouse.value;warehouse.replaceChildren(option('','Seleccione bodega'));for(const b of data.bodegas)warehouse.append(option(String(b.id),b.nombre));if([...warehouse.options].some(o=>o.value===old))warehouse.value=old;else if(data.bodegas.length===1)warehouse.value=String(data.bodegas[0].id);}
   for(const item of data.data||[]){const row=el('tr');if(key==='libro'&&Number(item.signo_contable)<0)row.classList.add('hd-v67-credit');Object.keys(fields).forEach(k=>row.append(el('td',item[k]??'—')));if(key==='kardex'){const td=el('td');td.append(eye(item));row.append(td);}body.append(row);}
   if(!body.children.length){const row=el('tr'),cell=el('td','No se encontraron registros.');cell.colSpan=Object.keys(fields).length+(key==='kardex'?1:0);row.append(cell);body.append(row);}
   const last=Math.max(1,Number(data.last_page||1));for(const p of [top,bottom])pager(p,page,last,data.total,n=>{page=n;void load(true);});status.textContent=data.total+' registros';
   if(scrollUp)up(panel);
  }catch(e){if(request===seq&&panel.isConnected)status.textContent=e.userMessage||'No fue posible consultar los registros.';}
 }
 form.addEventListener('submit',e=>{e.preventDefault();const filters={};if(state.value)filters.estado=state.value;if(from.value)filters.desde=from.value;if(to.value)filters.hasta=to.value;applied={buscar:search.value.trim(),filters};page=1;void load(true);});void load();
}
window.RutaHDComprasConsultas=Object.freeze({mount});
})();
