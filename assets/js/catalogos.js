/* Ruta H&D2: catálogos comerciales en demostración local. Sin API/BD externa. */
(() => {
  'use strict';
  const STORE = 'rutahd2-catalogos-local-v1';
  const CONFIG = {
    rubros: {title:'Rubros',singular:'Rubro'},
    departamentos:{title:'Departamentos',singular:'Departamento',parent:'rubros'},
    familias:{title:'Familias',singular:'Familia',parent:'departamentos'},
    lineas:{title:'Líneas',singular:'Línea',parent:'familias'},
    marcas:{title:'Marcas',singular:'Marca'},
    modelos:{title:'Modelos',singular:'Modelo',parent:'marcas'},
    tipos_unidad:{title:'Tipos de unidad',singular:'Tipo de unidad'},
    gramajes:{title:'Gramos / Gramajes',singular:'Gramaje',numeric:true},
    tipos_envasado:{title:'Tipos de envasado',singular:'Tipo de envasado'},
    condiciones_tributarias:{title:'Condición tributaria',singular:'Condición tributaria',tax:true}
  };
  const ORDER=Object.keys(CONFIG);
  const LABELS={rubroId:'rubros',departamentoId:'departamentos',familiaId:'familias',lineaId:'lineas',
    marcaId:'marcas',modeloId:'modelos',tipoUnidadId:'tipos_unidad',gramajeId:'gramajes',
    tipoEnvasadoId:'tipos_envasado',condicionTributariaId:'condiciones_tributarias'};
  const CASCADE=[
    {key:'rubroId',catalog:'rubros'},
    {key:'departamentoId',catalog:'departamentos',depends:'rubroId'},
    {key:'familiaId',catalog:'familias',depends:'departamentoId'},
    {key:'lineaId',catalog:'lineas',depends:'familiaId'},
    {key:'marcaId',catalog:'marcas'},
    {key:'modeloId',catalog:'modelos',depends:'marcaId'},
    {key:'tipoUnidadId',catalog:'tipos_unidad'},
    {key:'gramajeId',catalog:'gramajes'},
    {key:'tipoEnvasadoId',catalog:'tipos_envasado'},
    {key:'condicionTributariaId',catalog:'condiciones_tributarias'}
  ];
  const $=(sel,root=document)=>root.querySelector(sel);
  const el=(tag,cls,text)=>{const v=document.createElement(tag);if(cls)v.className=cls;if(text!==undefined)v.textContent=String(text);return v;};
  const add=(p,...cs)=>{cs.forEach(c=>p.appendChild(c));return p;};
  const normalize=text=>String(text??'').trim().toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const empty=()=>Object.fromEntries(ORDER.map(k=>[k,[]]));
  const defaults=()=>({...empty(),condiciones_tributarias:[
    {id:'trib-afecto',nombre:'Afecto',activo:true,parentId:null},
    {id:'trib-exento',nombre:'Exento',activo:true,parentId:null}
  ]});
  const data=load();
  let selected='rubros',editing=null,pending=null,productRecords=()=>[];
  function load(){
    try{
      const stored=JSON.parse(localStorage.getItem(STORE)||'null');
      if(stored&&typeof stored==='object'&&ORDER.every(k=>Array.isArray(stored[k])))return stored;
    }catch(_){}
    return defaults();
  }
  function save(){
    try{localStorage.setItem(STORE,JSON.stringify(data));return true;}
    catch(_){notify('error','No se pudo guardar','El navegador rechazó el almacenamiento local.');return false;}
  }
  function notify(type,title,description){
    if(window.RutaHDAvisos?.toast)window.RutaHDAvisos.toast(type,title,description);
    else console.info(title+': '+description);
  }
  function catalog(key){return Array.isArray(data[key])?data[key]:[];}
  function label(key,id){return catalog(key).find(e=>String(e.id)===String(id))?.nombre||'Sin asignar';}
  function productLabel(field,id){const key=LABELS[field];return key?label(key,id):String(id??'');}
  function children(key,id){
    return ORDER.filter(k=>CONFIG[k].parent===key).flatMap(k=>catalog(k).filter(e=>String(e.parentId)===String(id)).map(e=>({catalog:k,entry:e})));
  }
  function activeList(key,parentId){
    return catalog(key).filter(r=>r.activo!==false&&(!CONFIG[key].parent||String(r.parentId)===String(parentId)));
  }
  function canCreateProduct(){
    return ['rubros','departamentos','familias','lineas','marcas','modelos','tipos_unidad','gramajes','tipos_envasado','condiciones_tributarias'].every(key=>catalog(key).some(r=>r.activo!==false));
  }
  function createOption(value,text){const o=el('option','',text);o.value=String(value);return o;}
  function fillProductSelects(root,preserve=true){
    CASCADE.forEach(f=>{
      const input=$('#field-'+f.key,root);
      if(!input)return;
      const prev=preserve?input.value:'';
      const parentId=f.depends?($('#field-'+f.depends,root)?.value||''):null;
      const matching=activeList(f.catalog,parentId);
      const current=catalog(f.catalog).find(r=>String(r.id)===String(prev));
      if(current&&!matching.some(r=>String(r.id)===String(prev)))matching.push(current);
      input.replaceChildren(createOption('','Selecciona '+CONFIG[f.catalog].singular.toLocaleLowerCase('es-CL')));
      matching.forEach(r=>input.appendChild(createOption(r.id,r.nombre)));
      input.value=matching.some(r=>String(r.id)===String(prev))?prev:'';
      input.disabled=Boolean(f.depends&&!parentId);
    });
  }
  function attachProductForm(root,record){
    // Cargar opciones de arriba hacia abajo, conservando IDs válidos cuando se edita.
    CASCADE.forEach(f=>{const control=$('#field-'+f.key,root);if(control&&record)control.dataset.initial=String(record[f.key]??'');});
    CASCADE.forEach(f=>{
      const input=$('#field-'+f.key,root);
      if(!input)return;
      if(record){input.replaceChildren(createOption(record[f.key]??'',label(f.catalog,record[f.key])));input.value=String(record[f.key]??'');}
    });
    fillProductSelects(root,true);
    CASCADE.forEach(f=>{
      const input=$('#field-'+f.key,root);
      if(!input)return;
      input.addEventListener('change',()=>{
        const descendants=CASCADE.filter(x=>x.depends===f.key);
        const resetRecursively=k=>{
          const control=$('#field-'+k,root);
          if(control)control.value='';
          CASCADE.filter(x=>x.depends===k).forEach(x=>resetRecursively(x.key));
        };
        descendants.forEach(x=>resetRecursively(x.key));
        fillProductSelects(root,true);
      });
    });
  }
  function makeButton(text,action,kind,id,cls='button ghost'){
    const b=el('button',cls,text);b.type='button';b.dataset.catalogAction=action;
    if(kind)b.dataset.catalog=kind;if(id!==undefined&&id!==null)b.dataset.id=String(id);
    return b;
  }
  function canEdit(key){
    return window.RutaHDAccesos?.canManageCatalog(key) ?? true;
  }
  function ensureEdit(key){
    if(canEdit(key))return true;
    notify('warning','Acceso restringido','Este perfil solo puede consultar el módulo '+CONFIG[key].title+'.');
    return false;
  }
  function selectCatalog(key){
    selected=CONFIG[key]?key:'rubros';
    render();
  }
  function mount(productProvider){
    productRecords=typeof productProvider==='function'?productProvider:()=>[];
    // La sección se monta dentro de la pantalla Administración sin cambiar el resto de la app.
    const root=$('#workspaceContent');if(!root)return;
    if($('#catalogAdmin',root)){render();return;}
    const wrapper=el('section','catalog-admin');
    wrapper.id='catalogAdmin';
    wrapper.innerHTML='<div class="catalog-intro"><div><span class="overline">MAESTROS COMERCIALES</span><h2>Clasificación y atributos de productos</h2><p>Administra la jerarquía Rubro → Departamento → Familia → Línea, marcas, modelos y atributos. Todo queda en este navegador.</p></div></div><div class="catalog-admin-grid"><aside class="catalog-sidebar" aria-label="Catálogos de administración"><h3>Catálogos</h3><div class="catalog-tabs" id="catalogTabs"></div></aside><section class="catalog-main"><div id="catalogContent"></div></section></div>';
    root.prepend(wrapper);
    if(!$('#catalogFormDialog'))createDialogs();
    wrapper.addEventListener('click',handleClick);
    render();
  }
  function render(){
    const wrapper=$('#catalogAdmin');if(!wrapper)return;
    const tabs=$('#catalogTabs');
    tabs.replaceChildren();
    ORDER.forEach(key=>{
      const b=makeButton(CONFIG[key].title,'choose',key,null,'catalog-tab');
      b.classList.toggle('selected',selected===key);
      b.setAttribute('aria-pressed',selected===key?'true':'false');
      const count=el('span','catalog-counter',String(catalog(key).length));
      b.appendChild(count);tabs.appendChild(b);
    });
    const cfg=CONFIG[selected],target=$('#catalogContent');target.replaceChildren();
    const head=el('div','catalog-header'),title=el('div');
    add(title,el('h3','',cfg.title),el('p','',cfg.parent?'Selecciona primero el '+CONFIG[cfg.parent].singular.toLocaleLowerCase('es-CL')+' al crear un registro.':'Puedes crear, editar y eliminar registros no utilizados.'));
    const newBtn=makeButton('Nuevo '+cfg.singular.toLocaleLowerCase('es-CL'),'new',selected,null,'button primary');
    newBtn.disabled=!canEdit(selected);
    add(head,title,newBtn);target.appendChild(head);
    const items=catalog(selected);
    if(!items.length){target.appendChild(el('div','catalog-empty','No hay registros en este catálogo. Usa «Nuevo» para comenzar.'));return;}
    const scroll=el('div','catalog-table-scroll'),table=el('table','catalog-table');
    const tHead=el('thead'),tr=el('tr');
    ['Nombre',...(cfg.parent?[CONFIG[cfg.parent].singular]:[]),'Estado','Acciones'].forEach(t=>tr.appendChild(el('th','',t)));
    tHead.appendChild(tr);table.appendChild(tHead);
    const body=el('tbody');
    items.forEach(rec=>{
      const row=el('tr');
      row.appendChild(el('td','',rec.nombre));
      if(cfg.parent)row.appendChild(el('td','',label(cfg.parent,rec.parentId)));
      const state=el('td');
      state.appendChild(el('span','pill '+(rec.activo!==false?'success':'warning'),rec.activo!==false?'Activo':'Inactivo'));
      row.appendChild(state);
      const buttons=el('td','catalog-actions');
      add(buttons,makeButton('Editar','edit',selected,rec.id,'catalog-small-button'),
        makeButton('Eliminar','delete',selected,rec.id,'catalog-small-button danger-text'));
      buttons.querySelectorAll('button').forEach(b=>b.disabled=!canEdit(selected));
      row.appendChild(buttons);body.appendChild(row);
    });
    table.appendChild(body);scroll.appendChild(table);target.appendChild(scroll);
    target.appendChild(el('p','catalog-footnote',items.length+' registros · Los catálogos se guardan localmente.'));
  }
  function createDialogs(){
    const form=document.createElement('dialog');form.id='catalogFormDialog';form.className='modal catalog-dialog';
    form.innerHTML='<form id="catalogForm" novalidate><div class="modal-heading"><div><span class="overline">ADMINISTRACIÓN</span><h2 id="catalogFormTitle">Nuevo catálogo</h2></div><button type="button" class="icon-button" id="catalogFormClose" aria-label="Cerrar">×</button></div><div class="modal-body"><div class="form-grid"><div class="field full"><label for="catalogName">Nombre o valor <span class="required">*</span></label><input id="catalogName" maxlength="120" required></div><div class="field full" id="catalogParentRow" hidden><label for="catalogParent">Pertenece a <span class="required">*</span></label><select id="catalogParent"></select></div><div class="field full"><label for="catalogActive">Estado</label><select id="catalogActive"><option value="1">Activo</option><option value="0">Inactivo</option></select></div></div><p id="catalogFormError" class="form-error" role="alert" hidden></p></div><div class="modal-footer"><button type="button" class="button ghost" id="catalogFormCancel">Cancelar</button><button type="submit" class="button primary">Guardar catálogo</button></div></form>';
    document.body.appendChild(form);
    $('#catalogForm').addEventListener('submit',saveForm);
    $('#catalogFormCancel').addEventListener('click',()=>form.close());
    $('#catalogFormClose').addEventListener('click',()=>form.close());
    const confirm=document.createElement('dialog');confirm.id='catalogDeleteDialog';confirm.className='modal confirm-modal';
    confirm.innerHTML='<div class="confirm-symbol"><span aria-hidden="true">!</span></div><h2>¿Eliminar del catálogo?</h2><p id="catalogDeleteText"></p><div class="modal-footer centered"><button type="button" class="button ghost" id="catalogDeleteCancel">Cancelar</button><button type="button" class="button danger" id="catalogDeleteAccept">Eliminar</button></div>';
    document.body.appendChild(confirm);
    $('#catalogDeleteCancel').addEventListener('click',()=>confirm.close());
    $('#catalogDeleteAccept').addEventListener('click',remove);
    confirm.addEventListener('close',()=>{pending=null;});
  }
  function handleClick(e){
    const b=e.target.closest('[data-catalog-action]');
    if(!b)return;
    switch(b.dataset.catalogAction){
      case 'choose':selectCatalog(b.dataset.catalog);break;
      case 'new':openForm(b.dataset.catalog,null);break;
      case 'edit':openForm(b.dataset.catalog,b.dataset.id);break;
      case 'delete':askDelete(b.dataset.catalog,b.dataset.id);break;
    }
  }
  function openForm(key,id){
    if(!CONFIG[key]||!ensureEdit(key))return;
    const cfg=CONFIG[key],record=id===null?null:catalog(key).find(r=>String(r.id)===String(id));
    if(id!==null&&!record)return;
    editing={key,id:record?.id??null};
    $('#catalogFormTitle').textContent=(record?'Editar ':'Nuevo ')+cfg.singular.toLocaleLowerCase('es-CL');
    $('#catalogFormError').hidden=true;
    const name=$('#catalogName');
    name.type=cfg.numeric?'number':'text';
    if(cfg.numeric){name.min='0';name.step='0.001';}else{name.removeAttribute('min');name.removeAttribute('step');}
    name.value=record?.nombre??'';
    $('#catalogActive').value=record?.activo===false?'0':'1';
    const parentRow=$('#catalogParentRow');
    parentRow.hidden=!cfg.parent;
    const select=$('#catalogParent');select.replaceChildren(createOption('','Selecciona una opción'));
    if(cfg.parent){
      catalog(cfg.parent).filter(p=>p.activo!==false||String(p.id)===String(record?.parentId)).forEach(p=>select.appendChild(createOption(p.id,p.nombre)));
      select.value=String(record?.parentId??'');
    }
    $('#catalogFormDialog').showModal();
    setTimeout(()=>name.focus(),25);
  }
  function formError(message){
    const p=$('#catalogFormError');p.textContent=message;p.hidden=false;
  }
  function saveForm(e){
    e.preventDefault();if(!editing||!ensureEdit(editing.key))return;
    const {key,id}=editing,cfg=CONFIG[key];
    let name=$('#catalogName').value.trim();
    const parentId=cfg.parent?$('#catalogParent').value:null;
    const active=$('#catalogActive').value==='1';
    if(!name){formError('Ingresa un nombre o valor.');return;}
    if(cfg.parent&&!parentId){formError('Debes elegir un '+CONFIG[cfg.parent].singular.toLocaleLowerCase('es-CL')+'.');return;}
    if(cfg.numeric){
      const n=Number(name);
      if(!Number.isFinite(n)||n<0||n>1000000){formError('Los gramos deben ser un número entre 0 y 1.000.000.');return;}
      name=String(n);
    }
    if(cfg.tax&&!['afecto','exento'].includes(normalize(name))){formError('La condición tributaria solo admite «Afecto» o «Exento».');return;}
    const duplicate=catalog(key).some(r=>String(r.id)!==String(id)&&normalize(r.nombre)===normalize(name)&&String(r.parentId??'')===String(parentId??''));
    if(duplicate){formError('Ya existe este valor en el mismo nivel.');return;}
    // No permitir inactivar un registro usado por un producto o por catálogos dependientes.
    if(!active&&id!==null&&isReferenced(key,id)){formError('El registro está en uso; no puede inactivarse.');return;}
    const rec=id===null?{id:'cat-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)}:catalog(key).find(r=>String(r.id)===String(id));
    if(!rec)return;
    Object.assign(rec,{nombre:name,parentId,activo:active});
    if(id===null)catalog(key).push(rec);
    if(!save())return;
    $('#catalogFormDialog').close();editing=null;
    notify('success',id===null?'Catálogo creado':'Catálogo actualizado',cfg.singular+' guardado en este navegador.');
    render();window.RutaCatalogos.onChange?.();
  }
  function isReferenced(key,id){
    if(children(key,id).length)return true;
    const references=Object.entries(LABELS).filter(([,v])=>v===key).map(([k])=>k);
    return productRecords().some(p=>references.some(k=>String(p[k])===String(id)));
  }
  function askDelete(key,id){
    if(!ensureEdit(key))return;
    const rec=catalog(key).find(r=>String(r.id)===String(id));if(!rec)return;
    if(isReferenced(key,id)){notify('warning','Registro en uso','No puedes eliminarlo: está asociado a un producto o a un catálogo subordinado.');return;}
    pending={key,id};
    $('#catalogDeleteText').textContent='Se eliminará «'+rec.nombre+'» de '+CONFIG[key].title.toLocaleLowerCase('es-CL')+'. Esta acción no se puede deshacer.';
    $('#catalogDeleteDialog').showModal();
  }
  function remove(){
    if(!pending)return;
    const {key,id}=pending;
    if(!ensureEdit(key))return;
    if(isReferenced(key,id)){notify('error','No se puede eliminar','El registro se encuentra referenciado.');$('#catalogDeleteDialog').close();return;}
    data[key]=catalog(key).filter(r=>String(r.id)!==String(id));
    if(save()){
      notify('success','Eliminación completada','El registro se eliminó del catálogo local.');
      render();window.RutaCatalogos.onChange?.();
    }
    $('#catalogDeleteDialog').close();
  }
  function reset(){Object.assign(data,defaults());save();render();}
  window.RutaCatalogos={CONFIG,ORDER,LABELS,CASCADE,data,catalog,label,productLabel,activeList,canCreateProduct,attachProductForm,mount,selectCatalog,reset,onChange:null};
})();