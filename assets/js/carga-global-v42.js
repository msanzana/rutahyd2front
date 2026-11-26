/* Ruta H&D V42 · Indicador de carga único para CRUD, consultas y buscadores.
 * Solo presentación. No modifica rutas, datos ni métodos de negocio.
 * Las peticiones API se contabilizan por ticket y siempre cierran en finally.
 */
(()=>{
  'use strict';
  const active=new Map();
  const SHOW_DELAY_MS=130;
  const MIN_VISIBLE_MS=240;
  let serial=0,showTimer=null,closeTimer=null,visibleSince=0;
  let dialog=null,caption=null,subtitle=null;
  const labels={
    'giros-sii':'giros SII',
    'productos/buscador':'productos',
    'proveedores-productos':'productos del proveedor',
    'proveedores/mix':'productos de proveedores',
    'productos':'productos',
    'usuarios':'usuarios',
    'perfiles':'perfiles y permisos',
    'listas-precios':'listas de precios',
    'listas_precios':'listas de precios',
    'catalogos':'clasificaciones',
    'ubicaciones':'ubicaciones',
    'recursos/proveedores':'proveedores',
    'recursos/clientes':'clientes',
    'recursos/bodegas':'bodegas',
    'fotos':'fotografías',
    'recepciones-borrador':'datos de recepción',
    'consolidaciones-recepcion':'datos de consolidación',
    'ordenes-compra':'órdenes de compra',
    'tipos-documentos':'tipos de documento',
    'consultas-compras':'datos de compras',
    'ventas':'ventas',
    'clientes':'clientes',
    'proveedores':'proveedores',
    'precios':'precios'
  };
  function label(path,method){
    const clean=String(path||'').split('?')[0].replace(/^\/+/,'');
    const key=Object.keys(labels).find(k=>clean===k||clean.startsWith(k+'/'));
    const noun=key?labels[key]:'registros';
    const upper=String(method||'GET').toUpperCase();
    if(upper==='GET'){
      if(clean.includes('buscador')||clean.includes('giros-sii')||/(\?|^\/)/.test(path)&&String(path).includes('buscar='))
        return 'Buscando '+noun+'…';
      return 'Cargando '+noun+'…';
    }
    if(upper==='DELETE')return 'Procesando cambio de estado…';
    if(clean.includes('/lote'))return 'Guardando productos seleccionados…';
    if(upper==='POST')return 'Guardando '+noun+'…';
    return 'Actualizando '+noun+'…';
  }
  function ensureDialog(){
    if(dialog?.isConnected)return;
    if(!document.body)return;
    dialog=document.createElement('dialog');
    dialog.className='hd-loading-overlay';
    dialog.setAttribute('aria-label','Solicitud en curso');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('data-hd-loading','');
    const body=document.createElement('div');body.className='hd-loading-content';
    const brand=document.createElement('span');brand.className='hd-loading-brand';
    brand.textContent='RUTA H&D';
    brand.setAttribute('aria-hidden','true');
    const spinner=document.createElement('div');spinner.className='hd-loading-animation';
    spinner.setAttribute('aria-hidden','true');
    spinner.innerHTML='<span></span><span></span><span></span>';
    caption=document.createElement('strong');caption.className='hd-loading-title';
    caption.id='hd-loading-title';caption.textContent='Cargando información…';
    subtitle=document.createElement('p');subtitle.className='hd-loading-subtitle';
    subtitle.textContent='Estamos procesando tu solicitud.';
    const status=document.createElement('div');status.className='hd-loading-status';
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    status.setAttribute('aria-atomic','true');
    status.append(caption,subtitle);
    body.append(brand,spinner,status);
    dialog.append(body);
    dialog.setAttribute('aria-labelledby',caption.id);
    dialog.addEventListener('cancel',event=>{
      // Un Escape no debe ocultar un proceso que sigue en ejecución.
      if(active.size)event.preventDefault();
    });
    document.body.append(dialog);
  }
  function clearTimers(){
    if(showTimer!==null){clearTimeout(showTimer);showTimer=null;}
    if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}
  }
  function updateText(){
    if(!caption||!active.size)return;
    const latest=[...active.values()].at(-1);
    caption.textContent=latest?.text||'Cargando información…';
    subtitle.textContent=active.size>1
      ?'Procesando '+active.size+' solicitudes.':'Estamos procesando tu solicitud.';
  }
  function openNow(){
    showTimer=null;
    if(!active.size)return;
    ensureDialog();
    if(!dialog)return;
    updateText();
    if(!dialog.open){
      try{dialog.showModal();visibleSince=Date.now();}
      catch(_){/* No bloquear una operación si el DOM se desmontó. */}
    }
  }
  function hideWhenDone(){
    if(active.size)return;
    if(showTimer!==null){clearTimeout(showTimer);showTimer=null;}
    if(!dialog?.open)return;
    const wait=Math.max(0,MIN_VISIBLE_MS-(Date.now()-visibleSince));
    if(closeTimer!==null)clearTimeout(closeTimer);
    closeTimer=setTimeout(()=>{
      closeTimer=null;
      if(!active.size&&dialog?.open)dialog.close();
    },wait);
  }
  // Lecturas parciales de cualquier formulario o buscador abierto.
  // No bloquear Cerrar ni ocultar el contenido que ya se ha cargado.
  const localReads=new WeakMap(),localEntries=new Set();
  function currentOwner(){
    const open=[...document.querySelectorAll('dialog[open]:not([data-hd-loading])')];
    return open.filter(d=>d.matches(':modal')).at(-1)||open.at(-1)||null;
  }
  function disposeLocal(owner,entry){
    clearTimeout(entry.timer);entry.tickets.clear();entry.status.remove();
    owner.removeAttribute('data-hd-local-loading');for(const node of entry.fields||[])node.removeAttribute('data-hd-loading-field');localReads.delete(owner);localEntries.delete(entry);
    owner.removeEventListener('close',entry.onClose);
  }
  function pendingFields(owner,path){
    const clean=String(path||'').split('?')[0].replace(/^\/+/,''),selectors=[];
    if(clean.startsWith('tipos-documentos'))selectors.push('#hd-recepcion-documento-tipo');
    if(clean.startsWith('recursos/bodegas'))selectors.push('#hd-recepcion-bodega');
    return selectors.flatMap(selector=>[...owner.querySelectorAll(selector)].map(node=>node.closest('label')||node.parentElement).filter(Boolean));
  }
  function localRead(owner,text,path){
    let entry=localReads.get(owner);
    if(!entry){
      const status=document.createElement('div');status.className='hd-form-loading';status.hidden=true;
      status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
      const ring=document.createElement('span');ring.className='hd-form-loading-ring';ring.setAttribute('aria-hidden','true');
      const message=document.createElement('span');message.className='hd-form-loading-text';status.append(ring,message);
      const region=owner.querySelector('.hd-doc-modal-scroll,.product-detail-content,.crud-dialog-body,.modal-body,.crud-body,.product-editor-scroll');
      if(region)region.prepend(status);else owner.prepend(status);
      entry={owner,status,message,tickets:new Map(),timer:null,onClose:null,fields:new Set()};
      entry.onClose=()=>disposeLocal(owner,entry);owner.addEventListener('close',entry.onClose);
      localReads.set(owner,entry);localEntries.add(entry);
    }
    const ticket=++serial;entry.tickets.set(ticket,{text,fields:pendingFields(owner,path)});owner.setAttribute('data-hd-local-loading','');
    const paint=()=>{
      const latest=[...entry.tickets.values()].at(-1)?.text||'Cargando información…';
      const next=new Set([...entry.tickets.values()].flatMap(t=>t.fields));for(const node of entry.fields)if(!next.has(node))node.removeAttribute('data-hd-loading-field');for(const node of next)if(!entry.status.hidden)node.setAttribute('data-hd-loading-field','');entry.fields=next;
      entry.message.textContent=latest+(entry.tickets.size>1?' · '+entry.tickets.size+' consultas en curso':'');
    };
    paint();
    if(entry.status.hidden&&entry.timer===null)entry.timer=setTimeout(()=>{
      entry.timer=null;if(entry.tickets.size&&owner.open&&owner.isConnected){entry.status.hidden=false;paint();}
    },SHOW_DELAY_MS);
    let closed=false;
    return ()=>{if(closed)return;closed=true;entry.tickets.delete(ticket);
      if(entry.tickets.size)paint();else if(localReads.get(owner)===entry)disposeLocal(owner,entry);
    };
  }
  function start({path='',method='GET',message=''}={}){
    const owner=currentOwner();
    if(owner&&String(method).toUpperCase()==='GET')
      return localRead(owner,String(message||label(path,method)).slice(0,120),path);
    // Es intencional que el popup no aparezca para lecturas instantáneas:
    // evita parpadeos en listas y catálogos cacheados.
    const ticket=++serial;
    active.set(ticket,{text:String(message||label(path,method)).slice(0,120)});
    if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}
    if(dialog?.open)updateText();
    else if(showTimer===null)showTimer=setTimeout(openNow,SHOW_DELAY_MS);
    let closed=false;
    return ()=>{
      if(closed)return;closed=true;
      active.delete(ticket);
      if(active.size){updateText();return;}
      hideWhenDone();
    };
  }
  async function track(promise,options={}){
    const finish=start(options);
    try{return await promise;}finally{finish();}
  }
  function reset(){
    clearTimers();
    active.clear();
    for(const entry of [...localEntries])disposeLocal(entry.owner,entry);
    if(dialog?.open)dialog.close();
  }
  window.RutaHDCarga=Object.freeze({
    start,track,reset,
    isLoading:()=>active.size>0||localEntries.size>0
  });
})();
