/* V104: catalogos y ajuste rapido. Solo operaciones expresamente habilitadas por API. */
(()=>{
'use strict';
const api=()=>window.RutaHDApiCatalogos,acl=()=>window.RutaHDAccesos,can=p=>acl()?.isAdmin()||acl()?.has(p);
const el=(t,txt,c)=>{const n=document.createElement(t);if(txt!==undefined&&txt!==null)n.textContent=txt;if(c)n.className=c;return n;};
const btn=(t,fn,c='button ghost')=>{const b=el('button',t,c);b.type='button';b.onclick=fn;return b;};
const field=(t,n)=>{const l=el('label',t,'hd-doc-field');n.setAttribute('aria-label',t);l.append(n);return l;};
const input=(t='text')=>{const n=el('input');n.type=t;return n;};
const opt=(v,t)=>{const n=el('option',t);n.value=v;return n;};
const error=(status,e)=>{status.textContent=e?.userMessage||e?.message||'No se pudo completar la operación.';status.setAttribute('role','alert');};
const num=x=>String(x??'0').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace('.',',');
const uuid=()=>crypto.randomUUID();
function table(heads){
 const wrap=el('div',null,'hd-doc-table-scroll'),t=el('table',null,'hd-doc-table'),h=el('thead'),r=el('tr'),b=el('tbody');
 for(const title of heads){const th=el('th',title);th.scope='col';r.append(th);}h.append(r);t.append(h,b);wrap.append(t);return {wrap,b};
}
function row(body,values,action=null){const r=el('tr');for(const v of values)r.append(el('td',v??'—'));if(action){const c=el('td');c.append(action);r.append(c);}body.append(r);}
function empty(body,n,text){const r=el('tr'),d=el('td',text);d.colSpan=n;r.append(d);body.append(r);}
function modal(title){
 const d=el('dialog',null,'hd-doc-modal hd-v67 hd-v70-dialog'),shell=el('div',null,'hd-doc-form'),head=el('div',null,'hd-doc-modal-head'),content=el('div',null,'hd-doc-modal-scroll'),foot=el('div',null,'hd-doc-modal-footer'),close=btn('×',()=>d.close(),'hd-doc-close');
 close.setAttribute('aria-label','Cerrar');close.title='Cerrar';close.style.cssText='display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;min-height:36px;flex:0 0 36px;border-radius:11px;font-size:24px;line-height:1;padding:0;margin-left:auto';head.append(el('h2',title),close);shell.append(head,content,foot);d.append(shell);document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return {d,content,foot,close};
}
function paged(host,heads,fetcher,render,{newAction=null}={}){
 const section=el('section',null,'hd-documents hd-v67 surface-panel'),form=el('form',null,'hd-doc-filter hd-search-form'),toolbar=el('div',null,'hd-search-toolbar'),q=input('search'),search=el('button','Buscar','button primary'),status=el('p',null,'hd-doc-status'),top=el('nav'),bottom=el('nav'),t=table(heads);
 q.placeholder='Búsqueda general';search.type='submit';toolbar.append(field('Buscar',q),search);
 if(newAction){const b=btn('+ Nuevo ajuste',newAction,'button primary hd-v70-new');b.dataset.action='nuevo-documento';b.style.marginInlineStart='auto';toolbar.append(b);}form.append(toolbar);
 section.append(form,status,top,t.wrap,bottom);host.replaceChildren(section);
 let page=1,seq=0,term='';
 async function load(n=page){
  const ticket=++seq;page=n;status.textContent='Cargando…';
  try{const result=await fetcher(page,term);if(ticket!==seq||!section.isConnected)return;t.b.replaceChildren();
   for(const item of result.data||[])render(t.b,item,load,result);
   if(!(result.data||[]).length)empty(t.b,heads.length,'Sin registros para esta búsqueda.');
   status.textContent='';const options={page:result.current_page||page,pages:result.last_page||1,total:result.total||0,autoTop:false,onPage:p=>{void load(p);section.scrollIntoView({block:'start'});}};
   window.RutaHDListUI.renderPager(top,options);window.RutaHDListUI.renderPager(bottom,options);
  }catch(e){if(ticket===seq)error(status,e);}
 }
 form.onsubmit=e=>{e.preventDefault();term=q.value.trim();void load(1);};
 void load();return load;
}
function catalogs(root){
 const tabs=el('div',null,'hd-doc-filter'),host=el('div'),wrap=el('section',null,'hd-documents');wrap.append(tabs,host);root.replaceChildren(wrap);
 const show=()=>paged(host,['Código','Grupo','Motivo','Naturaleza','CPP','Motor','Estado','Acciones'],(p,q)=>api().inventoryCatalogs(p,q),(b,m,reload)=>{
  const a=can('inventario.catalogos.gestionar')?window.RutaHDListUI.action('Editar '+m.nombre,()=>edit(m,reload),{kind:'editar'}):null;
  row(b,[m.codigo,m.grupo,m.nombre,m.naturaleza,m.politica_cpp,m.habilitado_motor?'Ajuste rápido':'Preparado',Number(m.activo)?'Activo':'Inactivo'],a||el('span','—'));
 });
 function edit(m,reload){
  const {d,content,foot}=modal('Motivo de inventario'),name=input(),code=input(),active=input('checkbox'),status=el('p',null,'hd-doc-status');
  name.value=m.nombre;code.value=m.codigo;code.disabled=true;active.checked=!!Number(m.activo);
  content.append(field('Código',code),field('Nombre',name),field('Activo',active),el('p','Regla protegida: '+m.regla),el('p','Política CPP: '+m.politica_cpp),el('p','Requiere referencia: '+(Number(m.requiere_referencia)?'Sí':'No')+' · Aprobación: '+(Number(m.requiere_aprobacion)?'Sí':'No')),status);
  const save=btn('Guardar',async()=>{save.disabled=true;try{await api().inventoryUpdateReason(m.id,{nombre:name.value.trim(),activo:active.checked});d.close();void reload();}catch(e){error(status,e);}finally{save.disabled=false;}},'button primary');foot.append(btn('Cerrar',()=>d.close()),save);
 }
 async function readCatalog(kind){
  const s=el('section',null,'hd-documents surface-panel');host.replaceChildren(s);s.append(el('p','Cargando…'));
  try{const d=await api().inventoryCatalogs(1,'');if(!s.isConnected)return;const data=d[kind]||[],t=table(['Código','Nombre']);for(const x of data)row(t.b,[x.codigo,x.nombre]);s.replaceChildren(t.wrap);}catch(e){error(s,e);}
 }
 tabs.append(btn('Motivos',show),btn('Grupos',()=>readCatalog('grupos')),btn('Tipos de movimiento',()=>readCatalog('tipos')),btn('Indicadores SII',()=>readCatalog('indicadores_sii')),btn('Referencias SII',()=>readCatalog('referencias_sii')));show();
}
function adjustments(root){
 let reload=()=>{};
 reload=paged(root,['Número','Motivo','Folio','Fecha','Estado','Acciones'],(p,q)=>api().inventoryAdjustments(p,q),(b,m)=>{
  row(b,[m.numero_interno,m.motivo_nombre_snapshot,m.referencia_folio,m.creado_en,m.estado_nombre],window.RutaHDListUI.action('Ver '+m.numero_interno,()=>detail(m.id,reload),{kind:'ver'}));
 },{newAction:can('inventario.operaciones.gestionar')&&can('inventario.catalogos.ver')?()=>create(reload):null});
}
function create(reload){
 const {d,content,foot,close}=modal('Nuevo ajuste rápido'),status=el('p',null,'hd-doc-status'),code=input(),reason=el('select'),origin=el('div'),target=el('div'),preview=el('div'),just=el('textarea'),find=el('div'),productName=el('span','Sin seleccionar'),warehouse=el('select');
 code.value='Automático';code.disabled=true;reason.append(opt('','Seleccione motivo'));just.rows=3;just.maxLength=4000;
 let selected=null,product=null,creationToken=uuid(),creating=false;
 const save=btn('Guardar',async()=>{
  if(!selected||!reason.value||just.value.trim().length<10){error(status,{message:'Seleccione una salida, motivo y justificación de al menos diez caracteres.'});return;}
  if(Number(reason.value)===201&&!product){error(status,{message:'Seleccione el producto realmente entregado.'});return;}
  if(Number(reason.value)===203&&!warehouse.value){error(status,{message:'Seleccione la bodega real.'});return;}
  if(creating)return;creating=true;save.disabled=true;close.disabled=true;
  try{const data={motivo_codigo:Number(reason.value),kardex_id:Number(selected.id),justificacion:just.value.trim(),token_creacion:creationToken};
   if(data.motivo_codigo===201)data.producto_real_id=Number(product.id);if(data.motivo_codigo===203)data.bodega_real_id=Number(warehouse.value);
   const result=await api().inventoryCreateAdjustment(data);d.close();void reload();void detail(result.id,reload);
  }catch(e){error(status,e);}finally{creating=false;save.disabled=false;close.disabled=false;}
 },'button primary');
 function redraw(){
  target.replaceChildren();preview.replaceChildren();
  if(!selected||!reason.value)return;
  const c=Number(reason.value),q=num(selected.cantidad);
  if(c===201){target.append(field('Producto realmente entregado',productName),btn('Buscar producto',async()=>{try{const p=await window.RutaHDBuscadorProductos.openSingle({title:'Producto realmente entregado',excludeIds:[Number(selected.producto_id)]});if(p&&d.open){product=Array.isArray(p)?p[0]:p;productName.textContent=product.sku+' · '+product.nombre;redraw();}}catch(e){error(status,e);}}));}
  if(c===203)target.append(field('Bodega real de salida',warehouse));
  const t=table(['Producto','Bodega','Movimiento disponible']);
  row(t.b,[selected.producto,selected.bodega,'+'+q]);
  if(c===201)row(t.b,[product?.nombre||'Por seleccionar',selected.bodega,'−'+q]);
  if(c===203)row(t.b,[selected.producto,warehouse.selectedOptions[0]?.textContent||'Por seleccionar','−'+q]);
  preview.append(el('h3','Vista previa de movimientos'),t.wrap,el('p','La autorización y confirmación posterior son obligatorias. No modifica el DTE original.'));
 }
 warehouse.onchange=redraw;reason.onchange=()=>{product=null;productName.textContent='Sin seleccionar';redraw();};
 const selectOrigin=async item=>{try{const k=await api().inventoryOrigin(item.id);if(!d.open)return;selected=k;product=null;productName.textContent='Sin seleccionar';origin.textContent=k.producto+' · '+k.bodega+' · '+num(k.cantidad)+' unidades · Kardex '+k.id+' · Folio '+(k.folio||'interno');warehouse.replaceChildren(opt('','Seleccione bodega'));for(const b of warehouses.filter(b=>Number(b.id)!==Number(k.bodega_id)))warehouse.append(opt(b.id,b.nombre));redraw();}catch(e){error(status,e);}};
 let warehouses=[];
 d.addEventListener('cancel',e=>{if(creating)e.preventDefault();});
 content.append(field('Código',code),el('h3','Documento de referencia'),find,origin,field('Motivo',reason),target,preview,field('Justificación obligatoria',just),status);foot.append(btn('Cerrar',()=>{if(!creating)d.close();}),save);save.disabled=true;
 (async()=>{try{const [c,w]=await Promise.all([api().inventoryCatalogs(1,'',true),api().inventoryWarehouses()]);if(!d.open)return;warehouses=w;for(const m of c.data||[])reason.append(opt(m.codigo,m.nombre));save.disabled=false;
  paged(find,['Kardex','Folio','Producto','Bodega','Cantidad','Acciones'],(p,q)=>api().inventoryCandidates(p,q),(b,k)=>row(b,[k.id,k.folio,k.producto,k.bodega,num(k.cantidad)],window.RutaHDListUI.action('Seleccionar salida '+k.id,()=>selectOrigin(k),{kind:'ver'})));
 }catch(e){error(status,e);}})();
}
function confirmAction(action){
 return new Promise(resolve=>{
  const {d,content,foot}=modal(action==='confirmar'?'Confirmar ajuste':action==='aprobar'?'Aprobar ajuste':'Anular ajuste');
  let result=null;const reason=el('textarea'),status=el('p',null,'hd-doc-status');reason.rows=3;reason.maxLength=1000;
  if(action==='confirmar')content.append(el('p','Se aplicarán los movimientos de inventario al Kardex y al stock. La operación no cambia documentos tributarios.'));else content.append(field('Motivo obligatorio',reason));
  content.append(status);foot.append(btn('Volver',()=>d.close()),btn('Confirmar',()=>{if(action!=='confirmar'&&reason.value.trim().length<3){error(status,{message:'Ingrese un motivo de al menos tres caracteres.'});return;}result=action==='confirmar'?'confirmado':reason.value.trim();d.close();},'button primary'));
  d.addEventListener('close',()=>resolve(result),{once:true});
 });
}
async function detail(id,reload){
 const {d,content,foot,close}=modal('Ajuste rápido'),status=el('p','Cargando…','hd-doc-status');content.append(status);foot.append(btn('Cerrar',()=>d.close()));
 try{const x=await api().inventoryAdjustment(id);if(!d.open)return;const o=x.operacion,t=table(['SKU','Producto','Bodega','Disponible actual','Variación','Kardex']);
  for(const l of x.detalles)row(t.b,[l.sku,l.producto,l.bodega,num(l.disponible),num(l.delta_disponible),l.kardex_id||'Pendiente']);
  status.textContent='';content.replaceChildren(el('h3',o.numero_interno+' · '+o.estado_nombre),el('p',o.motivo_nombre_snapshot),el('p','Referencia Kardex '+o.referencia_kardex_id+' · Folio '+(o.referencia_folio||'interno')),el('p',o.justificacion),t.wrap,el('p','Revisión tributaria: '+o.revision_tributaria),status);
  const pending=o.estado_codigo==='INV_PEND_APROBACION',approved=o.estado_codigo==='INV_APROBADA';let busy=false;const token=uuid();d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  const addAction=(label,action,permission)=>{if(!can(permission))return;const b=btn(label,async()=>{if(busy)return;
   const data={version:Number(o.version)};const decision=await confirmAction(action);if(decision===null||!d.open)return;if(action==='confirmar')data.token_confirmacion=token;else data.motivo=decision;
   busy=true;close.disabled=true;for(const control of foot.querySelectorAll('button'))control.disabled=true;
   try{await api().inventoryAdjustmentAction(id,action,data);d.close();void reload();if(action!=='anular')void detail(id,reload);}catch(e){error(status,e);}finally{busy=false;close.disabled=false;for(const control of foot.querySelectorAll('button'))control.disabled=false;}
  },action==='anular'?'button ghost':'button primary');foot.append(b);};
  if(pending)addAction('Aprobar','aprobar','inventario.operaciones.aprobar');
  if(pending||approved)addAction('Anular','anular','inventario.operaciones.anular');
  if(approved)addAction('Confirmar ajuste','confirmar','inventario.operaciones.confirmar');
 }catch(e){error(status,e);}
}
function generalAdjustments(root){
 let reload=()=>{};
 reload=paged(root,['Número','Motivo','Fecha','Estado','Acciones'],(p,q)=>api().generalAdjustments(p,q),(b,m)=>row(b,[m.numero_interno,m.motivo_nombre_snapshot,m.creado_en,m.estado_nombre],window.RutaHDListUI.action('Ver '+m.numero_interno,()=>generalDetail(m.id,reload),{kind:'ver'})),{newAction:can('inventario.operaciones.gestionar')?()=>generalCreate(reload):null});
}
function generalCreate(reload){
 const {d,content,foot,close}=modal('Nuevo ajuste general'),status=el('p',null,'hd-doc-status'),code=input(),reason=el('select'),warehouse=el('select'),productText=el('span','Sin seleccionar'),qty=input(),just=el('textarea'),files=input('file'),preview=el('section'),grid=el('div',null,'hd-doc-filter'),fileSummary=el('p');
 code.value='Automático';code.disabled=true;reason.append(opt('','Seleccione motivo'));for(const [v,t] of [[101,'Sobrante de inventario'],[102,'Faltante de inventario'],[107,'Mercadería encontrada']])reason.append(opt(v,t));
 warehouse.append(opt('','Seleccione bodega'));qty.inputMode='decimal';qty.placeholder='0,00000000';just.rows=3;just.maxLength=4000;files.multiple=true;files.accept='.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
 let product=null,busy=false,reviewed=null,seq=0,token=uuid(),submitted=false;
 const data=()=>({motivo_codigo:Number(reason.value),producto_id:Number(product?.id||0),bodega_id:Number(warehouse.value),cantidad:qty.value.trim().replace(',','.')});
 const fingerprint=()=>JSON.stringify(data());
 const invalidate=()=>{seq++;reviewed=null;preview.replaceChildren();save.disabled=true;};
 const search=btn('Buscar producto',async()=>{try{const p=await window.RutaHDBuscadorProductos.openSingle({title:'Producto del ajuste'});if(p&&d.open){product=Array.isArray(p)?p[0]:p;productText.textContent=product.sku+' · '+product.nombre;invalidate();}}catch(e){error(status,e);}});
 const lock=on=>{busy=on;close.disabled=on;for(const x of [reason,warehouse,qty,just,files,search,review,back])x.disabled=on||submitted;save.disabled=on||!reviewed;};
 const review=btn('Revisar ajuste',async()=>{if(busy||submitted)return;const v=data();if(!v.motivo_codigo||!v.producto_id||!v.bodega_id||!/^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,8})?$/.test(v.cantidad)||!Number(v.cantidad)){error(status,{message:'Seleccione motivo, producto, bodega y una cantidad positiva de hasta ocho decimales.'});return;}
  invalidate();const ticket=seq;review.disabled=true;status.textContent='Revisando…';try{const x=await api().generalAdjustmentPreview(v);if(!d.open||ticket!==seq)return;const p=x.plan;const t=table(['Concepto','Anterior','Posterior']);row(t.b,['Disponible',num(p.disponible_anterior),num(p.disponible_actual)]);row(t.b,['Físico',num(p.fisico_anterior),num(p.fisico_actual)]);row(t.b,['CPP',num(p.cpp_anterior),num(p.cpp_actual)]);preview.append(el('h3','Revisión preliminar'),t.wrap,el('p','Valor del ajuste: $ '+num(p.valor_movimiento)),el('p','Tránsito y comprometido se conservan. Guardar no modifica stock.'));reviewed=fingerprint();save.disabled=false;status.textContent='';}catch(e){if(ticket===seq)error(status,e);}finally{if(d.open&&!busy&&!submitted)review.disabled=false;}
 },'button ghost');
 const back=btn('Cerrar',()=>{if(!busy)d.close();});
 const save=btn('Guardar',async()=>{if(busy||!reviewed||reviewed!==fingerprint())return;const fs=Array.from(files.files||[]);if(just.value.trim().length<10||!fs.length||fs.length>3||fs.reduce((n,f)=>n+f.size,0)>2097152){error(status,{message:'Ingrese una justificación de al menos diez caracteres y de uno a tres respaldos (2 MB en total).'});return;}
  const form=new FormData();for(const [k,v] of Object.entries(data()))form.append(k,String(v));form.append('justificacion',just.value.trim());form.append('token_creacion',token);for(const f of fs)form.append('respaldos[]',f);
  submitted=true;lock(true);status.textContent='Guardando…';try{const x=await api().generalAdjustmentCreate(form);d.close();void reload();void generalDetail(x.id,reload);}catch(e){error(status,e);status.append(document.createTextNode(' Puede reintentar el mismo guardado o cerrar y revisar el listado.'));}finally{if(d.open){lock(false);back.disabled=false;}}
 },'button primary');save.disabled=true;review.disabled=true;
 for(const x of [reason,warehouse,qty])x.addEventListener('input',invalidate);
 files.onchange=()=>{const fs=Array.from(files.files||[]);fileSummary.textContent=fs.map(f=>f.name).join(' · ');};
 grid.append(field('Código',code),field('Motivo',reason),field('Bodega',warehouse),field('Cantidad',qty));
 content.append(grid,field('Producto',productText),search,review,preview,field('Justificación obligatoria',just),field('Respaldos (PDF, JPG, PNG)',files),el('p','Máximo tres archivos y 2 MB en total.'),fileSummary,status);foot.append(back,save);
 d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 (async()=>{try{const w=await api().inventoryWarehouses();if(!d.open)return;for(const b of w)warehouse.append(opt(b.id,b.nombre));if(w.length===1)warehouse.value=String(w[0].id);review.disabled=!w.length;if(!w.length)error(status,{message:'No hay bodegas activas asignadas a la sucursal.'});}catch(e){error(status,e);}})();
}
async function generalDetail(id,reload){
 const {d,content,foot,close}=modal('Ajuste general'),status=el('p','Cargando…','hd-doc-status');content.append(status);foot.append(btn('Cerrar',()=>d.close()));
 try{const x=await api().generalAdjustment(id);if(!d.open)return;const o=x.operacion,t=table(['SKU','Producto','Bodega','Cantidad','Variación','CPP','Kardex']);
 for(const l of x.detalles)row(t.b,[l.sku,l.producto,l.bodega,num(l.cantidad),num(l.delta_disponible),num(l.costo_unitario_snapshot),l.kardex_id||'Pendiente']);
 const attachments=el('section');attachments.append(el('h3','Respaldos'));for(const a of x.respaldos||[]){const b=btn(a.nombre,async()=>{b.disabled=true;try{const blob=await api().generalAdjustmentAttachment(id,a.id);const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=a.nombre;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error(status,e);}finally{b.disabled=false;}});attachments.append(b);}
 status.textContent='';content.replaceChildren(el('h3',o.numero_interno+' · '+o.estado_nombre),el('p',o.motivo_nombre_snapshot),el('p',o.justificacion),t.wrap,attachments,el('p','Revisión tributaria: '+o.revision_tributaria),status);
 let busy=false;const token=uuid();d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 const add=(label,action)=>{if(!can('inventario.operaciones.'+action))return;const b=btn(label,async()=>{if(busy)return;busy=true;let decision;try{decision=await confirmAction(action);if(decision===null||!d.open)return;const v={version:Number(o.version)};if(action==='confirmar')v.token_confirmacion=token;else v.motivo=decision;close.disabled=true;for(const c of foot.querySelectorAll('button'))c.disabled=true;await api().generalAdjustmentAction(id,action,v);d.close();void reload();if(action!=='anular')void generalDetail(id,reload);}catch(e){error(status,e);}finally{busy=false;close.disabled=false;for(const c of foot.querySelectorAll('button'))c.disabled=false;}},action==='anular'?'button ghost':'button primary');foot.append(b);};
 if(o.estado_codigo==='INV_PEND_APROBACION')add('Aprobar','aprobar');if(['INV_PEND_APROBACION','INV_APROBADA'].includes(o.estado_codigo))add('Anular','anular');if(o.estado_codigo==='INV_APROBADA')add('Confirmar ajuste','confirmar');
 }catch(e){error(status,e);}
}
window.RutaHDInventarioV104=Object.freeze({catalogs,adjustments,generalAdjustments});
})();
