/* Ruta H&D V2 · Herramientas transversales para listados y filtros v20.
 * La búsqueda avanzada de campos no soportados por la API actúa sobre
 * la página cargada, sin fingir búsquedas globales en MariaDB.
 */
(() => {
 'use strict';
 const SVG={
  editar:'<path d="m14 4 6 6"/><path d="M4 20h4l12-12a2.8 2.8 0 0 0-4-4L4 16v4Z"/>',
  desactivar:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6 18.4 18.4"/>',
  ver:'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  barras:'<path d="M3 5v14M6 5v14M10 5v14M12 5v14M16 5v14M20 5v14M22 5v14"/>',
  fotos:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.2" cy="9" r="1.6"/><path d="m4.5 17 4.8-4.5 3.1 2.5 3.3-4L20 15"/>',
  buscar:'<circle cx="10.8" cy="10.8" r="7.5"/><path d="m16.5 16.5 5 5"/>',
  filtros:'<path d="M4 7h16M7 12h10M10 17h4"/>'};
 const icon=(key)=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(SVG[key]||SVG.ver)+'</svg>';
 const action=(text,click,{kind='editar',danger=false}={})=>{
  const b=document.createElement('button');b.type='button';
  b.className='list-icon-action'+(danger?' is-danger':'');
  b.setAttribute('aria-label',text);
  b.dataset.tip=text;b.innerHTML=icon(kind);
  b.addEventListener('click',click);return b;
 };
 // Interruptor de estado reversible; no elimina datos. 
 const statusSwitch=(name,active,onChange,{disabled=false,confirmOff=true}={})=>{
  const label=document.createElement('label');label.className='hd-inline-status-switch';
  const input=document.createElement('input');input.type='checkbox';
  input.className='hd-state-switch';input.checked=Boolean(active);input.disabled=Boolean(disabled);
  input.setAttribute('aria-label',(input.checked?'Desactivar ':'Activar ')+name);
  input.dataset.tip=(input.checked?'Desactivar ':'Activar ')+name;
  const description=document.createElement('span');description.className='hd-status-word';
  description.textContent=input.checked?'Activo':'Inactivo';label.append(input,description);
  input.addEventListener('change',async()=>{
   const wanted=input.checked,previous=!wanted;
   if(!wanted&&confirmOff&&!window.confirm('¿Desactivar «'+name+'»? Se conservará su historial.')){
    input.checked=previous;return;
   }
   input.disabled=true;
   try{
    await onChange(wanted);
    description.textContent=wanted?'Activo':'Inactivo';
    input.setAttribute('aria-label',(wanted?'Desactivar ':'Activar ')+name);
    input.dataset.tip=(wanted?'Desactivar ':'Activar ')+name;
   }catch(err){
    input.checked=previous;description.textContent=previous?'Activo':'Inactivo';
    input.setAttribute('aria-label',(previous?'Desactivar ':'Activar ')+name);
    input.dataset.tip=(previous?'Desactivar ':'Activar ')+name;
    const alert=document.createElement('span');alert.className='hd-switch-error';
    alert.setAttribute('role','alert');alert.textContent=err?.message||'No se pudo actualizar el estado.';
    label.append(alert);window.setTimeout(()=>alert.remove(),5000);
   }finally{input.disabled=Boolean(disabled);}
  });
  return label;
 };
 // Tooltip en body: no lo cortan el scroll horizontal ni las celdas sticky.
 let activeTooltip=null,tipOrigin=null;
 function hideTip(){if(activeTooltip)activeTooltip.remove();activeTooltip=null;tipOrigin=null;}
 function showTip(control){
  if(!control||control.disabled||!control.isConnected)return;
  const content=control.dataset.tip||control.getAttribute('aria-label');if(!content)return;
  if(tipOrigin!==control){
   hideTip();tipOrigin=control;
   activeTooltip=document.createElement('span');activeTooltip.className='hd-floating-tooltip';
   activeTooltip.setAttribute('role','tooltip');activeTooltip.textContent=content;
   document.body.append(activeTooltip);
  }
  const rect=control.getBoundingClientRect(),width=activeTooltip.offsetWidth||170;
  activeTooltip.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2))+'px';
  activeTooltip.style.top=Math.max(8,Math.min(window.innerHeight-activeTooltip.offsetHeight-8,rect.bottom+10))+'px';
 }
 const tooltipTarget=t=>t instanceof Element?
  t.closest('.list-icon-action[data-tip],.hd-inline-status-switch input[data-tip]'):null;
 document.addEventListener('pointerover',e=>{const t=tooltipTarget(e.target);if(t)showTip(t);});
 document.addEventListener('pointerout',e=>{
  if(tipOrigin&&tooltipTarget(e.target)===tipOrigin&&!tipOrigin.contains(e.relatedTarget))hideTip();
 });
 document.addEventListener('focusin',e=>{const t=tooltipTarget(e.target);if(t)showTip(t);});
 document.addEventListener('focusout',e=>{
  if(tipOrigin&&tooltipTarget(e.target)===tipOrigin)hideTip();
 });
 window.addEventListener('scroll',hideTip,true);window.addEventListener('resize',hideTip);
 const actionsCell=(cell)=>{cell.classList.add('list-action-cell');return cell;};
 const wrapTable=(table)=>{table.classList.add('normalized-table');table.querySelectorAll('th:last-child').forEach(n=>n.classList.add('table-actions-head'));return table;};
 let globalSearch=null;
 function registerSearch(root,fn,placeholder='Buscar en este listado…'){
  globalSearch={root,fn};
  const top=document.getElementById('globalSearch');
  if(top){top.value='';top.placeholder=placeholder;}
  return ()=>{if(globalSearch?.root===root)globalSearch=null;};
 }
 document.addEventListener('input',event=>{
  if(event.target?.id!=='globalSearch')return;
  const item=globalSearch;
  if(!item?.root?.isConnected)return;
  item.fn(event.target.value,{commit:false});
 });
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   const input=document.getElementById('globalSearch');if(input){event.preventDefault();input.focus();}
  }
  if(event.target?.id==='globalSearch'&&event.key==='Enter'){
   event.preventDefault();if(globalSearch?.root?.isConnected)globalSearch.fn(event.target.value,{commit:true});
  }
 });
 function advanced(fields,onApply,{title='Búsqueda avanzada',hint='Los filtros adicionales se aplican sobre los registros cargados de la página actual.',validate=null}={}){
  const dialog=document.createElement('dialog');dialog.className='modal catalog-dialog crud-dialog advanced-search-dialog';
  const form=document.createElement('form');form.className='crud-shell';form.noValidate=false;
  const heading=document.createElement('div');heading.className='crud-heading';
  const copy=document.createElement('div');copy.className='crud-heading-copy';
  copy.innerHTML='<span class="crud-kicker">RUTA H&D · LISTADOS</span>';
  const h=document.createElement('h2');h.textContent=title;
  const note=document.createElement('p');note.className='crud-intro';note.textContent=hint;
  copy.append(h,note);
  const close=document.createElement('button');close.type='button';close.className='crud-close';close.textContent='×';close.setAttribute('aria-label','Cerrar filtros');close.addEventListener('click',()=>dialog.close());
  heading.append(copy,close);form.append(heading);
  const fieldsArea=document.createElement('div');fieldsArea.className='crud-fields crud-form-grid';const controls={};
  for(const field of fields){
   const label=document.createElement('label');label.className='field crud-field';
   const span=document.createElement('span');span.textContent=field.label;label.append(span);
   let input;
   if(field.options){
    input=document.createElement('select');
    input.appendChild(new Option('Todos',''));
    for(const [val,title] of field.options)input.appendChild(new Option(title,val));
   }else{input=document.createElement('input');input.type=field.type||'search';}
   input.name=field.key;input.value=field.value||'';input.placeholder=field.placeholder||'Buscar…';input.autocomplete='off';
   if(field.type==='number'){input.min=field.min??'0';input.step=field.step??'any';}
   label.append(input);fieldsArea.append(label);controls[field.key]=input;
  }
  // Selectores dependientes. Sin padre elegido se permiten todas las opciones;
  // al seleccionar un padre se restringen a sus descendientes legítimos.
  const refill=field=>{
   if(!field.dependsOn||!controls[field.key])return;
   const select=controls[field.key],parentId=controls[field.dependsOn]?.value||'';
   const before=select.value;
   select.replaceChildren(new Option('Todos',''));
   for(const [val,title,relatedId] of field.options||[]){
    if(!parentId||String(relatedId)===String(parentId))
      select.append(new Option(title,val));
   }
   select.value=[...select.options].some(option=>option.value===before)?before:'';
  };
  const redrawDescendants=parentKey=>{
   fields.filter(field=>field.dependsOn===parentKey).forEach(field=>{
    refill(field);redrawDescendants(field.key);
   });
  };
  fields.filter(field=>field.dependsOn).forEach(refill);
  for(const field of fields){
   if(controls[field.key])controls[field.key].addEventListener('change',()=>redrawDescendants(field.key));
  }
  form.append(fieldsArea);
  const footer=document.createElement('div');footer.className='crud-footer modal-footer';
  const clear=document.createElement('button');clear.type='button';clear.className='button ghost';clear.textContent='Limpiar filtros';
  clear.addEventListener('click',()=>{for(const input of Object.values(controls))input.value='';onApply({});dialog.close();});
  const send=document.createElement('button');send.type='submit';send.className='button primary';send.textContent='Aplicar filtros';
  footer.append(clear,send);form.append(footer);
  form.addEventListener('submit',event=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   const values=Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value.trim()]));
   const issue=typeof validate==='function'?validate(values):null;
   if(issue){
    const field=controls[issue.field]||Object.values(controls)[0];
    window.RutaHDValidacion?.mostrar(field,issue.message||'Revisa los valores ingresados.');
    return;
   }
   onApply(values);dialog.close();
  });
  dialog.append(form);document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();fieldsArea.querySelector('input,select')?.focus();
  return dialog;
 }
 const filterButton=(fields,onApply,config)=>{
  const b=document.createElement('button');b.type='button';b.className='button ghost advanced-filter-trigger';
  b.innerHTML=icon('filtros')+'<span>Búsqueda avanzada</span>';
  b.addEventListener('click',()=>advanced(fields,onApply,config));return b;
 };
 const matching=(record,filters)=>{
  const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
  return Object.entries(filters||{}).every(([key,value])=>{
   if(!value)return true;
   const actual=record[key];
   if(key==='activo'||key==='estado')return String(actual===true||actual===1||actual==='1'?'1':'0')===String(value);
   return normalize(actual).includes(normalize(value));
  });
 };
 const createSearch=(placeholder='Buscar registros…')=>{
  const input=document.createElement('input');input.className='list-search-input';input.type='search';
  input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);input.maxLength=120;return input;
 };

 const PAGE_SIZE=25;
 const paginationStates=new WeakMap(),pagerCallbacks=new WeakMap();
 // Un solo paginador accesible para todas las tablas: no mezcla paginación
 // local (filas cargadas) con páginas que todavía deben consultarse en Laravel.
 function renderPager(nav,{page=1,pages=1,total=null,label='registros',onPage}={}){
  if(!nav)return;
  const last=Math.max(1,Math.trunc(Number(pages)||1));
  const now=Math.max(1,Math.min(last,Math.trunc(Number(page)||1)));
  pagerCallbacks.set(nav,typeof onPage==='function'?onPage:()=>{});
  const totalText=total===null||total===undefined?'':String(total)+' '+label+' · ';
  const signature=[now,last,totalText].join('|');
  if(nav.dataset.pagerKey===signature)return;
  nav.dataset.pagerKey=signature;
  nav.classList.add('list-pagination','hd-numbered-pagination');
  if(!nav.hasAttribute('aria-label'))nav.setAttribute('aria-label','Paginación de resultados');
  const button=(name,destination,kind,disabled=false)=>{
   const control=document.createElement('button');control.type='button';
   control.className='hd-page-button '+kind;control.textContent=name;
   control.setAttribute('aria-label',kind==='hd-page-number'?'Página '+destination:name);
   if(kind==='hd-page-number'&&destination===now){
    control.setAttribute('aria-current','page');control.classList.add('is-current');
   }
   control.disabled=disabled;
   if(!disabled)control.addEventListener('click',()=>pagerCallbacks.get(nav)?.(destination));
   return control;
  };
  const numbers=document.createElement('span');numbers.className='hd-page-numbers';
  const visible=new Set([1,last]);
  for(let n=Math.max(1,now-2);n<=Math.min(last,now+2);n++)visible.add(n);
  const sequence=[...visible].sort((x,y)=>x-y);
  sequence.forEach((number,i)=>{
   if(i&&number-sequence[i-1]>1){
    const dots=document.createElement('span');dots.textContent='…';
    dots.className='hd-page-ellipsis';dots.setAttribute('aria-hidden','true');
    numbers.append(dots);
   }
   numbers.append(button(String(number),number,'hd-page-number',number===now));
  });
  const info=document.createElement('span');info.className='list-pagination-info';
  info.setAttribute('aria-live','polite');
  info.textContent=totalText+'Página '+now+' de '+last+' · máximo '+PAGE_SIZE+' por página';
  nav.replaceChildren(button('Anterior',now-1,'hd-page-arrow',now===1),
    numbers,button('Siguiente',now+1,'hd-page-arrow',now===last),info);
 }
 function paginate(table,matchedRows=null){
  if(!table?.tBodies?.length)return;
  const all=Array.from(table.tBodies[0].rows);
  const matches=Array.isArray(matchedRows)?matchedRows:all;
  let state=paginationStates.get(table);
  if(!state&&all.length<=PAGE_SIZE){
   const allowed=new Set(matches);all.forEach(row=>{row.hidden=!allowed.has(row);});
   return;
  }
  if(!state){
   const nav=document.createElement('nav');nav.className='list-pagination';
   nav.setAttribute('aria-label','Paginación de resultados');table.after(nav);
   state={page:1,nav,matches};paginationStates.set(table,state);
  }
  state.matches=matches;
  const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));
  state.page=Math.min(state.page,pages);
  const visible=new Set(matches.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE));
  all.forEach(row=>{row.hidden=!visible.has(row);});
  state.nav.hidden=all.length<=PAGE_SIZE;
  renderPager(state.nav,{page:state.page,pages,total:matches.length,
   label:'registros cargados',onPage:n=>{
    if(n<1||n>pages||n===state.page)return;
    state.page=n;paginate(table,state.matches);
   }});
 }

 const actionKinds={editar:'editar',desactivar:'desactivar',eliminar:'desactivar',
   ver:'ver',fotos:'fotos','codigos de compra':'barras','codigos de barras':'barras',
   'enviar recuperacion':'ver'};
 const modules='#adminRemoto,#productosReales,#usersCrud,#rolesCatalogos,.official-module,.supplier-products-module';
 let activeRoot=null;const states=new WeakMap();
 const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
 const current=root=>root.querySelector('.catalog-table,.data-table,.permissions-table');
 const stateOf=root=>{
  if(!states.has(root))states.set(root,{text:'',filters:{},columns:[]});
  return states.get(root);
 };
 function decorate(root){
  const table=current(root),state=stateOf(root);
  if(table){
   table.classList.add('normalized-table');
   state.columns=[...table.querySelectorAll('thead tr:first-child th')].map((n,index)=>({
    key:'col'+index,label:n.textContent.trim(),index
   })).filter(v=>v.label&&v.label!=='Acciones');
   table.querySelectorAll('td.catalog-actions,td.official-row-actions,td.supplier-row-actions,td.row-actions').forEach(cell=>{
    cell.classList.add('list-action-cell');
    cell.querySelectorAll('button').forEach(b=>{
     if(b.dataset.normalizedIcon)return;
     const label=(b.textContent||'').trim(),kind=actionKinds[normalize(label)];
     if(!kind)return;
     b.dataset.normalizedIcon='true';b.dataset.tip=label;
     b.setAttribute('aria-label',label);
     b.classList.add('list-icon-action');if(kind==='desactivar')b.classList.add('is-danger');
     b.innerHTML=icon(kind);
    });
   });
  }
  const toolbar=root.querySelector('.official-search-bar,.supplier-search-bar,.workspace-actions,.catalog-header');
  if(toolbar&&!toolbar.dataset.advancedReady){
   toolbar.dataset.advancedReady='true';toolbar.classList.add('normalized-toolbar');
   let input=toolbar.querySelector('input[type=search]');
   if(!input){
    input=createSearch('Buscar en esta página…');input.dataset.localFilter='true';
    input.addEventListener('input',()=>{state.text=input.value;apply(root);
     const global=document.getElementById('globalSearch');if(global&&activeRoot===root)global.value=input.value;
    });
    toolbar.prepend(input);
   }
   const filter=document.createElement('button');filter.type='button';
   filter.className='button ghost advanced-filter-trigger';filter.innerHTML=icon('filtros')+'<span>Búsqueda avanzada</span>';
   filter.addEventListener('click',()=>{
    const fields=state.columns.map(c=>({
     key:c.key,label:c.label,value:state.filters[c.key]||'',
     ...(normalize(c.label)==='estado'||normalize(c.label)==='activo'?
      {options:[['Activo','Activo'],['Inactivo','Inactivo']]}:{})
    }));
    advanced(fields.length?fields:[{key:'col0',label:'Nombre'}],filters=>{
     state.filters=filters;apply(root);
    },{title:'Búsqueda avanzada · '+(root.querySelector('h2,h3')?.textContent||'Listado')});
   });
   if(!toolbar.dataset.productAdvanced)toolbar.append(filter);
  }
  if(table)apply(root);
  if(activeRoot!==root){
   activeRoot=root;
   registerSearch(root,(q,{commit}={})=>{
    state.text=q;const input=root.querySelector('.normalized-toolbar input[type=search]');
    if(input)input.value=q;
    apply(root);
    if(commit&&input&&!input.dataset.localFilter){
     const form=input.closest('form');
     if(form)form.requestSubmit();
     else [...(input.parentElement?.querySelectorAll('button')||[])].find(b=>/^Buscar$/i.test(b.textContent.trim()))?.click();
    }
   },'Buscar en '+(root.querySelector('h2,h3')?.textContent||'el listado')+'…');
  }
 }
 function apply(root){
  const table=current(root);if(!table)return;
  const state=stateOf(root),rows=[...table.querySelectorAll('tbody tr')];
  const matched=rows.filter(row=>{
   const cells=[...row.cells];
   const haystack=normalize(cells.slice(0,-1).map(n=>n.textContent).join(' '));
   const columnMatches=Object.entries(state.filters).every(([key,value])=>{
    if(!value)return true;
    const col=state.columns.find(c=>c.key===key);if(!col)return true;
    const field=normalize(cells[col.index]?.textContent);
    return normalize(col.label)==='estado'||normalize(col.label)==='activo'?
     field===normalize(value):field.includes(normalize(value));
   });
   return (!state.text||haystack.includes(normalize(state.text)))&&columnMatches;
  });
  const pager=paginationStates.get(table);
  if(pager&&(pager.filterText!==state.text||
    pager.filterJson!==JSON.stringify(state.filters)))pager.page=1;
  paginate(table,matched);
  const active=paginationStates.get(table);
  if(active){active.filterText=state.text;active.filterJson=JSON.stringify(state.filters);}
  let note=root.querySelector('.list-filter-note');
  if(state.text||Object.values(state.filters).some(Boolean)){
   if(!note){
    note=document.createElement('p');note.className='list-filter-note';
    const wrap=table.closest('.catalog-table-scroll,.permissions-table-scroll,.table-scroll');
    if(wrap)wrap.before(note);
   }
   const summary='Filtros: '+matched.length+' de '+rows.length+
    ' registros cargados. Para otros resultados del servidor, usa su paginación.';
   if(note&&note.textContent!==summary)note.textContent=summary;
  }else if(note)note.remove();
 }
 let pending=false;
 function rescan(){
  if(pending)return;pending=true;
  queueMicrotask(()=>{
   pending=false;const root=document.querySelector('#workspaceContent '+modules);
   if(root?.isConnected)decorate(root);
   else activeRoot=null;
  });
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const area=document.getElementById('workspaceContent');if(!area)return;
  new MutationObserver(rescan).observe(area,{childList:true,subtree:true});
  rescan();
 });
 window.RutaHDListUI=Object.freeze({action,actionsCell,wrapTable,registerSearch,advanced,filterButton,matching,createSearch,icon,paginate,renderPager,statusSwitch,PAGE_SIZE});
})();