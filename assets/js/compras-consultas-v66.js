(()=>{
'use strict';
const columns={
facturas:{id:'Código',folio:'Folio',proveedor:'Proveedor',documento:'Documento',fecha_documento:'Fecha',orden_compra:'Orden de compra',total:'Total',signo_contable:'Signo',estado:'Estado'},
recepciones:{id:'Código',numero_interno:'Recepción',proveedor:'Proveedor',bodega:'Bodega',orden_compra:'Orden de compra',total:'Total',estado:'Estado'},
consolidaciones:{id:'Código',numero_interno:'Consolidación',proveedor:'Proveedor',bodega:'Bodega',orden_compra:'Orden de compra',total:'Total',estado:'Estado'},
stock:{id:'Código',sku:'SKU',producto:'Producto',bodega:'Bodega',disponible:'Disponible',transito:'Tránsito',comprometido:'Comprometido',cantidad_fisica:'Físico'},
kardex:{id:'Código',sku:'SKU',producto:'Producto',bodega:'Bodega',fecha_movimiento:'Fecha',operacion_codigo:'Operación',cantidad_documento:'Cantidad',fisico_anterior:'Anterior',fisico_actual:'Actual',costo_unitario_neto:'Costo neto'},
libro:{id:'Código',periodo_tributario:'Período',folio:'Folio',fecha_documento:'Fecha',orden_compra:'Orden de compra',rut_emisor:'RUT',razon_social_emisor:'Proveedor',monto_neto:'Neto',monto_exento:'Exento',monto_iva_recuperable:'IVA recuperable',monto_total:'Total',signo_contable:'Signo',estado_rcv:'Conciliación'}
};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
function mount(root,key){
 let fields=key==='kardex'?{sku:'SKU',producto:'Producto'}:columns[key];if(!fields)return;
 const panel=el('section',null,'surface-panel hd-documents hd-v67'), heading=el('div',null,'hd-doc-heading'), search=el('input'), form=el('form',null,'hd-doc-filter'), status=el('p',null,'hd-doc-status'), top=el('div',null,'hd-doc-pager'), bottom=el('div',null,'hd-doc-pager');
 heading.append(el('h2',({facturas:'Documentos de compra',recepciones:'Recepciones',consolidaciones:'Consolidaciones',stock:'Stock',kardex:'Kardex por producto',libro:'Libro de compras'})[key]));
 if(['recepciones','consolidaciones'].includes(key)){
  const create=el('button',key==='recepciones'?'+ Nueva recepción':'+ Nueva consolidación','button primary');create.type='button';create.dataset.action='nuevo-documento';create.onclick=()=>openNew();create.classList.add('hd-v70-new');form.append(create);
 }
 const warehouse=el('select'), state=el('select'), from=el('input'), to=el('input'), supplierFilter=el('input'), ocFilter=el('input');
 const isPurchases=['facturas','recepciones','consolidaciones','libro'].includes(key),hasWarehouse=['recepciones','consolidaciones','stock','kardex'].includes(key);
 let fieldSeq=0;const field=(title,input)=>{const l=el('label',title,'hd-doc-field');input.id=input.id||('hd-'+key+'-field-'+(++fieldSeq));input.setAttribute('aria-label',title);l.htmlFor=input.id;l.append(input);return l;};
 const option=(v,t)=>{const o=el('option',t);o.value=v;return o;};
 search.type='search';search.placeholder=key==='kardex'?'SKU o nombre':'Buscar registros';search.maxLength=120;
 form.append(field('Buscar',search));
 if(hasWarehouse){warehouse.append(option('',key==='kardex'?'Seleccione bodega':'Todas las bodegas'));form.append(field('Bodega',warehouse));}
 if(isPurchases){supplierFilter.type='search';supplierFilter.placeholder='Nombre o RUT';supplierFilter.maxLength=120;ocFilter.type='search';ocFilter.placeholder='Número de OC';ocFilter.maxLength=80;form.append(field('Proveedor',supplierFilter),field('Orden de compra',ocFilter));}
 if(['facturas','recepciones','consolidaciones'].includes(key)){state.append(option('','Todos los estados'));for(const v of ['ACTIVA','PENDIENTE','RECEPCIONADA','DESCUADRADA','FINALIZADA','CONSOLIDADA'])state.append(option(v,v));form.append(field('Estado',state));}
 from.type=to.type='date';if(isPurchases)form.append(field('Desde',from),field('Hasta',to));
 const submit=el('button','Buscar','button primary');submit.type='submit';form.append(submit);const clear=el('button','Limpiar','button ghost');clear.type='button';clear.onclick=()=>{form.reset();applied={buscar:'',filters:{}};page=1;void load(true);};form.append(clear);const newButton=form.querySelector('.hd-v70-new');if(newButton)form.append(newButton);
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
  const dialog=el('dialog',null,'hd-doc-modal hd-v67 hd-v70-dialog'),wrap=el('div',null,'hd-doc-form'),header=el('div',null,'hd-doc-modal-head'),close=el('button','×','hd-doc-close'),content=el('div',null,'hd-doc-modal-scroll'),footer=el('div',null,'hd-doc-modal-footer');
  close.type='button';close.setAttribute('aria-label','Cerrar');header.append(el('h2',name),close);
  const info=el('p','Seleccione una orden de compra activa para revisar sus antecedentes.'),filter=el('form',null,'hd-doc-filter'),query=el('input'),submit=el('button','Buscar','button primary'),msg=el('p',null,'hd-doc-status'),p1=el('div',null,'hd-doc-pager'),p2=el('div',null,'hd-doc-pager'),tableWrap=el('div',null,'hd-doc-table-scroll'),t=el('table',null,'hd-doc-table'),h=el('thead'),hr=el('tr'),tb=el('tbody'),detail=el('section',null,'hd-documents');
  query.type='search';query.placeholder='Número, proveedor o RUT';query.maxLength=120;submit.type='submit';filter.append(field('Buscar orden de compra',query),submit);
  const code=el('input');code.value='Automático';code.disabled=true;
  for(const k of ['Orden de compra','Proveedor','Fecha','Total','Acciones'])hr.append(el('th',k));h.append(hr);t.append(h,tb);tableWrap.append(t);
  const notice=el('p','La selección es una consulta preliminar. El guardado y cierre del documento aún no están habilitados.','hd-doc-help');notice.setAttribute('role','note');
  const cancel=el('button','Cerrar','button ghost');cancel.type='button';cancel.onclick=close.onclick=()=>dialog.close();const save=el('button',key==='recepciones'?'Guardar recepción':'Guardar consolidación','button primary');save.type='button';save.disabled=true;save.title='Guardado pendiente de habilitación';footer.append(cancel,save);
  const docs=el('section',null,'hd-v70-docs'), docGrid=el('div',null,'hd-doc-grid'), docStatus=el('p',null,'hd-doc-status');
  const supplier=el('input');supplier.disabled=true;const order=el('input');order.disabled=true;
  const docType=el('select'),depot=el('select');docType.id='hd-recepcion-documento-tipo';depot.id='hd-recepcion-bodega';docType.append(option('','Seleccione documento'));depot.append(option('','Seleccione bodega'));
  function typed(label,type='text'){const x=el('input');x.type=type;if(type==='number'){x.min='0';x.step='0.01';}return field(label,x);}
  const money=(id,readOnly=false)=>{const x=el('input');x.type='number';x.id='hd-recepcion-'+id;x.step='1';if(!readOnly)x.min='0';x.readOnly=readOnly;return x;};
  const net=money('neto'),exempt=money('exento'),vat=money('iva',true),other=money('otros'),total=money('total',true),declared=money('total-documento'),difference=money('diferencia',true),receivedSubtotal=money('subtotal-recibido',true);
  const peso=x=>Math.max(0,Math.round(Number(x.value)||0));
  let receivedLines=[];
  const validCost=x=>/^\d{1,11}(?:\.\d{1,4})?$/.test(x.value)&&Number.isFinite(Number(x.value))&&Number(x.value)>=0;
  const validQty=x=>/^\d{1,9}(?:\.\d{1,3})?$/.test(x.value)&&Number(x.value)>=0;
  function lineValue(line){return validQty(line.qty)&&validCost(line.cost)&&(Number(line.cost.value)>0||line.zero.checked)?Math.round(Number(line.qty.value)*Number(line.cost.value)):null;}
  function updateLine(line){const hasQty=Number(line.qty.value)>0,valid=validCost(line.cost),zero=valid&&Number(line.cost.value)===0;line.zeroLabel.hidden=!zero;line.cost.setCustomValidity(!valid?'Ingrese un costo numérico no negativo con hasta cuatro decimales.':zero&&!line.zero.checked?'Confirme expresamente el costo cero.':'');line.qty.setCustomValidity(line.qty.value!==''&&!validQty(line.qty)?'Ingrese una cantidad no negativa con hasta tres decimales.':'');line.cost.setAttribute('aria-invalid',String(hasQty&&(!valid||(zero&&!line.zero.checked))));line.subtotal.textContent=lineValue(line)===null?'—':String(lineValue(line));line.delta.textContent=valid?(Number(line.cost.value)-line.ocCost).toFixed(4):'—';line.delta.style.color=valid&&Number(line.cost.value)!==line.ocCost?'#a12645':'';}

  function recalc(){
   const doc=docType.selectedOptions[0];const taxCode=Number(doc?.dataset.sii||0);
   const exemptDoc=[32,34,38,41].includes(taxCode);
   vat.value=String(exemptDoc?0:Math.round(peso(net)*19/100));
   total.value=String(peso(net)+peso(exempt)+peso(vat)+peso(other));
   difference.value=declared.value===''?'':String(peso(declared)-peso(total));
   difference.style.color=difference.value!==''&&Number(difference.value)!==0?'#a12645':'';
   difference.style.fontWeight=difference.value!==''&&Number(difference.value)!==0?'700':'';
   const incomplete=receivedLines.some(line=>Number(line.qty.value)>0&&lineValue(line)===null);receivedSubtotal.value=receivedLines.length&&!incomplete?String(receivedLines.reduce((sum,line)=>sum+(lineValue(line)??0),0)):'';
   docStatus.textContent=exemptDoc&&peso(net)>0?'Documento exento: ingrese el importe en Monto exento, no en Monto neto afecto.':declared.value!==''&&Number(difference.value)!==0?'El total declarado por el proveedor presenta diferencias.':incomplete?'Complete y valide el costo del documento de cada producto recibido.':'';
  }
  for(const input of [net,exempt,other,declared])input.addEventListener('input',recalc);
  docType.addEventListener('change',recalc);
  docs.append(el('h3','Documento de compra'),docGrid,docStatus);
  docs.append(el('p','El total del proveedor se conserva por separado. El subtotal recibido se calcula con el costo neto real del documento. El costo OC es solo una referencia. No sustituye los importes tributarios.','hd-doc-help'));
  recalc();
  docGrid.append(field('Orden de compra',order),field('Proveedor',supplier),field('Bodega de recepción',depot),field('Tipo de documento',docType),typed('Folio del documento'),typed('Fecha de emisión','date'),typed('Fecha de recepción','date'),field('Monto neto afecto',net),field('Monto exento',exempt),field('IVA calculado (19 %)',vat),field('Otros impuestos',other),field('Total calculado',total),field('Total documento proveedor',declared),field('Diferencia del documento',difference),field('Subtotal recibido a costo documento',receivedSubtotal));
  const observations=el('textarea');observations.rows=3;docGrid.append(field('Observaciones y diferencias',observations));
  async function catalogs(){
   try{
    const all=async fn=>{let out=[],n=1,d;do{d=await fn(n++);out.push(...(d.data||d.items||[]));}while(n<=Math.min(100,d.last_page||1));return out;};
    const [types,warehouses]=await Promise.all([all(page=>api.documentTypes({page,activo:1})),all(page=>api.resources('bodegas',page,'',25))]);if(!dialog.open)return;
    for(const d of types)if(Number(d.documento_compra)===1&&d.familia!=='INTERNO'){const o=option(String(d.id),d.nombre);o.dataset.sii=String(d.codigo_sii??'');docType.append(o);}
    for(const b of warehouses)if(Number(b.activo??1)===1)depot.append(option(String(b.id),b.nombre));
   }catch(e){if(dialog.open)docStatus.textContent=e.userMessage||'No fue posible cargar los tipos de documento o las bodegas.';}
  }
  content.append(field('Código',code),info,filter,msg,p1,tableWrap,p2);if(key==='recepciones')content.append(docs);content.append(detail,notice);wrap.append(header,content,footer);dialog.append(wrap);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();if(key==='recepciones')void catalogs();
  let estadoId=null,seq=0,detailSeq=0,selected=null,appliedQuery='';
  async function showOrder(item){
   selected=String(item.id);receivedLines=[];recalc();const token=++detailSeq;detail.replaceChildren(el('p','Cargando orden de compra…'));
   try{
    const d=await api.getPurchaseOrder(item.id);if(token!==detailSeq||!dialog.open)return;
    if(d.estado_codigo!=='ACTIVA'){detail.replaceChildren(el('p','La orden ya no está activa. Actualice la búsqueda.'));return;}
    order.value=d.numero??d.id;supplier.value=d.proveedor_nombre??'';
    const head=el('h3','Orden de compra '+(d.numero??d.id)),general=el('p',(d.proveedor_nombre??'')+' · '+(d.solicitada_en??'')+' · '+(d.estado_nombre??'ACTIVA'));
    const box=el('div',null,'hd-doc-table-scroll'),pt=el('table',null,'hd-doc-table'),ph=el('thead'),pr=el('tr'),pb=el('tbody');
    for(const k of ['SKU','Producto','Cantidad solicitada','Costo unitario OC','Subtotal OC'])pr.append(el('th',k));if(key==='recepciones')pr.append(el('th','Cantidad recibida'),el('th','Costo unitario neto documento'),el('th','Subtotal recibido'),el('th','Diferencia costo unitario'));ph.append(pr);
    for(const row of d.detalles||[]){const tr=el('tr');for(const k of ['sku','nombre','cantidad','costo_unitario_neto','subtotal_neto'])tr.append(el('td',row[k]??'—'));if(key==='recepciones'){const td=el('td'),qty=el('input');qty.type='number';qty.min='0';qty.step='0.001';qty.setAttribute('aria-label','Cantidad recibida '+(row.sku??row.nombre));td.append(qty);tr.append(td);const ct=el('td'),cost=el('input');cost.type='number';cost.min='0';cost.step='0.0001';cost.required=true;cost.placeholder='Costo documento';cost.setAttribute('aria-label','Costo documento '+(row.sku??row.nombre));const zero=el('input');zero.type='checkbox';zero.setAttribute('aria-label','Confirmar costo cero '+(row.sku??row.nombre));const zeroLabel=el('label','Confirmar costo cero','hd-doc-field');zeroLabel.prepend(zero);zeroLabel.hidden=true;ct.append(cost,zeroLabel);tr.append(ct);const subtotal=el('td','—'),delta=el('td','—');tr.append(subtotal,delta);const line={qty,cost,zero,zeroLabel,subtotal,delta,ocCost:Math.max(0,Number(row.costo_unitario_neto)||0)};receivedLines.push(line);for(const control of [qty,cost,zero])control.addEventListener('input',()=>{updateLine(line);recalc();});updateLine(line);}pb.append(tr);}
    pt.append(ph,pb);box.append(pt);detail.replaceChildren(head,general,box);recalc();
    if(key==='consolidaciones')detail.append(el('p','Los productos mostrados corresponden a la orden, no a recepciones consolidadas. La selección de recepciones elegibles requiere habilitar el servicio de consolidación.','hd-doc-help'));
   }catch(e){if(token===detailSeq&&dialog.open)detail.replaceChildren(el('p',e.userMessage||'No fue posible consultar la orden.'));}
  }
  async function loadOrders(n){
   const token=++seq;msg.textContent='Cargando órdenes…';tb.replaceChildren();p1.replaceChildren();p2.replaceChildren();
   try{
    if(!estadoId){const states=await api.orderStates();estadoId=(states.items||[]).find(s=>s.codigo==='ACTIVA')?.id;if(!estadoId)throw Error('Estado activo no disponible');}
    const d=await api.purchaseOrders({page:n,buscar:appliedQuery,estadoId});if(token!==seq||!dialog.open)return;
    for(const item of d.data||[]){if(item.estado_codigo!=='ACTIVA')continue;const tr=el('tr'),td=el('td'),pick=el('button',selected===String(item.id)?'Seleccionada':'Seleccionar','button ghost hd-v70-pick');pick.type='button';pick.setAttribute('aria-label','Seleccionar orden '+(item.numero??item.id));pick.setAttribute('aria-pressed',String(selected===String(item.id)));pick.onclick=()=>{for(const b of tb.querySelectorAll('.hd-v70-pick')){b.textContent='Seleccionar';b.setAttribute('aria-pressed','false');}pick.textContent='Seleccionada';pick.setAttribute('aria-pressed','true');void showOrder(item);};for(const k of ['numero','proveedor_nombre','solicitada_en','total_bruto'])tr.append(el('td',item[k]??'—'));td.append(pick);tr.append(td);tb.append(tr);}
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
   if(hasWarehouse&&Array.isArray(data.bodegas)){const old=warehouse.value;warehouse.replaceChildren(option('',key==='kardex'?'Seleccione bodega':'Todas las bodegas'));for(const b of data.bodegas)warehouse.append(option(String(b.id),b.nombre));if([...warehouse.options].some(o=>o.value===old))warehouse.value=old;else if(key==='kardex'&&data.bodegas.length===1)warehouse.value=String(data.bodegas[0].id);}
   for(const item of data.data||[]){const row=el('tr');if(key==='libro'&&Number(item.signo_contable)<0)row.classList.add('hd-v67-credit');Object.keys(fields).forEach(k=>row.append(el('td',item[k]??'—')));if(key==='kardex'){const td=el('td');td.append(eye(item));row.append(td);}body.append(row);}
   if(!body.children.length){const row=el('tr'),cell=el('td','No se encontraron registros.');cell.colSpan=Object.keys(fields).length+(key==='kardex'?1:0);row.append(cell);body.append(row);}
   const last=Math.max(1,Number(data.last_page||1));for(const p of [top,bottom])pager(p,page,last,data.total,n=>{page=n;void load(true);});status.textContent=data.total+' registros';
   if(scrollUp)up(panel);
  }catch(e){if(request===seq&&panel.isConnected)status.textContent=e.userMessage||'No fue posible consultar los registros.';}
 }
 form.addEventListener('submit',e=>{e.preventDefault();const filters={};if(state.value)filters.estado=state.value;if(from.value&&to.value&&from.value>to.value){status.textContent='La fecha Hasta no puede ser anterior a Desde.';return;}if(from.value)filters.desde=from.value;if(to.value)filters.hasta=to.value;if(isPurchases&&supplierFilter.value.trim())filters.proveedor=supplierFilter.value.trim();if(isPurchases&&ocFilter.value.trim())filters.orden_compra=ocFilter.value.trim();if(hasWarehouse&&key!=='kardex'&&warehouse.value)filters.bodega_id=warehouse.value;applied={buscar:search.value.trim(),filters};page=1;void load(true);});void load();
}
window.RutaHDComprasConsultas=Object.freeze({mount});
})();
