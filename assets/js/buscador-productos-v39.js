/* Ruta H&D V39 · Selector universal de productos (sin estado de negocio ni escrituras).
 * API pública de módulo: await RutaHDBuscadorProductos.open({
 *   mode:'single'|'multiple', title, preset:{rubro_id:...,sku_desde:...},
 *   lockedFilters:{proveedor_id:...}, initial:[], excludeIds:[],
 *   source: async({buscar,page,filters})=>({data,total,last_page}), onSelect
 * })
 * Devuelve producto simple, arreglo de productos, o null al cancelar.
 * El módulo consumidor valida la selección y los precios/stock antes de guardar.
 */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const make=(tag,text=null,css='')=>{
   const node=document.createElement(tag);
   if(text!==null)node.textContent=String(text);
   if(css)node.className=css;
   return node;
 };
 const button=(text,fn,css='button ghost')=>{
   const node=make('button',text,css);node.type='button';node.addEventListener('click',fn);return node;
 };
 const definitions=[
   ['rubro_id','Rubro','rubros'],
   ['departamento_id','Departamento','departamentos'],
   ['familia_id','Familia','familias'],
   ['linea_id','Línea','lineas'],
   ['marca_id','Marca','marcas'],
   ['modelo_id','Modelo','modelos']
 ];
 const ALLOWED=new Set([...definitions.map(d=>d[0]),
   'tipo_unidad_id','tipo_envasado_id','condicion_tributaria_id',
   'proveedor_id','solo_sin_proveedor_id','codigo_barras',
   'sku_desde','sku_hasta','id_desde','id_hasta']);
 const label=(text,field)=>{
   const w=make('label',null);w.append(make('span',text),field);return w;
 };
 const errorText=e=>e?.userMessage||e?.message||
   ('El servidor no respondió correctamente ('+(e?.status||'error')+').');
 function open(settings={}){
   const {
     mode='single', title='Seleccionar productos', preset={},
     lockedFilters={}, initial=[], excludeIds=[], source=null,onSelect=null,
     fields=null,context='general',initialSearch=''
   }=settings;
   if(!['single','multiple'].includes(mode))return Promise.reject(Error('Modo de búsqueda inválido'));
   for(const x of [preset,lockedFilters]){
     if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!ALLOWED.has(k)))
       return Promise.reject(Error('Filtro preestablecido no permitido'));
   }
   const multiple=mode==='multiple';
   const disabledIds=new Set(excludeIds.map(Number));
   return new Promise(resolve=>{
     const dialog=make('dialog',null,'modal hd-product-finder');
     dialog.setAttribute('aria-label',title);
     const shell=make('div',null,'hd-lookup-shell');
     const head=make('div',null,'hd-lookup-head');
     const headings=make('div');
     headings.append(make('h2',title),make('p',multiple?
       'Puedes marcar varios productos y conservarlos mientras recorres páginas.':
       'Selecciona un producto para devolverlo al módulo de origen.'));
     const close=button('×',()=>dialog.close(),'crud-close');
     close.setAttribute('aria-label','Cerrar buscador de productos');
     head.append(headings,close);shell.append(head);
     const form=make('form',null,'hd-lookup-filterbar');
     const query=make('input');query.type='search';query.maxLength=120;
     query.placeholder='SKU, nombre, descripción o código de barras';
     query.setAttribute('aria-label','Buscar productos en todo el catálogo');
     query.value=String(initialSearch).slice(0,120);
     const find=make('button','Buscar productos','button primary');find.type='submit';
     form.append(query,find);shell.append(form);
     const controls=make('div',null,'hd-lookup-controls');
     const activeControls=new Map();
     const allowedFields=fields?new Set(fields):null;
     const catalogLabels=new Map();
     for(const [key,caption,catalog] of definitions){
       if(allowedFields&&!allowedFields.has(key))continue;
       if(Object.prototype.hasOwnProperty.call(lockedFilters,key))continue;
       const select=make('select');
       select.setAttribute('aria-label','Filtrar por '+caption.toLowerCase());
       select.append(new Option('Todos',''));
       if(preset[key]!==undefined&&preset[key]!==null)select.value=String(preset[key]);
       activeControls.set(key,select);
       controls.append(label(caption,select));
       void api().list(catalog).then(response=>{
         if(!dialog.isConnected)return;
         const list=Array.isArray(response)?response:response.data||response.items||[];
         for(const item of list){
           if(item.activo===false)continue;
           select.append(new Option(item.nombre,String(item.id)));
           catalogLabels.set(key+'-'+item.id,item.nombre);
         }
         if(preset[key]!==undefined&&preset[key]!==null)select.value=String(preset[key]);
       }).catch(()=>{/* Los filtros de texto y SKU permanecen disponibles. */});
     }
     const inputs=[
       ['codigo_barras','Código de barras','text'],
       ['sku_desde','SKU desde','text'],['sku_hasta','SKU hasta','text'],
       ['id_desde','ID desde','number'],['id_hasta','ID hasta','number']
     ];
     for(const [key,title,type] of inputs){
       if(allowedFields&&!allowedFields.has(key))continue;
       if(Object.prototype.hasOwnProperty.call(lockedFilters,key))continue;
       const input=make('input');input.type=type;input.maxLength=100;
       if(type==='number')input.min='1';
       input.setAttribute('aria-label','Filtrar por '+title.toLowerCase());
       input.value=preset[key]??'';
       activeControls.set(key,input);
       controls.append(label(title,input));
     }
     const clear=button('Limpiar filtros',()=>{
       activeControls.forEach(control=>control.value='');
       query.value='';page=1;void load();
     });controls.append(clear);
     shell.append(controls);
     const info=make('p','Consultando productos…','hd-lookup-status');
     info.setAttribute('role','status');
     const topPager=make('nav',null,'list-pagination');
     const list=make('div',null,'hd-lookup-table-scroll');
     const bottomPager=make('nav',null,'list-pagination');
     topPager.setAttribute('aria-label','Páginas superiores de productos');
     bottomPager.setAttribute('aria-label','Páginas inferiores de productos');
     shell.append(info,topPager,list,bottomPager);
     const footer=make('div',null,'hd-lookup-footer');
     const chips=make('div',null,'hd-product-selection');
     chips.setAttribute('aria-label','Productos seleccionados');
     const actions=make('div',null,'hd-lookup-footer-buttons');
     const cancel=button('Cancelar',()=>dialog.close());
     const confirm=button('Usar productos seleccionados',()=>finish([...selected.values()]),'button primary');
     if(multiple)actions.append(cancel,confirm);else actions.append(cancel);
     footer.append(chips,actions);shell.append(footer);
     dialog.append(shell);document.body.append(dialog);
     const selected=new Map((Array.isArray(initial)?initial:[initial])
       .filter(Boolean).filter(p=>!disabledIds.has(Number(p.id)))
       .map(p=>[Number(p.id),p]));
     let page=1,busy=false,sequence=0,settled=false;
     function redrawSelected(){
       chips.replaceChildren();
       if(!multiple)return;
       for(const p of selected.values()){
         const span=make('span',null,'hd-product-chip');
         span.append(make('span',p.sku+' · '+p.nombre));
         span.append(button('×',()=>{
           selected.delete(Number(p.id));redrawSelected();void load();
         }));
         chips.append(span);
       }
       confirm.disabled=selected.size===0;
       if(!selected.size)chips.append(make('span','Ningún producto seleccionado'));
     }
     function finish(value){
       if(settled)return;settled=true;
       dialog.close();
       if(typeof onSelect==='function'){
         try{onSelect(value);}catch(ex){console.error('El módulo receptor debe validar el producto',ex);}
       }
       resolve(value);
     }
     function showPager(nav,pages,total){
       const change=next=>{
         if(next===page||next<1||next>pages)return;
         page=next;void load();list.scrollTop=0;dialog.scrollTop=0;
         shell.scrollIntoView({block:'start',behavior:'smooth'});
       };
       if(window.RutaHDListUI?.renderPager){
         window.RutaHDListUI.renderPager(nav,{
           page,pages,total,label:'productos',onPage:change
         });
       }else{
         nav.replaceChildren();
         const prev=button('Anterior',()=>change(page-1));
         prev.disabled=page<=1;
         const next=button('Siguiente',()=>change(page+1));
         next.disabled=page>=pages;
         nav.append(prev,make('span','Página '+page+' de '+pages+' · '+total+' productos'),next);
       }
       nav.hidden=pages<=1;
     }
     function filtered(){
       const filters={...preset};
       for(const [key,control] of activeControls.entries()){
         if(control.value!=='')filters[key]=control.value;
         else delete filters[key];
       }
       // Estos límites NUNCA se pueden cambiar desde el popup.
       return {...filters,...lockedFilters};
     }
     async function load(){
       if(busy){sequence++;return;}
       const ticket=++sequence;busy=true;
       info.textContent='Buscando en el catálogo de productos…';
       list.replaceChildren();
       try{
         const filters=filtered();
         const response=source
           ?await source({buscar:query.value.trim(),page,filters,context})
           :await api().buscarProductos({buscar:query.value.trim(),page,filters,perPage:25});
         if(ticket!==sequence||!dialog.open)return;
         const rows=(response.data||response.items||[]).filter(p=>p&&p.id);
         const table=make('table',null,'hd-lookup-table');
         const thead=make('thead');const tr=make('tr');
         [multiple?'Seleccionar':'Usar','SKU','Producto','Código de barras','Rubro','Marca']
           .forEach(s=>tr.append(make('th',s)));
         thead.append(tr);table.append(thead);
         const tbody=make('tbody');
         for(const p of rows){
           const row=make('tr');
           const pick=make('td');
           const isDisabled=disabledIds.has(Number(p.id));
           if(multiple){
             const check=make('input');check.type='checkbox';check.value=String(p.id);
             check.checked=selected.has(Number(p.id));check.disabled=isDisabled;
             check.setAttribute('aria-label','Seleccionar '+p.nombre);
             // Clase no-switch: excluye expresamente el CSS global de interruptores V32.
             // La casilla visible es un SVG independiente; el input nativo mantiene
             // foco, teclado, lectura de pantalla y selección múltiple.
             check.className='no-switch hd-lookup-check';
             check.addEventListener('change',()=>{
               if(check.checked)selected.set(Number(p.id),p);else selected.delete(Number(p.id));
               redrawSelected();
             });
             const control=make('label',null,'hd-lookup-checkbox');
             const square=make('span',null,'hd-lookup-box');
             square.setAttribute('aria-hidden','true');
             square.innerHTML='<svg viewBox="0 0 20 20" focusable="false" aria-hidden="true"><path d="m4 10 4.2 4.2L16 6.5"/></svg>';
             control.append(check,square);
             pick.classList.add('hd-lookup-select-cell');
             pick.append(control);
           }else{
             const choose=window.RutaHDListUI?.action('Seleccionar '+p.nombre,
               ()=>finish(p),{kind:'seleccionar'})||
               button('Seleccionar',()=>finish(p));
             choose.disabled=isDisabled;pick.append(choose);
           }
           row.append(pick,
             make('td',p.sku||'—'),
             make('td',p.nombre||'—'),
             make('td',Array.isArray(p.codigosVenta)&&p.codigosVenta.length?
               p.codigosVenta.join(' · '):'—'),
             make('td',catalogLabels.get('rubro_id-'+p.clasificacion?.rubro_id)||'—'),
             make('td',catalogLabels.get('marca_id-'+p.clasificacion?.marca_id)||'—'));
           tbody.append(row);
         }
         table.append(tbody);list.append(table);
         if(!rows.length)list.append(make('p','No hay productos para los filtros seleccionados.','hd-lookup-status'));
         const pages=Math.max(1,Number(response.last_page||1));
         for(const nav of [topPager,bottomPager])showPager(nav,pages,Number(response.total||rows.length));
         info.textContent=Number(response.total||rows.length)+' productos disponibles · '+(multiple?'Selección múltiple':'Selección individual');
         redrawSelected();
       }catch(e){if(ticket===sequence){info.textContent=errorText(e);info.classList.add('is-error');}}
       finally{busy=false;if(sequence>ticket&&dialog.open)void load();}
     }
     form.addEventListener('submit',ev=>{ev.preventDefault();page=1;void load();});
     activeControls.forEach(input=>input.addEventListener('change',()=>{page=1;void load();}));
     dialog.addEventListener('close',()=>{
       dialog.remove();
       if(!settled){settled=true;resolve(null);}
     },{once:true});
     dialog.showModal();query.focus();redrawSelected();void load();
   });
 }
 const openSingle=options=>open({...options,mode:'single'});
 const openMultiple=options=>open({...options,mode:'multiple'});
 window.RutaHDBuscadorProductos=Object.freeze({open,openSingle,openMultiple});
})();
