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
function confirmAction(action,subject='ajuste'){
 return new Promise(resolve=>{
  const {d,content,foot}=modal((action==='confirmar'?'Confirmar ':action==='aprobar'?'Aprobar ':'Anular ')+subject);
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
function transfers(root){
 const section=el('section',null,'hd-documents hd-v67 surface-panel'),form=el('form',null,'hd-doc-filter hd-search-form'),bar=el('div',null,'hd-search-toolbar'),query=input('search'),search=el('button','Buscar','button primary'),advanced=el('div',null,'hd-doc-filter'),status=el('p',null,'hd-doc-status'),top=el('nav'),bottom=el('nav'),t=table(['Número','Origen','Destino','Modalidad','Fecha','Estado','Acciones']);
 query.placeholder='Búsqueda general';search.type='submit';advanced.hidden=true;
 const toggle=btn('Búsqueda avanzada',()=>{advanced.hidden=!advanced.hidden;toggle.setAttribute('aria-expanded',String(!advanced.hidden));});toggle.setAttribute('aria-expanded','false');
 const mode=el('select'),state=el('select'),from=el('select'),to=el('select');
 mode.append(opt('','Todas'),opt('INMEDIATO','Inmediato'),opt('DESPACHO_RECEPCION','Despacho y recepción'));
 state.append(opt('','Todos'));for(const [k,v] of [['BORRADOR','Solicitud'],['DESPACHADO','Despachado'],['PARCIAL','Recepción parcial'],['RECIBIDO','Recibido']])state.append(opt(k,v));
 from.append(opt('','Todas'));to.append(opt('','Todas'));
 let page=1,seq=0,term='',filters={},ready=false;
 const create=btn('+ Nuevo traspaso',()=>transferForm(null,load),'button primary hd-v70-new');create.hidden=true;create.style.marginInlineStart='auto';
 const clear=btn('Limpiar',()=>{query.value='';for(const n of [mode,state,from,to])n.value='';term='';filters={};void load(1);});
 bar.append(field('Buscar',query),search,toggle,create);advanced.append(field('Modalidad',mode),field('Estado',state),field('Bodega origen',from),field('Bodega destino',to),clear);form.append(bar,advanced);section.append(form,status,top,t.wrap,bottom);root.replaceChildren(section);
 function label(x){return x.estado_traspaso==='BORRADOR'?(x.estado_operacion==='INV_APROBADA'?'Aprobado':'Pendiente de aprobación'):({DESPACHADO:'Despachado',PARCIAL:'Recepción parcial',RECIBIDO:'Recibido'}[x.estado_traspaso]||x.estado_traspaso);}
 async function load(p=page){
  const ticket=++seq;page=p;status.textContent='Cargando…';try{
   const x=await api().transfers(page,term,filters);if(ticket!==seq||!section.isConnected)return;
   ready=x.escrituras_habilitadas===true;create.hidden=!(ready&&can('inventario.operaciones.gestionar'));t.b.replaceChildren();
   for(const m of x.data||[])row(t.b,[m.numero_interno,m.bodega_origen,m.bodega_destino,m.modalidad==='INMEDIATO'?'Inmediato':'Despacho y recepción',m.creado_en,label(m)],window.RutaHDListUI.action('Ver '+m.numero_interno,()=>transferDetail(m.id,load,ready),{kind:'ver'}));
   if(!(x.data||[]).length)empty(t.b,7,'Sin registros para esta búsqueda.');
   status.textContent='';const o={page:x.current_page||page,pages:x.last_page||1,total:x.total||0,autoTop:false,onPage:n=>{void load(n);section.scrollIntoView({block:'start'});}};
   window.RutaHDListUI.renderPager(top,o);window.RutaHDListUI.renderPager(bottom,o);
  }catch(e){if(ticket===seq){create.hidden=true;error(status,e);}}
 }
 form.onsubmit=e=>{e.preventDefault();term=query.value.trim();filters={};for(const [k,n] of [['modalidad',mode],['estado',state],['bodega_origen_id',from],['bodega_destino_id',to]])if(n.value)filters[k]=n.value;void load(1);};
 void load();void(async()=>{try{const x=await api().transferWarehouses();if(!section.isConnected)return;for(const b of x.bodegas||[]){from.append(opt(b.id,b.nombre));to.append(opt(b.id,b.nombre));}}catch(e){if(section.isConnected)error(status,e);}})();
}
function transferForm(existing,reload){
 const receiving=!!existing,t=existing?.traspaso,{d,content,foot,close}=modal(receiving?'Nueva recepción de traspaso':'Nuevo traspaso'),status=el('p',null,'hd-doc-status'),code=input(),from=el('select'),to=el('select'),mode=el('select'),just=el('textarea'),grid=el('div',null,'hd-doc-filter'),items=table(['SKU','Producto','Cantidad','Acciones']),entries=new Map();
 let busy=false,submitted=false;const token=uuid();code.value='Automático';code.disabled=true;just.rows=3;just.maxLength=4000;mode.append(opt('INMEDIATO','Inmediato'),opt('DESPACHO_RECEPCION','Despacho y recepción'));from.append(opt('','Seleccione origen'));to.append(opt('','Seleccione destino'));
 function redraw(){items.b.replaceChildren();for(const [id,e] of entries){const tr=el('tr'),qty=e.qty;tr.append(el('td',e.sku),el('td',e.nombre));const c=el('td');c.append(qty);tr.append(c);const a=el('td');a.append(window.RutaHDListUI.action('Quitar '+e.sku,()=>{if(!submitted){entries.delete(id);redraw();}},{kind:'eliminar'}));tr.append(a);items.b.append(tr);}if(!entries.size)empty(items.b,4,'Agregue productos.');}
 function append(p,quantity=''){const id=Number(p.producto_id??p.id);if(!Number.isSafeInteger(id)||id<=0||entries.has(id)||entries.size>=50)return;const qty=input();qty.inputMode='decimal';qty.value=quantity;qty.setAttribute('aria-label','Cantidad '+p.sku);entries.set(id,{sku:p.sku,nombre:p.nombre??p.producto,qty});}
 const find=btn('Buscar producto',async()=>{if(submitted)return;try{const p=await window.RutaHDBuscadorProductos.openSingle({title:'Producto del traspaso',excludeIds:[...entries.keys()]});if(p&&d.open){append(Array.isArray(p)?p[0]:p);redraw();}}catch(e){error(status,e);}});
 if(receiving){for(const p of existing.detalles||[])if(!/^0(?:\.0+)?$/.test(String(p.pendiente_recepcion)))append(p,'');grid.append(field('Código',code),el('p',t.numero_interno+' · '+t.bodega_destino));}else grid.append(field('Código',code),field('Origen',from),field('Destino',to),field('Modalidad',mode));
 const back=btn('Cerrar',()=>{if(!busy)d.close();});
 const save=btn('Guardar',async()=>{if(busy)return;const payload={items:[],justificacion:just.value.trim(),token_creacion:token};
  for(const [id,e] of entries){const q=e.qty.value.trim().replace(',','.');if(receiving&&!q)continue;if(!/^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,8})?$/.test(q)||/^0(?:\.0+)?$/.test(q)){error(status,{message:'Ingrese cantidades positivas de hasta ocho decimales.'});return;}payload.items.push({producto_id:id,cantidad:q});}
  if(!payload.items.length||payload.justificacion.length<10){error(status,{message:'Ingrese productos y una justificación de al menos diez caracteres.'});return;}
  if(!receiving){if(!from.value||!to.value||from.value===to.value){error(status,{message:'Seleccione dos bodegas diferentes.'});return;}Object.assign(payload,{bodega_origen_id:Number(from.value),bodega_destino_id:Number(to.value),modalidad:mode.value});}
  busy=true;submitted=true;close.disabled=true;back.disabled=true;save.disabled=true;for(const n of content.querySelectorAll('input,select,textarea,button'))n.disabled=true;
  try{const x=receiving?await api().transferReceiptCreate(t.id,payload):await api().transferCreate(payload);d.close();void reload();void transferDetail(receiving?t.id:x.id,reload,true);}catch(e){error(status,e);status.append(document.createTextNode(' Puede reintentar el mismo guardado o cerrar y revisar el listado.'));}finally{busy=false;if(d.open){close.disabled=false;back.disabled=false;save.disabled=false;}}
 },'button primary');save.disabled=!receiving;content.append(grid,el('h3','Productos'));if(!receiving)content.append(find);else content.append(el('p','Deje vacías las cantidades que no recibirá en esta operación.'));content.append(items.wrap,field('Justificación obligatoria',just),status);foot.append(back,save);redraw();
 d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 if(!receiving)void(async()=>{try{const x=await api().transferWarehouses();if(!d.open)return;for(const b of x.bodegas||[]){from.append(opt(b.id,b.nombre));to.append(opt(b.id,b.nombre));}save.disabled=(x.bodegas||[]).length<2;}catch(e){error(status,e);}})();
}
async function transferDetail(id,reload,ready=false){
 const {d,content,foot,close}=modal('Traspaso de inventario'),status=el('p','Cargando…','hd-doc-status');content.append(status);foot.append(btn('Cerrar',()=>d.close()));
 try{const x=await api().transfer(id);if(!d.open)return;const h=x.traspaso,t=table(['SKU','Producto','Solicitada','Despachada','Recibida','Pendiente','CPP despacho']),ops=el('section');
 for(const l of x.detalles||[])row(t.b,[l.sku,l.producto,num(l.cantidad_solicitada),num(l.cantidad_despachada),num(l.cantidad_recibida),num(l.pendiente_recepcion),num(l.costo_cpp_snapshot)]);
 ops.append(el('h3','Operaciones'));let busy=false;const tokens=new Map();d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 const add=(host,label,action,o,receipt=false)=>{const permission=action==='despachar'?'confirmar':action;if(!ready||x.escrituras_habilitadas!==true||!can('inventario.operaciones.'+permission))return;const b=btn(label,async()=>{if(busy)return;busy=true;try{
   const decision=await confirmAction(action==='despachar'?'confirmar':action,receipt?'recepción de traspaso':'traspaso');if(decision===null||!d.open)return;const data={version:Number(o.version)};
   if(['confirmar','despachar'].includes(action)){if(!tokens.has(o.id))tokens.set(o.id,uuid());data.token_confirmacion=tokens.get(o.id);}else data.motivo=decision;
   close.disabled=true;for(const n of d.querySelectorAll('button'))n.disabled=true;
   if(receipt)await api().transferReceiptAction(id,o.id,action,data);else await api().transferAction(id,action,data);
   d.close();void reload();if(receipt||action!=='anular')void transferDetail(id,reload,true);
  }catch(e){error(status,e);}finally{busy=false;close.disabled=false;for(const n of d.querySelectorAll('button'))n.disabled=false;}},action==='anular'?'button ghost':'button primary');host.append(b);};
 for(const o of x.operaciones||[]){const sub=el('section',null,'surface-panel'),actions=el('div',null,'hd-doc-filter'),dt=table(['SKU','Cantidad','Disponible Δ','Tránsito Δ','Kardex']);
  for(const l of o.detalles||[])row(dt.b,[l.sku,num(l.cantidad),num(l.delta_disponible),num(l.delta_transito),l.kardex_id||'Pendiente']);
  sub.append(el('h4',o.numero_interno+' · '+o.etapa+' · '+o.estado_nombre),el('p',o.justificacion),dt.wrap,actions);ops.append(sub);
  const receipt=o.etapa==='RECEPCION';if(o.estado==='INV_PEND_APROBACION'&&Number(o.creado_por)!==Number(x.usuario_actual_id))add(actions,'Aprobar','aprobar',o,receipt);
  if(['INV_PEND_APROBACION','INV_APROBADA'].includes(o.estado))add(actions,'Anular','anular',o,receipt);
  if(o.estado==='INV_APROBADA')add(actions,receipt?'Confirmar recepción':o.etapa==='DESPACHO'?'Despachar':'Confirmar traspaso',o.etapa==='DESPACHO'?'despachar':'confirmar',o,receipt);
 }
 status.textContent='';content.replaceChildren(el('h3',h.numero_interno+' · '+h.estado_traspaso),el('p',h.bodega_origen+' → '+h.bodega_destino),el('p',h.justificacion),t.wrap,ops,status);
 const pdf=btn('Comprobante PDF',async()=>{if(busy)return;pdf.disabled=true;try{const blob=await api().transferPdf(id);if(!d.open)return;const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='traspaso-'+id+'.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){error(status,e);}finally{pdf.disabled=false;}},'button ghost');foot.append(pdf);

 if(ready&&x.escrituras_habilitadas===true&&can('inventario.operaciones.gestionar')&&['DESPACHADO','PARCIAL'].includes(h.estado_traspaso)&&!x.recepcion_activa)foot.append(btn('Nueva recepción',()=>{d.close();transferForm(x,reload);},'button primary'));
 }catch(e){error(status,e);}
}
function counts(root){
 const section=el('section',null,'hd-documents hd-v67 surface-panel'),form=el('form',null,'hd-doc-filter hd-search-form'),bar=el('div',null,'hd-search-toolbar'),query=input('search'),search=el('button','Buscar','button primary'),advanced=el('div',null,'hd-doc-filter'),status=el('p',null,'hd-doc-status'),top=el('nav'),bottom=el('nav'),t=table(['Número','Bodega','Alcance','Conteo ciego','Fecha corte','Estado','Acciones']);
 const state=el('select'),warehouse=el('select');state.append(opt('','Todos'));warehouse.append(opt('','Todas'));
 const labels={BORRADOR:'Borrador',EN_CONTEO:'En conteo',EN_REVISION:'En revisión',CONFIRMADO:'Confirmado'};
 for(const [k,v] of Object.entries(labels))state.append(opt(k,v));
 query.placeholder='Búsqueda general';search.type='submit';advanced.hidden=true;
 const toggle=btn('Búsqueda avanzada',()=>{advanced.hidden=!advanced.hidden;toggle.setAttribute('aria-expanded',String(!advanced.hidden));});toggle.setAttribute('aria-expanded','false');
 let page=1,seq=0,term='',filters={},ready=false;
 const create=btn('+ Nuevo conteo',()=>countForm(load),'button primary hd-v70-new');create.hidden=true;create.style.marginInlineStart='auto';
 bar.append(field('Buscar',query),search,toggle,create);
 advanced.append(field('Estado',state),field('Bodega',warehouse),btn('Limpiar',()=>{query.value='';state.value='';warehouse.value='';term='';filters={};void load(1);}));
 form.append(bar,advanced);section.append(form,status,top,t.wrap,bottom);root.replaceChildren(section);
 async function load(p=page){const ticket=++seq;page=p;status.textContent='Cargando…';create.hidden=true;try{
  const x=await api().counts(page,term,filters);if(ticket!==seq||!section.isConnected)return;
  ready=x.escrituras_habilitadas===true;create.hidden=!(ready&&can('inventario.operaciones.gestionar'));t.b.replaceChildren();
  for(const m of x.data||[])row(t.b,[m.numero_interno,m.bodega,m.alcance,Number(m.conteo_ciego)?'Sí':'No',m.fecha_corte,labels[m.estado]||m.estado],window.RutaHDListUI.action('Ver '+m.numero_interno,()=>countDetail(m.id,load,ready),{kind:'ver'}));
  if(!(x.data||[]).length)empty(t.b,7,'Sin registros para esta búsqueda.');
  status.textContent=ready?'':'Consulta de conteos. Operaciones de escritura aún no habilitadas.';
  const o={page:x.current_page||page,pages:x.last_page||1,total:x.total||0,autoTop:false,onPage:n=>{void load(n);section.scrollIntoView({block:'start'});}};
  window.RutaHDListUI.renderPager(top,o);window.RutaHDListUI.renderPager(bottom,o);
 }catch(e){if(ticket===seq){ready=false;error(status,e);}}}
 form.onsubmit=e=>{e.preventDefault();term=query.value.trim();filters={};if(state.value)filters.estado=state.value;if(warehouse.value)filters.bodega_id=warehouse.value;void load(1);};
 void load();void(async()=>{try{const x=await api().transferWarehouses();if(section.isConnected)for(const b of x.bodegas||[])warehouse.append(opt(b.id,b.nombre));}catch(e){if(section.isConnected)error(status,e);}})();
}
function countForm(reload){
 const {d,content,foot,close}=modal('Nuevo conteo selectivo'),status=el('p',null,'hd-doc-status'),code=input(),warehouse=el('select'),blind=input('checkbox'),items=table(['SKU','Producto','Acciones']),entries=new Map();
 code.value='Automático';code.disabled=true;warehouse.append(opt('','Seleccione bodega'));blind.checked=true;
 const token=uuid();let busy=false,submitted=false;
 function redraw(){items.b.replaceChildren();for(const [id,p] of entries)row(items.b,[p.sku,p.nombre??p.producto],window.RutaHDListUI.action('Quitar '+p.sku,()=>{if(!submitted){entries.delete(id);redraw();}},{kind:'eliminar'}));if(!entries.size)empty(items.b,3,'Agregue hasta 50 productos.');}
 const find=btn('Buscar producto',async()=>{if(submitted)return;try{const p=await window.RutaHDBuscadorProductos.openSingle({title:'Producto del conteo',excludeIds:[...entries.keys()]});if(!p||!d.open)return;const x=Array.isArray(p)?p[0]:p,id=Number(x.producto_id??x.id);if(Number.isSafeInteger(id)&&id>0&&entries.size<50)entries.set(id,x);redraw();}catch(e){error(status,e);}});
 const back=btn('Cerrar',()=>{if(!busy)d.close();});
 const save=btn('Iniciar conteo',async()=>{if(busy)return;if(!warehouse.value||!entries.size){error(status,{message:'Seleccione bodega y productos.'});return;}
  busy=true;submitted=true;close.disabled=true;back.disabled=true;save.disabled=true;for(const n of content.querySelectorAll('input,select,button'))n.disabled=true;
  try{const x=await api().countCreate({bodega_id:Number(warehouse.value),productos:[...entries.keys()],conteo_ciego:blind.checked,token_creacion:token});d.close();void reload();void countDetail(x.id,reload,true);}
  catch(e){error(status,e);status.append(document.createTextNode(' Puede reintentar la misma solicitud o cerrar y revisar el listado.'));}
  finally{busy=false;if(d.open){close.disabled=false;back.disabled=false;save.disabled=false;}}
 },'button primary');save.disabled=true;
 content.append(field('Código',code),field('Bodega',warehouse),field('Conteo ciego',blind),el('p','Al iniciar se registra el saldo de corte. No modifica stock.'),find,items.wrap,status);foot.append(back,save);redraw();
 d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 void(async()=>{try{const x=await api().transferWarehouses();if(!d.open)return;for(const b of x.bodegas||[])warehouse.append(opt(b.id,b.nombre));if((x.bodegas||[]).length===1)warehouse.value=String(x.bodegas[0].id);save.disabled=!(x.bodegas||[]).length;}catch(e){error(status,e);}})();
}
function countMeasurement(id,line,action,reload){
 const {d,content,foot,close}=modal(action==='contar'?'Registrar conteo':'Registrar reconteo'),qty=input(),obs=el('textarea'),status=el('p',null,'hd-doc-status');qty.inputMode='decimal';qty.placeholder='0';obs.maxLength=1000;obs.rows=3;
 let busy=false,submitted=false;const back=btn('Cerrar',()=>{if(!busy)d.close();});
 const save=btn('Guardar',async()=>{if(busy)return;const q=qty.value.trim().replace(',','.');if(!/^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,8})?$/.test(q)){error(status,{message:'Ingrese cantidad no negativa de hasta ocho decimales.'});return;}
 busy=true;submitted=true;qty.disabled=true;obs.disabled=true;close.disabled=true;back.disabled=true;save.disabled=true;
 try{await api().countMeasure(id,line.id,action,{cantidad:q,observaciones:obs.value.trim()});d.close();void reload();void countDetail(id,reload,true);}catch(e){error(status,e);}finally{busy=false;if(d.open){close.disabled=false;back.disabled=false;save.disabled=false;}}
 },'button primary');
 content.append(el('h3',line.sku+' · '+line.producto),field('Cantidad física',qty),field('Observaciones',obs),status);foot.append(back,save);d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
}
async function countDetail(id,reload,ready=false){
 const {d,content,foot,close}=modal('Conteo de inventario'),status=el('p','Cargando…','hd-doc-status');content.append(status);foot.append(btn('Cerrar',()=>d.close()));
 try{const x=await api().count(id);if(!d.open)return;const h=x.conteo,blind=!!Number(h.conteo_ciego)&&h.estado==='EN_CONTEO',write=ready&&x.escrituras_habilitadas===true,uid=Number(x.usuario_actual_id),t=table(['SKU','Producto',...(blind?[]:['Saldo de corte']),'Conteo','Reconteo','Acciones']);
 const value=(l,key,flag)=>l[key]!==undefined&&l[key]!==null?num(l[key]):l[flag]?'Registrado':'Pendiente';
 for(const l of x.detalles||[]){const a=el('div');if(write&&h.estado==='EN_CONTEO'&&can('inventario.operaciones.gestionar')){
  if(!(l.contado||l.cantidad_contada!==undefined&&l.cantidad_contada!==null))a.append(window.RutaHDListUI.action('Contar '+l.sku,()=>{d.close();countMeasurement(id,l,'contar',reload);},{kind:'editar'}));
  else if(Number(l.contado_por)!==uid&&!(l.recontado||l.cantidad_recontada!==undefined&&l.cantidad_recontada!==null))a.append(window.RutaHDListUI.action('Recontar '+l.sku,()=>{d.close();countMeasurement(id,l,'recontar',reload);},{kind:'editar'}));
 }row(t.b,[l.sku,l.producto,...(blind?[]:[num(l.saldo_corte)]),value(l,'cantidad_contada','contado'),value(l,'cantidad_recontada','recontado')],a);}
 status.textContent='';content.replaceChildren(el('h3',h.numero_interno+' · '+h.estado),el('p','Bodega '+h.bodega_id+' · Corte '+(h.fecha_corte||'Pendiente')),el('p',blind?'Conteo ciego: saldo de corte oculto.':'Consulta de cantidades registradas.'),t.wrap,status);
 if(['EN_REVISION','CONFIRMADO'].includes(h.estado)){
  const plans=x.revision?.planes||[],byId=new Map((x.detalles||[]).map(l=>[Number(l.producto_id),l])),reviewTable=table(['SKU','Producto','Saldo corte','Conteo final','Diferencia','Resultado']);
  for(const p of plans){const l=byId.get(Number(p.producto_id))||{};row(reviewTable.b,[l.sku||String(p.producto_id),l.producto||'—',num(p.esperado),num(p.contado),num(p.diferencia),p.resultado+(p.bloqueos?.length?' · Requiere regularización':'')]);}
  const summary=el('section',null,'surface-panel');summary.append(el('h3','Conciliación de inventario'),el('p','Cuadrados: '+plans.filter(p=>p.resultado==='CUADRADO').length+' · Sobrantes: '+plans.filter(p=>p.resultado==='SOBRANTE').length+' · Faltantes: '+plans.filter(p=>p.resultado==='FALTANTE').length),reviewTable.wrap,el('p',x.autorizado?'Diferencias autorizadas':'Autorización pendiente'),el('p',x.ajustes_preparados?'Ajustes preparados':'Preparación de ajustes pendiente'));
  if(!plans.length)summary.append(el('p','Sin revisión registrada disponible.'));
  for(const o of x.operaciones||[]){const dt=table(['SKU','Producto','Cantidad','Variación','CPP','Kardex']),sub=el('section',null,'surface-panel');
   for(const l of o.detalles||[])row(dt.b,[l.sku,l.producto,num(l.cantidad),num(l.delta_disponible),num(l.costo_unitario_snapshot),l.kardex_id||'Pendiente']);
   sub.append(el('h4',o.numero_interno+' · '+o.motivo_nombre_snapshot+' · '+o.estado_nombre),dt.wrap,el('p','Respaldos'));
   for(const f of o.respaldos||[]){if(f.id&&o.id)sub.append(btn(f.nombre,async()=>{try{const blob=await api().countAttachment(id,o.id,f.id);if(d.open)countDownload(blob,f.nombre);}catch(e){error(status,e);}}));else sub.append(el('p',f.nombre));}
   if(!(o.respaldos||[]).length)sub.append(el('p','Sin archivos'));summary.append(sub);
  }
  if(x.revision)foot.append(btn('Acta PDF',async()=>{try{const blob=await api().countPdf(id);if(d.open)countDownload(blob,'conteo-'+id+'.pdf');}catch(e){error(status,e);}},'button ghost'));
  content.insertBefore(summary,status);
  if(write&&h.estado==='EN_REVISION'&&can('inventario.operaciones.aprobar')&&!x.ajustes_preparados)foot.append(btn(x.autorizado?'Preparar ajustes':'Autorizar diferencias',()=>{d.close();countApproval(id,reload,x.autorizado);},'button primary'));
  if(write&&x.cierre_habilitado===true&&x.ajustes_preparados&&h.estado==='EN_REVISION'&&can('inventario.operaciones.confirmar'))foot.append(btn('Confirmar conteo',()=>{d.close();countClose(id,reload);},'button primary'));
 }
 if(write&&x.anulacion_habilitada===true&&['BORRADOR','EN_CONTEO','EN_REVISION'].includes(h.estado)&&can('inventario.operaciones.anular'))foot.append(btn('Anular conteo',()=>{d.close();countCancel(id,reload);}));
 if(write&&h.estado==='EN_CONTEO'&&can('inventario.operaciones.aprobar')){
 let busy=false;const review=btn('Enviar a revisión',async()=>{if(busy)return;busy=true;close.disabled=true;for(const n of foot.querySelectorAll('button'))n.disabled=true;
 try{await api().countAction(id,'revisar',{});d.close();void reload();void countDetail(id,reload,true);}catch(e){error(status,e);}finally{busy=false;close.disabled=false;for(const n of foot.querySelectorAll('button'))n.disabled=false;}},'button primary');foot.append(review);d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 }
 }catch(e){error(status,e);}
}
function countDownload(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function countApproval(id,reload,authorized){
 const {d,content,foot,close}=modal(authorized?'Preparar ajustes de conteo':'Autorizar diferencias'),status=el('p','Revalidando corte…','hd-doc-status'),preview=el('section'),reason=el('textarea'),files=input('file');
 reason.rows=3;reason.maxLength=1000;files.multiple=true;files.accept='.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
 let plan=null,busy=false,submitted=false;const back=btn('Cerrar',()=>{if(!busy)d.close();});
 const save=btn(authorized?'Preparar ajustes':'Autorizar',async()=>{if(busy||!plan?.puede_autorizar)return;let data;
  if(authorized){const fs=Array.from(files.files||[]),needs=Object.values(plan.grupos||{}).some(g=>g.length);if((needs&&!fs.length)||fs.length>3||fs.reduce((n,f)=>n+f.size,0)>2097152){error(status,{message:'Adjunte de uno a tres respaldos, máximo 2 MB en total, si existen diferencias.'});return;}data=new FormData();data.append('huella',plan.huella);for(const f of fs)data.append('respaldos[]',f);}
  else {if(reason.value.trim().length<10){error(status,{message:'Ingrese una justificación de al menos diez caracteres.'});return;}data={huella:plan.huella,motivo:reason.value.trim()};}
  busy=true;submitted=true;save.disabled=true;back.disabled=true;close.disabled=true;reason.disabled=true;files.disabled=true;
  try{await api().countAction(id,authorized?'preparar':'autorizar',data);d.close();void reload();void countDetail(id,reload,true);}catch(e){error(status,e);status.append(document.createTextNode(' Puede reintentar la misma solicitud o cerrar y revisar el detalle.'));}finally{busy=false;if(d.open){save.disabled=false;back.disabled=false;close.disabled=false;}}
 },'button primary');save.disabled=true;
 content.append(preview,authorized?field('Respaldos (PDF, JPG, PNG)',files):field('Justificación obligatoria',reason),el('p',authorized?'Máximo tres archivos y 2 MB en conjunto. Preparar no modifica stock.':'Autorizar no modifica stock.'),status);foot.append(back,save);d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 void(async()=>{try{const x=await api().countAction(id,'previsualizar',{});if(!d.open)return;plan=x;const t=table(['Producto ID','Esperado','Contado','Diferencia','Resultado']);for(const p of x.planes||[])row(t.b,[p.producto_id,num(p.esperado),num(p.contado),num(p.diferencia),p.resultado]);preview.append(t.wrap,el('p','Sobrantes: '+(x.grupos?.[101]||[]).length+' · Faltantes: '+(x.grupos?.[102]||[]).length));save.disabled=x.puede_autorizar!==true;status.textContent=save.disabled?'Existen diferencias no ajustables. No se permite autorizar.':'';}catch(e){error(status,e);}})();
}
function countClose(id,reload){
 const {d,content,foot,close}=modal('Confirmar conteo'),status=el('p','Revalidando…','hd-doc-status'),accept=input('checkbox');let plan=null,busy=false;const token=uuid(),back=btn('Cerrar',()=>{if(!busy)d.close();});
 const save=btn('Confirmar y cerrar',async()=>{if(busy||!accept.checked||!plan?.puede_autorizar)return;busy=true;save.disabled=true;back.disabled=true;close.disabled=true;accept.disabled=true;try{await api().countAction(id,'confirmar',{huella:plan.huella,token_confirmacion:token});d.close();void reload();void countDetail(id,reload,true);}catch(e){error(status,e);status.append(document.createTextNode(' Puede reintentar la misma confirmación.'));}finally{busy=false;if(d.open){save.disabled=false;back.disabled=false;close.disabled=false;}}},'button primary');save.disabled=true;accept.onchange=()=>{save.disabled=!accept.checked||!plan?.puede_autorizar;};
 content.append(el('p','Al confirmar se aplican todos los ajustes autorizados de forma conjunta. El CPP, tránsito y comprometido se conservan.'),field('Confirmo el cierre y los movimientos autorizados',accept),status);foot.append(back,save);d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 void(async()=>{try{plan=await api().countAction(id,'previsualizar',{});if(!d.open)return;status.textContent=plan.puede_autorizar?'Plan vigente.':'Plan no ajustable.';save.disabled=!accept.checked||!plan.puede_autorizar;}catch(e){error(status,e);}})();
}
function countCancel(id,reload){
 const {d,content,foot,close}=modal('Anular conteo'),reason=el('textarea'),status=el('p',null,'hd-doc-status');reason.rows=3;reason.maxLength=1000;let busy=false;
 const back=btn('Cerrar',()=>{if(!busy)d.close();});const save=btn('Anular conteo',async()=>{if(busy)return;if(reason.value.trim().length<10){error(status,{message:'Ingrese motivo de al menos diez caracteres.'});return;}busy=true;save.disabled=true;close.disabled=true;back.disabled=true;try{await api().countAction(id,'anular',{motivo:reason.value.trim()});d.close();void reload();}catch(e){error(status,e);}finally{busy=false;save.disabled=false;close.disabled=false;back.disabled=false;}},'button primary');
 content.append(el('p','Se conservará el historial. No se anulan movimientos confirmados.'),field('Motivo de anulación',reason),status);foot.append(back,save);d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
}

/* V109E5B1: consultas de reservas; sin mutaciones ni saldos acreditados. */
const reservationLabels={PENDIENTE:'Pendiente',ACTIVA:'Activa',PARCIAL:'Parcial',CONSUMIDA:'Consumida',LIBERADA:'Liberada'};
const reservationState=x=>reservationLabels[x]||'Estado no reconocido';
function reservations(root){
 const section=el('section',null,'hd-documents hd-v67 surface-panel'),form=el('form',null,'hd-doc-filter hd-search-form'),bar=el('div',null,'hd-search-toolbar'),query=input('search'),search=el('button','Buscar','button primary'),advanced=el('div',null,'hd-doc-filter'),status=el('p',null,'hd-doc-status'),top=el('nav'),bottom=el('nav'),t=table(['Número','Nota de venta','Creación','Vencimiento','Estado','Acciones']);
 const state=el('select'),warehouse=el('select'),note=input();note.inputMode='numeric';note.pattern='[1-9][0-9]*';note.placeholder='ID de nota de venta';
 state.append(opt('','Todos'));warehouse.append(opt('','Todas'));for(const [k,v] of Object.entries(reservationLabels))state.append(opt(k,v));
 query.placeholder='Folio, SKU o producto';query.maxLength=120;search.type='submit';advanced.hidden=true;
 const toggle=btn('Búsqueda avanzada',()=>{advanced.hidden=!advanced.hidden;toggle.setAttribute('aria-expanded',String(!advanced.hidden));});toggle.setAttribute('aria-expanded','false');
 top.setAttribute('aria-label','Paginación superior');bottom.setAttribute('aria-label','Paginación inferior');status.setAttribute('aria-live','polite');
 let page=1,seq=0,term='',filters={};
 bar.append(field('Buscar',query),search,toggle);
 advanced.append(field('Estado',state),field('Bodega',warehouse),field('Nota de venta',note),btn('Limpiar',()=>{query.value='';state.value='';warehouse.value='';note.value='';term='';filters={};void load(1);}));
 form.append(bar,advanced);section.append(form,status,top,t.wrap,bottom);root.replaceChildren(section);
 async function load(p=page){
  const ticket=++seq;page=p;status.textContent='Cargando reservas…';section.setAttribute('aria-busy','true');t.b.replaceChildren();top.replaceChildren();bottom.replaceChildren();
  try{
   const x=await api().reservations(page,term,filters);if(ticket!==seq||!section.isConnected)return;
   for(const m of x.data||[])row(t.b,[m.numero_interno,m.nota_venta_id?'NV #'+m.nota_venta_id:'—',m.creado_en,m.vence_en?(m.vence_en+(m.vencimiento_alcanzado?' · Vencida':'')):'Sin fecha',reservationState(m.estado)],window.RutaHDListUI.action('Ver '+m.numero_interno,()=>reservationDetail(m.id),{kind:'ver'}));
   if(!(x.data||[]).length)empty(t.b,6,'Sin reservas para esta búsqueda.');
   status.textContent='Consulta documental. Las operaciones de escritura no están habilitadas.';
   const o={page:x.current_page||page,pages:x.last_page||1,total:x.total||0,autoTop:false,onPage:n=>{void load(n);section.scrollIntoView({block:'start'});}};
   window.RutaHDListUI.renderPager(top,o);window.RutaHDListUI.renderPager(bottom,o);
  }catch(e){if(ticket===seq&&section.isConnected){error(status,e);empty(t.b,6,'No fue posible cargar las reservas.');}}
  finally{if(ticket===seq&&section.isConnected)section.setAttribute('aria-busy','false');}
 }
 form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;term=query.value.trim();filters={};if(state.value)filters.estado=state.value;if(warehouse.value)filters.bodega_id=warehouse.value;if(note.value.trim())filters.nota_venta_id=note.value.trim();void load(1);};
 void load();void(async()=>{try{const x=await api().transferWarehouses();if(section.isConnected)for(const b of x.bodegas||[])warehouse.append(opt(b.id,b.nombre));}catch(e){if(section.isConnected){warehouse.disabled=true;warehouse.title='No se pudo cargar el filtro de bodegas';}}})();
}
async function reservationDetail(id){
 const {d,content,foot}=modal('Ficha de reserva'),status=el('p','Cargando reserva…','hd-doc-status');
 status.setAttribute('aria-live','polite');content.append(status);content.setAttribute('aria-busy','true');foot.append(btn('Cerrar',()=>d.close()));
 try{
  const x=await api().reservation(id);if(!d.open)return;
  const h=x.reserva;if(!h)throw Error('No se encontró la ficha.');
  const summary=el('section',null,'surface-panel'),code=input();code.value=h.numero_interno||String(h.id);code.disabled=true;
  summary.append(el('h3',reservationState(h.estado)+(h.vencimiento_alcanzado?' · Vencida':'')),field('Número',code),el('p','Nota de venta: '+(h.nota_venta_id?'NV #'+h.nota_venta_id:'Sin referencia')),el('p','Creación: '+(h.creado_en||'—')+' · Vencimiento: '+(h.vence_en||'Sin fecha')));
  const lines=table(['SKU','Producto','Bodega','Cantidad solicitada','Liberada','Despachada','Solicitud pendiente','Saldo documental']);
  for(const l of x.detalles||[])row(lines.b,[l.sku,l.producto,l.bodega,num(l.cantidad_reservada),num(l.cantidad_liberada),num(l.cantidad_despachada),num(l.cantidad_solicitada_pendiente),num(l.saldo_documental)]);
  if(!(x.detalles||[]).length)empty(lines.b,8,'Sin productos.');
  const ops=table(['Número','Motivo','Estado','Creación','Aprobación','Confirmación']);
  for(const o of x.operaciones||[])row(ops.b,[o.numero_interno,o.motivo_nombre_snapshot||o.motivo_codigo_snapshot,o.estado,o.creado_en,o.aprobado_en,o.confirmado_en]);
  if(!(x.operaciones||[]).length)empty(ops.b,6,'Sin operaciones visibles.');
  status.textContent='Saldo documental de la reserva; no acredita stock disponible para operar.';
  content.replaceChildren(summary,el('h3','Productos de la reserva'),lines.wrap,el('h3','Operaciones asociadas'),ops.wrap,status);
  if(x.pdf_habilitado===true){
   const download=window.RutaHDListUI.action('Descargar comprobante PDF',async()=>{
    if(download.disabled||!d.open)return;download.disabled=true;
    try{const blob=await api().reservationPdf(id);if(d.open)countDownload(blob,'reserva-'+id+'.pdf');}
    catch(e){if(d.open)error(status,e);}finally{if(d.open)download.disabled=false;}
   },{kind:'pdf'});foot.append(download);
  }
 }catch(e){if(d.open)error(status,e);}
 finally{if(d.open)content.setAttribute('aria-busy','false');}
}
window.RutaHDInventarioV104=Object.freeze({catalogs,adjustments,generalAdjustments,transfers,counts,reservations});
})();
