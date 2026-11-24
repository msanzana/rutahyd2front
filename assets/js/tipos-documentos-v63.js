/* Ruta H&D V63 · Administración -> Documentos · catálogo real MySQL. */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const ui=()=>window.RutaHDListUI;
 const acl=()=>window.RutaHDAccesos;
 const seeded=new Set(['FACTURA_ELECTRONICA','FACTURA_EXENTA','BOLETA_ELECTRONICA',
  'BOLETA_EXENTA','FACTURA_COMPRA_ELECTRONICA','GUIA_DESPACHO_ELECTRONICA',
  'NOTA_DEBITO_ELECTRONICA','NOTA_CREDITO_ELECTRONICA','ORDEN_COMPRA']);
 const familias=['FACTURA','BOLETA','FACTURA_COMPRA','GUIA','NOTA_DEBITO','NOTA_CREDITO','INTERNO'];
 const labels={FACTURA:'Factura',BOLETA:'Boleta',FACTURA_COMPRA:'Factura de compra',
  GUIA:'Guía',NOTA_DEBITO:'Nota de débito',NOTA_CREDITO:'Nota de crédito',
  INTERNO:'Documento interno'};
 const elem=(tag,text,className)=>{
  const e=document.createElement(tag);
  if(text!==undefined&&text!==null)e.textContent=String(text);
  if(className)e.className=className;
  return e;
 };
 const button=(text,handler,cls='button ghost')=>{
  const e=elem('button',text,cls);e.type='button';e.addEventListener('click',handler);return e;
 };
 const canManage=()=>Boolean(acl()?.isAdmin()||acl()?.has('administracion.documentos.gestionar'));
 const active=v=>Number(v)===1;
 const explainError=e=>e?.userMessage||(/Error HTTP \d+/.test(String(e?.message||''))?
  'El servidor rechazó la solicitud: '+e.message:(e?.message||'No se pudo completar la operación.'));
 const createField=(caption,control)=>{
  const label=elem('label',undefined,'hd-doc-field');
  label.append(elem('span',caption));label.append(control);return label;
 };
 const input=(value='',type='text')=>{const e=elem('input');e.type=type;e.value=value??'';return e;};
 const select=(options,value)=>{const e=elem('select');
  options.forEach(([id,name])=>{const o=elem('option',name);o.value=String(id);e.append(o);});
  e.value=String(value??'');return e;
 };
 function dialogFor(record,callback){
  const edit=Boolean(record?.id);
  const official=seeded.has(record?.codigo);
  const dialog=elem('dialog',undefined,'modal hd-doc-modal');
  dialog.setAttribute('aria-label',edit?'Editar tipo de documento':'Nuevo tipo de documento');
  const form=elem('form',undefined,'hd-doc-form');form.noValidate=true;
  const head=elem('header',undefined,'hd-doc-modal-head');
  const h=elem('h2',edit?'Modificar documento':'Nuevo documento');
  head.append(h,elem('p','Catálogo de documentos de Ruta H&D y códigos del SII.'));
  const close=button('Cerrar ventana',()=>dialog.close(),'hd-doc-close');
  close.setAttribute('aria-label','Cerrar ventana');head.append(close);
  const body=elem('div',undefined,'hd-doc-modal-scroll');
  const fields=elem('div',undefined,'hd-doc-grid');
  ui()?.recordCode?.(fields,record?.id??null);
  const codigo=input(record?.codigo||'');codigo.maxLength=40;
  codigo.placeholder='EJEMPLO_DOCUMENTO';codigo.required=true;
  const sii=input(record?.codigo_sii??'','number');sii.min='1';sii.max='999';sii.step='1';sii.placeholder='Sin código para documentos internos';
  const nombre=input(record?.nombre||'');nombre.required=true;nombre.maxLength=150;
  const familia=select(familias.map(k=>[k,labels[k]]),record?.familia||'FACTURA');
  const orden=input(String(record?.orden??0),'number');orden.min='0';orden.max='65535';orden.step='1';
  const dias=input(String(record?.dias_vencimiento??0),'number');dias.min='0';dias.max='65535';dias.step='1';
  for(const [cap,el] of [
   ['Código interno',codigo],['Código SII',sii],['Nombre del documento',nombre],
   ['Familia',familia],['Orden en listados',orden],['Días de vencimiento',dias]
  ])fields.append(createField(cap,el));
  const switches=elem('fieldset',undefined,'hd-doc-flags');
  switches.append(elem('legend','Opciones del documento'));
  const bools={};
  for(const [key,label] of [
   ['documento_venta','Documento de venta'],
   ['documento_compra','Documento de compra'],
   ['disponible_pos','Disponible para POS y notas de venta'],
   ['documento_electronico','Documento electrónico SII'],
   ['activo','Activo']
  ]){
   const control=elem('input');control.type='checkbox';control.checked=active(record?.[key]??(key==='activo'?1:0));
   const wrapper=elem('label',undefined,'hd-doc-switch');wrapper.append(control,elem('span',label));
   switches.append(wrapper);bools[key]=control;
  }
  if(official){
   for(const el of [codigo,sii,familia,bools.documento_venta,
    bools.documento_compra,bools.documento_electronico])el.disabled=true;
   fields.append(elem('p','Los códigos y clasificaciones normativas de los documentos iniciales están protegidos.','hd-doc-help'));
  }
  const sync=()=>{
   if(official)return;
   const internal=familia.value==='INTERNO';
   if(internal){sii.value='';bools.documento_electronico.checked=false;}
   else bools.documento_electronico.checked=true;
   sii.disabled=internal;
   if(!bools.documento_venta.checked)bools.disponible_pos.checked=false;
   bools.disponible_pos.disabled=!bools.documento_venta.checked;
  };
  familia.addEventListener('change',sync);
  bools.documento_venta.addEventListener('change',sync);
  sync();
  body.append(fields,switches);
  const error=elem('p','', 'hd-doc-message');error.setAttribute('role','status');
  const foot=elem('footer',undefined,'hd-doc-modal-footer');
  const cancel=button('Cancelar',()=>dialog.close());
  const save=button('Guardar',()=>form.requestSubmit(),'button primary');
  foot.append(cancel,save);
  form.append(head,body,error,foot);dialog.append(form);
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   codigo.value=codigo.value.trim().toUpperCase().replace(/\s+/g,'_');
   nombre.value=nombre.value.trim();
   if(!/^[A-Z][A-Z0-9_]{2,39}$/.test(codigo.value)){
    error.textContent='El código interno requiere letras mayúsculas, números o guiones bajos.';return;
   }
   if(nombre.value.length<3){error.textContent='Completa el nombre del documento.';return;}
   const dato={
    codigo:codigo.value,nombre:nombre.value,
    codigo_sii:sii.value===''?null:Number(sii.value),
    familia:familia.value,orden:Number(orden.value),dias_vencimiento:Number(dias.value),
    documento_venta:Number(bools.documento_venta.checked),
    documento_compra:Number(bools.documento_compra.checked),
    disponible_pos:Number(bools.disponible_pos.checked),
    documento_electronico:Number(bools.documento_electronico.checked),
    activo:Number(bools.activo.checked)
   };
   if(dato.disponible_pos&&!dato.documento_venta){
    error.textContent='Solo un documento de venta puede estar disponible en POS.';return;
   }
   save.disabled=true;cancel.disabled=true;error.textContent='Guardando documento…';
   try{
    if(edit)await api().updateDocumentType(record.id,dato);
    else await api().createDocumentType(dato);
    if(dialog.open){dialog.close();await callback(edit?'Documento actualizado.':'Documento creado.');}
   }catch(e){error.textContent=explainError(e);}
   finally{save.disabled=false;cancel.disabled=false;}
  });
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);dialog.showModal();
  nombre.focus();
 }
 async function mount(root){
  const alive=()=>root?.isConnected;
  root.replaceChildren();
  const shell=elem('section',undefined,'hd-documents');
  const heading=elem('div',undefined,'hd-doc-heading');
  const h=elem('div');h.append(elem('h2','Documentos'),
   elem('p','Catálogo de documentos tributarios e internos. Los códigos SII oficiales están protegidos.'));
  const newBtn=button('Nuevo documento',()=>dialogFor(null,()=>load()),'button primary');
  newBtn.disabled=!canManage();
  heading.append(h,newBtn);
  const search=elem('form',undefined,'hd-doc-filter');
  const q=input('','search');q.placeholder='Buscar nombre, código o código SII';
  q.setAttribute('aria-label','Buscar documentos');
  const family=select([['','Todas las familias'],...familias.map(x=>[x,labels[x]])],'');
  family.setAttribute('aria-label','Filtrar familia');
  const status=select([['1','Activos'],['0','Historial de inactivos']],'1');
  status.setAttribute('aria-label','Filtrar estado');
  const submit=button('Buscar',()=>{page=1;void load();},'button primary');
  search.append(q,family,status,submit);
  search.addEventListener('submit',e=>{e.preventDefault();page=1;void load();});
  family.addEventListener('change',()=>{page=1;void load();});
  status.addEventListener('change',()=>{page=1;void load();});
  const message=elem('p','', 'hd-doc-status');message.setAttribute('role','status');
  const pagerTop=elem('div',undefined,'hd-doc-pager');
  const scroll=elem('div',undefined,'hd-doc-table-scroll');
  const table=elem('table',undefined,'normalized-table hd-doc-table');
  table.innerHTML='<thead><tr><th>Código</th><th>Código SII</th><th>Documento</th><th>Familia</th><th>Compra</th><th>Venta</th><th>POS</th><th>Electrónico</th><th>Días</th><th>Estado</th><th>Acciones</th></tr></thead>';
  const tbody=elem('tbody');table.append(tbody);scroll.append(table);
  const pagerBottom=elem('div',undefined,'hd-doc-pager');
  shell.append(heading,search,message,pagerTop,scroll,pagerBottom);
  root.append(shell);
  let page=1,request=0;
  function pager(container,total,last){
   container.replaceChildren();
   const caption=elem('span',total+' registro(s) · Página '+page+' de '+last);
   const prev=button('Anterior',()=>{page=Math.max(1,page-1);void load(true);});
   const next=button('Siguiente',()=>{page=Math.min(last,page+1);void load(true);});
   prev.disabled=page<=1;next.disabled=page>=last;
   container.append(caption,prev,next);
   const n=Math.min(5,last);
   const begin=Math.max(1,Math.min(page-Math.floor(n/2),last-n+1));
   for(let i=begin;i<begin+n;i++){
    const b=button(String(i),()=>{page=i;void load(true);});
    if(i===page)b.classList.add('is-current');
    b.setAttribute('aria-label','Ir a página '+i);
    container.append(b);
   }
  }
  const yes=flag=>active(flag)?'Sí':'No';
  async function load(goTop=false){
   const token=++request;
   message.textContent='Cargando documentos…';
   try{
    const data=await api().documentTypes({page,buscar:q.value.trim(),familia:family.value,activo:status.value});
    if(token!==request||!alive())return;
    tbody.replaceChildren();
    const rows=data?.data||[];
    for(const record of rows){
     const tr=elem('tr');
     const values=[record.id,record.codigo_sii??'—',record.nombre,
      labels[record.familia]||record.familia,yes(record.documento_compra),
      yes(record.documento_venta),yes(record.disponible_pos),
      yes(record.documento_electronico),record.dias_vencimiento];
     for(let j=0;j<values.length;j++){
      const cell=elem('td',values[j]);if(j===0)cell.title='Identificador interno: '+record.id;
      tr.append(cell);
     }
     // La columna Código del CRUD usa el ID de la tabla. El código SII va aparte.
     tr.cells[0].textContent=String(record.id);
     const stateCell=elem('td');
     if(canManage()&&ui()?.statusSwitch){
      stateCell.append(ui().statusSwitch(record.nombre,active(record.activo),async wanted=>{
       await api().setDocumentTypeActive(record.id,Number(wanted));
       await load();
      }));
     }else stateCell.append(elem('span',active(record.activo)?'Activo':'Inactivo'));
     tr.append(stateCell);
     const actions=elem('td');
     actions.className='list-action-cell';
     const edit=ui()?.action?.('Modificar '+record.nombre,()=>dialogFor(record,()=>load()),{kind:'editar'});
     if(edit){edit.disabled=!canManage();actions.append(edit);}
     tr.append(actions);tbody.append(tr);
    }
    if(!rows.length){
     const tr=elem('tr'),td=elem('td','No se encontraron documentos.');
     td.colSpan=11;tr.append(td);tbody.append(tr);
    }
    const last=Math.max(1,Number(data.last_page||1));
    pager(pagerTop,Number(data.total||0),last);
    pager(pagerBottom,Number(data.total||0),last);
    message.textContent='Consulta actualizada.';
    if(goTop)window.scrollTo({top:0,behavior:'smooth'});
   }catch(e){if(token===request&&alive()){message.textContent=explainError(e);message.setAttribute('role','alert');}}
  }
  await load();
 }
 window.RutaHDTiposDocumentos=Object.freeze({mount});
})();
