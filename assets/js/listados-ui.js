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
  buscar:'<circle cx="10.8" cy="10.8" r="7.5"/><path d="m16.5 16.5 5 5"/>',
  filtros:'<path d="M4 7h16M7 12h10M10 17h4"/>'};
 const icon=(key)=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+(SVG[key]||SVG.ver)+'</svg>';
 const action=(text,click,{kind='editar',danger=false}={})=>{
  const b=document.createElement('button');b.type='button';
  b.className='list-icon-action'+(danger?' is-danger':'');
  b.setAttribute('aria-label',text);b.setAttribute('title',text);
  b.dataset.tip=text;b.innerHTML=icon(kind);
  b.addEventListener('click',click);return b;
 };
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
 function advanced(fields,onApply,{title='Búsqueda avanzada',hint='Los filtros adicionales se aplican sobre los registros cargados de la página actual.'}={}){
  const dialog=document.createElement('dialog');dialog.className='modal catalog-dialog crud-dialog advanced-search-dialog';
  const form=document.createElement('form');form.className='crud-shell';form.noValidate=true;
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
    for(const [val,label] of field.options)input.appendChild(new Option(label,val));
   }else{input=document.createElement('input');input.type=field.type||'search';}
   input.name=field.key;input.value=field.value||'';input.placeholder=field.placeholder||'Buscar…';input.autocomplete='off';
   label.append(input);fieldsArea.append(label);controls[field.key]=input;
  }
  form.append(fieldsArea);
  const footer=document.createElement('div');footer.className='crud-footer modal-footer';
  const clear=document.createElement('button');clear.type='button';clear.className='button ghost';clear.textContent='Limpiar filtros';
  clear.addEventListener('click',()=>{for(const input of Object.values(controls))input.value='';onApply({});dialog.close();});
  const send=document.createElement('button');send.type='submit';send.className='button primary';send.textContent='Aplicar filtros';
  footer.append(clear,send);form.append(footer);
  form.addEventListener('submit',event=>{
   event.preventDefault();onApply(Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value.trim()])));dialog.close();
  });
  dialog.append(form);document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();fieldsArea.querySelector('input,select')?.focus();
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
 window.RutaHDListUI=Object.freeze({action,actionsCell,wrapTable,registerSearch,advanced,filterButton,matching,createSearch,icon});
})();