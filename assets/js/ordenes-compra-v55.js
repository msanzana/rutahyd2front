/* Ruta H&D V55 · Órdenes de Compra.
 * No manipula recepciones ni inventario. Backend es fuente de estados y totales.
 * Productos limitados por proveedor desde la ENTRADA al buscador universal.
 */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const acl=()=>window.RutaHDAccesos;
 const ui=()=>window.RutaHDListUI;
 const el=(tag,text,cls)=>{
   const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);
   if(cls)n.className=cls;return n;
 };
 const btn=(title,click,style='ghost')=>{
   const n=el('button',title,'button '+style);n.type='button';n.addEventListener('click',click);return n;
 };
 const msg=e=>e?.userMessage||e?.message||'No se pudo completar la operación.';
 const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',
   minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
 const today=()=>{
   const n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000)
     .toISOString().slice(0,10);
 };
 const field=(title,input)=>{
   const wrap=el('label',null,'field');wrap.append(el('span',title),input);return wrap;
 };
 const readonly=(value,placeholder='Automático')=>{
   const input=el('input');input.type='text';input.readOnly=true;
   input.setAttribute('aria-readonly','true');
   input.value=value===null||value===undefined?placeholder:String(value);
   return input;
 };
 const action=(text,callback,kind='editar',danger=false)=>{
   return ui()?.action(text,callback,{kind,danger})||btn(text,callback);
 };
 const scroll=(root)=>root.scrollIntoView({block:'start',
   behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 function popup({title,subtitle='',kind='dialog'}={}){
   const dialog=el('dialog',null,'modal hd-oc-modal'+(kind==='editor'?' hd-oc-modal--editor':''));
   const box=el('section',null,'hd-oc-modal-body');
   const head=el('div',null,'hd-oc-modal-heading');
   head.append(el('div',null,'hd-oc-logo'));
   const heading=el('div');
   heading.append(el('span','RUTA H&D · COMPRAS','overline'),el('h2',title));
   if(subtitle)heading.append(el('p',subtitle));
   head.append(heading);
   const close=el('button','×','hd-oc-close');
   close.type='button';close.setAttribute('aria-label','Cerrar ventana');
   close.addEventListener('click',()=>dialog.close());
   head.append(close);box.append(head);dialog.append(box);
   document.body.append(dialog);
   dialog.addEventListener('close',()=>dialog.remove(),{once:true});
   dialog.showModal();
   return {dialog,box};
 }

 async function seleccionarProveedor(){
   return new Promise(resolve=>{
     const {dialog,box}=popup({title:'Seleccionar proveedor',
       subtitle:'El catálogo muestra proveedores activos con paginación real.'});
     const form=el('form',null,'hd-oc-inline-search');
     const search=el('input');search.type='search';search.maxLength=120;
     search.placeholder='Nombre o RUT del proveedor';
     search.setAttribute('aria-label','Buscar proveedor');
     const submit=el('button','Buscar','button primary');submit.type='submit';
     form.append(search,submit);box.append(form);
     const notice=el('p',null,'hd-oc-message');
     const top=el('nav',null,'list-pagination'),bottom=el('nav',null,'list-pagination');
     const table=el('div',null,'hd-oc-table-scroll');
     box.append(notice,top,table,bottom);
     let page=1,term='',sequence=0,selected=null;
     const renderPager=(response)=>{
       const totalPages=Number(response.last_page||1);
       for(const nav of [top,bottom]){
         ui()?.renderPager(nav,{page,pages:totalPages,total:Number(response.total||0),
           label:'proveedores',autoTop:false,onPage:n=>{page=n;void load();scroll(box);}});
         nav.hidden=totalPages<=1;
       }
     };
     async function load(){
       const ticket=++sequence;notice.textContent='Consultando proveedores…';
       try{
         const data=await api().orderSuppliers(page,term);
         if(!dialog.open||ticket!==sequence)return;
         table.replaceChildren();
         const tbl=el('table',null,'catalog-table hd-oc-table');
         const tr=el('tr');
         ['Proveedor','RUT','Correo electrónico','Acciones'].forEach(x=>tr.append(el('th',x)));
         tbl.append(el('thead'));tbl.tHead.append(tr);
         const body=el('tbody');
         for(const p of data.data||[]){
           const line=el('tr');
           [p.nombre,p.rut||'—',p.correo_electronico||'Sin correo'].forEach(x=>line.append(el('td',x)));
           const cell=el('td');cell.append(action('Seleccionar '+p.nombre,()=>{
             selected=p;dialog.close();
           },'seleccionar'));
           line.append(cell);body.append(line);
         }
         tbl.append(body);table.append(tbl);
         renderPager(data);
         notice.textContent=(data.total||0)+' proveedores encontrados.';
       }catch(e){if(ticket===sequence)notice.textContent=msg(e);}
     }
     form.addEventListener('submit',e=>{e.preventDefault();term=search.value.trim();page=1;void load();});
     dialog.addEventListener('close',()=>resolve(selected),{once:true});
     void load();
   });
 }

 async function mostrarPdf(id){
   const {dialog,box}=popup({title:'Ver documento Orden de Compra',
     subtitle:'Copia PDF protegida de la orden seleccionada.'});
   const note=el('p','Preparando documento PDF…','hd-oc-message');box.append(note);
   try{
     const blob=await api().purchaseOrderPdf(id);
     if(!dialog.open)return;
     const url=URL.createObjectURL(blob);
     const iframe=el('iframe');iframe.className='hd-oc-pdf-frame';
     iframe.title='Documento PDF de orden de compra';iframe.src=url;
     const link=el('a','Abrir PDF en nueva pestaña','button ghost');
     link.href=url;link.target='_blank';link.rel='noopener';
     note.replaceWith(link);box.append(iframe);
     dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});
   }catch(e){note.textContent=msg(e);note.classList.add('is-error');}
 }

 async function confirmarAnulacion(order,reload,notice){
   if(order.estado_codigo!=='ACTIVA')return;
   const {dialog,box}=popup({title:'¿Anular orden de compra?',
     subtitle:'Esta acción conserva el historial. No registra recepciones ni afecta existencias.'});
   const p=el('p','¿Deseas anular «'+order.numero+'»?','hd-oc-question');
   const row=el('div',null,'hd-oc-actions');
   row.append(btn('Cancelar',()=>dialog.close()),
     btn('Sí, anular',async()=>{
       try{
         await api().cancelPurchaseOrder(order.id);
         dialog.close();notice.textContent='Orden '+order.numero+' anulada.';
         await reload();
       }catch(e){p.textContent=msg(e);p.classList.add('is-error');}
     },'danger'));
   box.append(p,row);
 }

 async function editarOrden(order,onSaved){
   const editing=Boolean(order?.id);
   const {dialog,box}=popup({title:editing?'Editar orden de compra':'Nueva orden de compra',
     kind:'editor',subtitle:'Estado automático. No se registrarán recepciones ni movimientos de inventario.'});
   const notice=el('p',null,'hd-oc-message');
   notice.setAttribute('role','status');
   const form=el('form',null,'hd-oc-form');
   const identity=el('div',null,'hd-oc-identity');
   const code=readonly(order?.id);
   const number=readonly(order?.numero);
   const state=readonly(order?.estado_nombre||'Activa','Activa');
   identity.append(field('Código',code),field('Número de orden',number),field('Estado · Solo lectura',state));
   form.append(identity);
   const providerArea=el('div',null,'hd-oc-provider');
   const supplierInput=readonly(order?.proveedor_nombre||'','Selecciona un proveedor');
   const supplierButton=btn('Buscar proveedor',async()=>{
     const p=await seleccionarProveedor();if(!p)return;
     selectedProvider=p;
     supplierInput.value=p.nombre+' · '+(p.rut||'');
     detailFieldset.disabled=false;
     requested.disabled=false;
     observations.disabled=false;
     // El detalle de una OC debe pertenecer íntegramente al proveedor elegido.
     if(editing && Number(p.id)!==Number(order.proveedor_id)){
       lines.clear();drawLines();
     }else if(!editing && lines.size){lines.clear();drawLines();}
     notice.textContent='Proveedor seleccionado. Puedes incorporar sus productos.';
   },'ghost');
   providerArea.append(field('Proveedor *',supplierInput),supplierButton);
   form.append(providerArea);
   const grid=el('div',null,'hd-oc-fields');
   const requested=el('input');requested.type='date';requested.required=true;
   requested.value=String(order?.solicitada_en||today()).slice(0,10);
   requested.disabled=!editing;
   const received=readonly(order?.recibida_en?String(order.recibida_en).slice(0,10):'Pendiente');
   const observations=el('textarea');observations.rows=2;observations.maxLength=5000;
   observations.value=order?.observaciones||'';
   observations.disabled=!editing;
   grid.append(field('Fecha de solicitud *',requested),
     field('Fecha de recepción · Solo lectura',received),
     field('Observaciones',observations));
   form.append(grid);
   const detailFieldset=el('fieldset',null,'hd-oc-details');
   detailFieldset.disabled=!editing;
   const legend=el('legend','Detalle de productos');
   const tools=el('div',null,'hd-oc-details-tools');
   const add=btn('Buscar productos del proveedor',async()=>{
     if(!selectedProvider?.id)return;
     try{
       const selected=await window.RutaHDBuscadorProductos?.open({
         mode:'multiple',title:'Productos de '+selectedProvider.nombre,
         proveedorId:selectedProvider.id,context:'orden_compra',
         excludeIds:[...lines.keys()],
       });
       if(!selected?.length)return;
       for(const p of selected){
         if(!lines.has(Number(p.id))){
           lines.set(Number(p.id),{producto_id:Number(p.id),
             sku:p.sku||'',nombre:p.nombre||'',cantidad:'1.000',
             costo_unitario_neto:''});
         }
       }
       drawLines();
     }catch(e){notice.textContent=msg(e);notice.classList.add('is-error');}
   },'primary');
   tools.append(add);
   const tableRegion=el('div',null,'hd-oc-table-scroll');
   detailFieldset.append(legend,tools,tableRegion);
   form.append(detailFieldset);
   const totals=el('div',null,'hd-oc-totals');
   const subtotal=readonly(order?.subtotal_neto?'$ '+order.subtotal_neto:'$ 0,00');
   const taxes=readonly(order?.total_impuestos?'$ '+order.total_impuestos:'Calculado al guardar');
   const gross=readonly(order?.total_bruto?'$ '+order.total_bruto:'Calculado al guardar');
   totals.append(field('Subtotal neto estimado',subtotal),
     field('Impuestos · Servidor',taxes),field('Total bruto · Servidor',gross));
   form.append(totals);
   if(editing){
     const metadata=el('details',null,'hd-oc-audit');
     metadata.append(el('summary','Información de control · Solo lectura'));
     const auditGrid=el('div',null,'hd-oc-audit-grid');
     auditGrid.append(field('Creado por · ID',readonly(order?.creado_por??'—')),
       field('Creado en',readonly(order?.creado_en??'—')),
       field('Actualizado en',readonly(order?.actualizado_en??'—')));
     metadata.append(auditGrid);form.append(metadata);
   }
   const foot=el('div',null,'hd-oc-actions');
   const cancel=btn('Cancelar',()=>dialog.close());
   const save=el('button','Guardar','button primary');save.type='submit';
   foot.append(cancel,save);form.append(notice,foot);
   box.append(form);
   const lines=new Map();
   let selectedProvider=editing?{id:order.proveedor_id,
     nombre:order.proveedor_nombre,rut:order.proveedor_rut}:null;
   if(editing){
     for(const d of order.detalles||[]){
       lines.set(Number(d.producto_id),{
         producto_id:Number(d.producto_id),sku:d.sku||'',nombre:d.nombre||'',
         cantidad:String(d.cantidad),costo_unitario_neto:String(d.costo_unitario_neto)
       });
     }
   }
   function drawLines(){
     tableRegion.replaceChildren();
     const tbl=el('table',null,'hd-oc-table catalog-table');
     const header=el('tr');
     ['SKU / Producto','Cantidad','Costo unitario neto','Subtotal estimado','Acciones']
       .forEach(x=>header.append(el('th',x)));
     const th=el('thead');th.append(header);tbl.append(th);
     const tbody=el('tbody');
     let sum=0;
     for(const line of lines.values()){
       const row=el('tr');
       row.append(el('td',(line.sku?line.sku+' · ':'')+line.nombre));
       const qty=el('input');qty.type='number';qty.min='0.001';qty.max='999999';
       qty.step='0.001';qty.required=true;qty.value=line.cantidad;
       qty.setAttribute('aria-label','Cantidad de '+line.nombre);
       const cost=el('input');cost.type='number';cost.min='0.0001';cost.max='9999999';
       cost.step='0.0001';cost.required=true;cost.value=line.costo_unitario_neto;
       cost.setAttribute('aria-label','Costo neto de '+line.nombre);
       const est=el('span',null,'hd-oc-line-money');
       const recalc=()=>{
         line.cantidad=qty.value;line.costo_unitario_neto=cost.value;
         const v=Number(qty.value)*Number(cost.value);
         est.textContent=Number.isFinite(v)?money(v):'—';
         let amount=0;
         for(const item of lines.values()){
           const value=Number(item.cantidad)*Number(item.costo_unitario_neto);
           if(Number.isFinite(value))amount+=value;
         }
         subtotal.value=money(amount);
         taxes.value='Calculado al guardar';
         gross.value='Calculado al guardar';
       };
       qty.addEventListener('input',recalc);cost.addEventListener('input',recalc);
       const qtyTd=el('td'),costTd=el('td'),totalTd=el('td'),actionTd=el('td');
       qtyTd.append(qty);costTd.append(cost);totalTd.append(est);
       actionTd.append(action('Quitar '+line.nombre,()=>{
         lines.delete(Number(line.producto_id));drawLines();
       },'quitar',true));
       row.append(qtyTd,costTd,totalTd,actionTd);tbody.append(row);recalc();
     }
     tbl.append(tbody);tableRegion.append(tbl);
     if(!lines.size)tableRegion.append(el('p',
       'Selecciona un proveedor y agrega al menos un producto.',
       'hd-oc-empty'));
   }
   drawLines();
   if(editing&&order.estado_codigo!=='ACTIVA'){
     detailFieldset.disabled=true;supplierButton.disabled=true;save.disabled=true;
     notice.textContent='La orden ya no está activa y su historial es de solo lectura.';
   }
   form.addEventListener('submit',async event=>{
     event.preventDefault();
     if(!selectedProvider?.id){notice.textContent='Primero selecciona el proveedor.';return;}
     if(!lines.size){notice.textContent='Agrega al menos un producto del proveedor.';return;}
     if(!form.reportValidity())return;
     const detalles=[...lines.values()].map(p=>({
       producto_id:p.producto_id,cantidad:p.cantidad,
       costo_unitario_neto:p.costo_unitario_neto
     }));
     if(detalles.some(p=>!(Number(p.cantidad)>0)||!(Number(p.costo_unitario_neto)>0))){
       notice.textContent='Ingresa cantidad y costo neto positivo en cada línea.';return;
     }
     const data={proveedor_id:Number(selectedProvider.id),solicitada_en:requested.value,
       observaciones:observations.value.trim()||null,detalles};
     save.disabled=true;cancel.disabled=true;notice.textContent='Guardando orden de compra…';
     try{
       const response=editing?await api().updatePurchaseOrder(order.id,data)
         :await api().createPurchaseOrder(data);
       if(!dialog.open)return;
       if(response?.correo_enviado===false){
         notice.classList.add('is-error');
         notice.textContent=response.mensaje;
         const resend=btn('Reenviar aviso al proveedor',async()=>{
           resend.disabled=true;
           try{
             await api().resendPurchaseOrder(response.id);
             dialog.close();await onSaved('Orden guardada y correo reenviado.');
           }catch(e){
             notice.textContent=msg(e);resend.disabled=false;
           }
         },'ghost');
         foot.append(resend);
         save.remove();cancel.disabled=false;
       }else{
         dialog.close();
         await onSaved(response?.mensaje||'Orden guardada correctamente.');
       }
     }catch(e){
       notice.classList.add('is-error');notice.textContent=msg(e);
       save.disabled=false;cancel.disabled=false;
     }
   });
 }

 function mount(host){
   if(!host)return;
   host.replaceChildren();
   if(!acl()?.authenticated()||!acl()?.has('compras.gestionar')){
     host.append(el('p','No tienes permisos para acceder a Órdenes de Compra.'));
     return;
   }
   const root=el('section',null,'surface-panel hd-oc-module');
   const title=el('div',null,'panel-heading');
   const intro=el('div');
   intro.append(el('h2','Órdenes de Compra'),
     el('p','Gestión de órdenes, PDF y avisos al proveedor. Los estados se actualizan automáticamente.'));
   title.append(intro);
   const status=el('p',null,'hd-oc-message');
   status.setAttribute('role','status');
   const toolbar=el('div',null,'hd-oc-toolbar');
   const searchForm=el('form',null,'hd-oc-inline-search');
   const search=el('input');search.type='search';search.placeholder='Número, proveedor o RUT';
   search.setAttribute('aria-label','Buscar órdenes de compra');search.maxLength=120;
   const searchBtn=el('button','Buscar','button ghost');searchBtn.type='submit';
   const filter=el('select');filter.setAttribute('aria-label','Filtrar por estado');
   filter.append(new Option('Todos los estados',''));
   searchForm.append(search,filter,searchBtn);
   const newButton=btn('Nueva orden de compra',()=>void editarOrden(null,async note=>{
     status.textContent=note;await load();
   }),'primary');
   newButton.classList.add('hd-list-create-action');
   toolbar.append(searchForm,newButton);
   const navTop=el('nav',null,'list-pagination'),
     navBottom=el('nav',null,'list-pagination');
   const tableRegion=el('div',null,'hd-oc-table-scroll');
   root.append(title,status,toolbar,navTop,tableRegion,navBottom);
   host.append(root);
   let page=1,term='',estadoId='',sequence=0;
   const drawPager=(result)=>{
     const count=Number(result.last_page||1);
     for(const nav of [navTop,navBottom]){
       ui()?.renderPager(nav,{page,pages:count,total:Number(result.total||0),
         label:'órdenes',autoTop:false,
         onPage:n=>{page=n;void load();scroll(root);}});
       nav.hidden=count<=1;
     }
   };
   const load=async()=>{
     const ticket=++sequence;status.textContent='Consultando órdenes de compra…';
     try{
       const response=await api().purchaseOrders({page,buscar:term,estadoId});
       if(ticket!==sequence||!root.isConnected)return;
       tableRegion.replaceChildren();
       const table=el('table',null,'catalog-table hd-oc-table');
       const thead=el('thead'),head=el('tr');
       ['Código','Número OC','Proveedor','Fecha','Estado','Subtotal neto',
         'Impuestos','Total bruto','Acciones'].forEach(h=>head.append(el('th',h)));
       thead.append(head);table.append(thead);
       const tbody=el('tbody');
       for(const order of response.data||[]){
         const row=el('tr');
         [order.id,order.numero,order.proveedor_nombre,
           String(order.solicitada_en||'').slice(0,10)].forEach(v=>row.append(el('td',v||'—')));
         const stateCell=el('td'),chip=el('span',order.estado_nombre||'—','hd-oc-state');
         chip.dataset.state=order.estado_codigo||'';stateCell.append(chip);row.append(stateCell);
         for(const key of ['subtotal_neto','total_impuestos','total_bruto'])
           row.append(el('td',money(order[key])));
         const cell=el('td',null,'hd-oc-row-actions');
         const edit=action('Editar orden '+order.numero,async()=>{
           try{
             const complete=await api().getPurchaseOrder(order.id);
             await editarOrden(complete,async note=>{status.textContent=note;await load();});
           }catch(e){status.textContent=msg(e);}
         },'editar');
         edit.disabled=order.estado_codigo!=='ACTIVA';
         const pdf=action('Ver PDF de orden '+order.numero,
           ()=>void mostrarPdf(order.id),'pdf');
         const annul=action('Anular orden '+order.numero,
           ()=>void confirmarAnulacion(order,load,status),'desactivar',true);
         annul.disabled=order.estado_codigo!=='ACTIVA';
         cell.append(edit,pdf,annul);row.append(cell);tbody.append(row);
       }
       table.append(tbody);tableRegion.append(table);
       drawPager(response);
       status.textContent=(response.total||0)+' órdenes de compra.';
       if(!response.data?.length)tableRegion.append(el('p',
         'No existen órdenes para estos filtros.','hd-oc-empty'));
     }catch(e){
       if(ticket!==sequence||!root.isConnected)return;
       status.textContent=msg(e);status.classList.add('is-error');
     }
   };
   searchForm.addEventListener('submit',e=>{
     e.preventDefault();term=search.value.trim();page=1;void load();
   });
   filter.addEventListener('change',()=>{estadoId=filter.value;page=1;void load();});
   void api().orderStates().then(data=>{
     if(!root.isConnected)return;
     for(const item of data.items||[])filter.append(new Option(item.nombre,String(item.id)));
   }).catch(e=>{status.textContent=msg(e);});
   void load();
 }
 window.RutaHDOrdenesCompra=Object.freeze({mount});
})();
