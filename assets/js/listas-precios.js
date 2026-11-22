/* Ruta H&D V2 · Mantenedor de Listas de Precios (Laravel + MariaDB).
   No escribe datos locales ni modifica una lista base desde el cliente. */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos,acl=()=>window.RutaHDAccesos;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n};
 const btn=(text,fn,cls='ghost')=>{
  const n=el('button',text,'button '+cls);n.type='button';n.addEventListener('click',fn);return n;
 };
 const error=e=>e?.message||e?.detail||e?.error||
   (e?.status===409?'La lista está en uso o su código ya existe.':
    'No fue posible completar la operación. Comprueba los datos y tu conexión.');
 let revision=0;
 function mount(parent){
  const own=++revision;
  const root=el('section',undefined,'surface-panel official-module price-lists-module');
  root.id='priceListsModule';
  const header=el('div',undefined,'panel-heading');
  header.append(el('h2','Listas de precios'),el('span','Tarifas comerciales · Laravel / MariaDB','official-source'));
  const desc=el('p','Una única LISTA BASE general y listas especiales para clientes. Una lista desactivada conserva sus precios históricos.','catalog-footnote');
  const note=el('p','', 'catalog-footnote');note.setAttribute('role','status');
  const toolbar=el('div',undefined,'workspace-actions normalized-toolbar');
  const search=el('input');search.type='search';search.placeholder='Buscar lista por nombre o código';
  search.setAttribute('aria-label','Buscar listas de precios');
  const add=btn('Nueva lista de precios',()=>openEditor(null),'primary');
  const refresh=btn('Actualizar',()=>void load());
  toolbar.append(search,add,refresh);
  const list=el('div',undefined,'catalog-table-scroll');
  const pager=el('nav',undefined,'list-pagination price-lists-pagination');
  pager.setAttribute('aria-label','Páginas de listas de precios');
  const previous=btn('Anterior',()=>{if(page>1){page--;void load();}});
  const next=btn('Siguiente',()=>{if(page<lastPage){page++;void load();}});
  const counter=el('span','','list-pagination-info');
  counter.setAttribute('aria-live','polite');
  pager.append(previous,counter,next);
  root.append(header,desc,note,toolbar,list,pager);parent.replaceChildren(root);
  let page=1,lastPage=1,requestVersion=0;
  if(!acl()?.authenticated()){note.textContent='Inicia sesión para consultar listas.';return;}
  let timer=null;
  search.addEventListener('input',()=>{
   page=1;
   clearTimeout(timer);timer=setTimeout(()=>void load(),250);
  });
  async function load(){
   const request=++requestVersion;
   note.textContent='Consultando listas de precios…';
   previous.disabled=next.disabled=true;
   try{
    const response=await api().priceLists(search.value.trim(),null,page,25);
    if(!root.isConnected||own!==revision||request!==requestVersion)return;
    lastPage=Math.max(1,Number(response?.last_page)||1);
    if(page>lastPage){page=lastPage;void load();return;}
    const rows=Array.isArray(response?.data)?response.data:[];
    list.replaceChildren();
    const table=el('table',undefined,'catalog-table normalized-table');
    const head=el('thead'),hr=el('tr');
    ['Código','Nombre de lista','Tipo','Estado','Acciones'].forEach(x=>hr.append(el('th',x)));
    head.append(hr);table.append(head);
    const body=el('tbody');
    rows.forEach(item=>{
      const tr=el('tr');
      tr.append(el('td',item.codigo),el('td',item.nombre),el('td',item.es_base?'Lista Base':'Especial'),
        el('td',item.activo?'Activo':'Inactivo'));
      const actions=el('td',undefined,'official-row-actions');
      const edit=btn('Editar',()=>openEditor(item),'ghost');
      edit.setAttribute('title','Editar lista');actions.append(edit);
      if(!item.es_base&&item.activo){
        const deactivate=btn('Desactivar',()=>confirmDeactivate(item),'ghost');
        deactivate.setAttribute('title','Desactivar lista');actions.append(deactivate);
      }
      tr.append(actions);body.append(tr);
    });
    table.append(body);list.append(table);
    const total=Number(response?.total??rows.length);
    note.textContent='Listas registradas: '+total+'. La Lista Base no puede eliminarse.';
    counter.textContent='Página '+page+' de '+lastPage+' · '+total+' listas · máximo 25 por página';
    pager.hidden=lastPage<=1;previous.disabled=page<=1;next.disabled=page>=lastPage;
    if(!rows.length)list.append(el('p','No existen listas con esos criterios.','catalog-footnote'));
   }catch(e){if(request===requestVersion)note.textContent=error(e);}
  }
  function openEditor(item){
   const dialog=el('dialog',undefined,'modal crud-dialog price-list-dialog');
   const form=el('form',undefined,'crud-shell');
   const heading=el('div',undefined,'crud-heading');
   heading.append(el('h2',item?'Editar lista de precios':'Nueva lista de precios'));
   heading.append(btn('×',()=>dialog.close(),'crud-close'));form.append(heading);
   const fields=el('div',undefined,'crud-fields price-list-fields');
   const field=(name,value,max)=>{
     const wrap=el('label',undefined,'field'),caption=el('span',name),input=el('input');
     input.type='text';input.required=true;input.maxLength=max;input.value=value||'';
     wrap.append(caption,input);fields.append(wrap);return input;
   };
   const codigo=field('Código',item?.codigo||'',40);
   const nombre=field('Nombre',item?.nombre||'',120);
   const observation=field('Observación',item?.observacion||'',255);
   observation.required=false;
   const status=el('label',undefined,'field price-list-active');
   const active=el('input');active.type='checkbox';active.checked=item?.activo!==false;
   if(item?.es_base){active.checked=true;active.disabled=true;codigo.readOnly=true;}
   status.append(active,el('span',item?.es_base?'La Lista Base siempre está activa':'Lista activa'));
   fields.append(status);form.append(fields);
   const note=el('p','', 'form-error');note.hidden=true;note.setAttribute('role','alert');form.append(note);
   const footer=el('div',undefined,'modal-footer crud-footer');
   const cancel=btn('Cancelar',()=>dialog.close());
   const submit=el('button',item?'Guardar cambios':'Crear lista','button primary');submit.type='submit';
   footer.append(cancel,submit);form.append(footer);
   form.addEventListener('submit',async ev=>{
    ev.preventDefault();if(!form.reportValidity())return;
    const dto={codigo:codigo.value.trim(),nombre:nombre.value.trim(),
      observacion:observation.value.trim()||null,activo:active.checked};
    submit.disabled=true;note.hidden=true;
    try{
      if(item)await api().updatePriceList(item.id,dto);
      else await api().createPriceList(dto);
      dialog.close();await load();
    }catch(e){note.hidden=false;note.textContent=error(e);}
    finally{submit.disabled=false;}
   });
   dialog.append(form);document.body.append(dialog);
   dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
   nombre.focus();
  }
  function confirmDeactivate(item){
   const dialog=el('dialog',undefined,'modal crud-dialog price-list-confirm');
   dialog.append(el('h2','Desactivar lista especial'),
      el('p','Se desactivará «'+item.nombre+'». Los precios históricos se conservarán.'));
   const message=el('p','', 'form-error');message.hidden=true;dialog.append(message);
   const controls=el('div',undefined,'modal-footer');
   controls.append(btn('Cancelar',()=>dialog.close()));
   const yes=btn('Desactivar',async()=>{
    yes.disabled=true;
    try{await api().deactivatePriceList(item.id);dialog.close();await load();}
    catch(e){message.hidden=false;message.textContent=error(e);yes.disabled=false;}
   },'danger');
   controls.append(yes);dialog.append(controls);
   document.body.append(dialog);
   dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  void load();
 }
 window.RutaHDListasPrecios=Object.freeze({mount});
})();