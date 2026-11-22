/* Ruta H&D V2 · Galería profesional por producto, aislada del formulario CRUD.
   Las fotografías se recuperan únicamente con JWT y se revocan al cerrar. */
(()=>{
 'use strict';
 const api=()=>window.RutaHDApiCatalogos;
 const el=(tag,cls,text)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=String(text);
  return n;
 };
 const button=(text,handler,cls='button ghost')=>{
  const b=el('button',cls,text);b.type='button';
  b.addEventListener('click',handler);return b;
 };
 const error=e=>e?.userMessage||(e?.status===503?
  'Falta importar DDL25 (productos_fotos) en MariaDB.':'No se pudo completar la operación de fotos. Comprueba la conexión y permisos.');
 const MAX_FILES=6,MAX_BYTES=2097152;
 function open(product){
  const dialog=el('dialog','modal crud-dialog product-gallery-dialog');
  const panel=el('div','product-gallery-shell');
  dialog.setAttribute('aria-label','Galería de fotografías · '+product.nombre);
  const heading=el('header','product-gallery-header');
  const headingContent=el('div','');
  headingContent.append(el('span','overline','RUTA H&D · GALERÍA DE PRODUCTOS'),
    el('h2','',product.nombre),el('p','',product.sku+' · Fotos en MariaDB'));
  const close=button('×',()=>dialog.close(),'crud-close');
  close.setAttribute('aria-label','Cerrar galería');
  heading.append(headingContent,close);panel.append(heading);
  const body=el('div','product-gallery-body');
  const viewer=el('section','product-gallery-viewer');
  const stage=el('div','product-gallery-stage');
  const main=el('img','product-gallery-large');
  main.alt='Fotografía de producto';main.hidden=true;
  const empty=el('div','product-gallery-empty');
  empty.append(el('span','product-gallery-empty-icon','▧'),
    el('strong','','Galería sin fotografías'),
    el('p','','Arrastra imágenes aquí o selecciónalas desde tu equipo.'));
  stage.append(main,empty);
  const arrows=el('div','product-gallery-arrows');
  const prev=button('‹',()=>void select(index-1),'gallery-arrow');
  prev.setAttribute('title','Fotografía anterior');prev.setAttribute('aria-label','Fotografía anterior');
  const current=el('span','product-gallery-counter','0 de 0');
  const next=button('›',()=>void select(index+1),'gallery-arrow');
  next.setAttribute('title','Fotografía siguiente');next.setAttribute('aria-label','Fotografía siguiente');
  arrows.append(prev,current,next);
  const thumbs=el('div','product-gallery-thumbnails');
  thumbs.setAttribute('aria-label','Miniaturas de fotografías del producto');
  viewer.append(stage,arrows,thumbs);
  const aside=el('aside','product-gallery-tools');
  aside.append(el('h3','','Agregar fotografías'),
    el('p','catalog-footnote','JPG, PNG o WebP · máximo 2 MB por foto · hasta 6 por envío.'));
  const drop=el('div','product-gallery-drop');
  drop.setAttribute('role','button');drop.tabIndex=0;
  drop.setAttribute('aria-label','Arrastra imágenes o examina archivos para agregarlos');
  const dropIcon=el('span','product-gallery-drop-icon','＋');
  const label=el('strong','','Arrastra tus fotos aquí');
  const hint=el('span','','o selecciona archivos de tu equipo');
  const browse=button('Examinar fotos',()=>input.click(),'button ghost');
  const input=el('input','product-gallery-file');
  input.type='file';input.multiple=true;input.accept='image/jpeg,image/png,image/webp';
  input.hidden=true;input.setAttribute('aria-label','Examinar fotos del producto');
  const preview=el('div','product-gallery-pending-preview');
  preview.hidden=true;preview.setAttribute('role','group');
  preview.setAttribute('aria-label','Vista previa de las imágenes por cargar');
  drop.append(dropIcon,preview,label,hint,browse,input);
  aside.append(drop);
  const selected=el('p','product-gallery-selection','No hay archivos seleccionados');
  const submit=button('Guardar fotos',()=>void upload(),'button primary');
  submit.disabled=true;
  const cancelSelection=button('Limpiar selección',()=>setFiles([]),'button ghost');
  const controls=el('div','product-gallery-upload-actions');
  controls.append(submit,cancelSelection);
  const status=el('p','product-gallery-status','');status.setAttribute('role','status');
  aside.append(selected,controls,status);
  body.append(viewer,aside);panel.append(body);dialog.append(panel);
  document.body.append(dialog);dialog.showModal();
  let photos=[],index=-1,files=[],working=false,live=true,ticket=0;
  const urls=new Map(),pending=new Map(),previewUrls=[];
  const clearPreview=()=>{
    previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls.length=0;
    preview.replaceChildren();preview.hidden=true;
    dropIcon.hidden=false;drop.classList.remove('has-selection');
    label.textContent='Arrastra tus fotos aquí';
    hint.textContent='o selecciona archivos de tu equipo';
  };
  const release=()=>{
    clearPreview();
    for(const url of urls.values())URL.revokeObjectURL(url);
    urls.clear();pending.clear();
  };
  dialog.addEventListener('close',()=>{live=false;ticket++;release();dialog.remove();},{once:true});
  function setFiles(raw){
    const incoming=Array.from(raw||[]);
    if(incoming.length>MAX_FILES){status.textContent='Puedes cargar un máximo de 6 fotografías por envío.';return;}
    if(incoming.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||
      f.size>MAX_BYTES||f.size<1)){
      status.textContent='Utiliza JPG, PNG o WebP de hasta 2 MB por fotografía.';return;
    }
    clearPreview();files=incoming;
    // Vista previa LOCAL; las fotos no se envían hasta presionar Guardar fotos.
    if(files.length){
      files.forEach((file,i)=>{
        const url=URL.createObjectURL(file);previewUrls.push(url);
        const thumb=el('figure','product-gallery-pending-item');
        const img=el('img','product-gallery-pending-image');
        img.src=url;img.alt='Foto por cargar '+(i+1)+': '+file.name;
        const caption=el('figcaption','',String(i+1)+' · '+Math.max(1,Math.ceil(file.size/1024))+' KB');
        thumb.append(img,caption);preview.append(thumb);
      });
      preview.hidden=false;dropIcon.hidden=true;
      drop.classList.add('has-selection');
      label.textContent=files.length+' fotografía(s) listas para cargar';
      hint.textContent='Vista previa · Todavía no están guardadas en MariaDB';
    }
    selected.textContent=files.length?
      files.length+' seleccionada(s): '+files.map(f=>f.name).join(', '):
      'No hay archivos seleccionados';
    if(!files.length)input.value='';
    submit.disabled=!files.length||working;
    status.textContent='';
  }
  input.addEventListener('change',()=>setFiles(input.files));
  browse.addEventListener('click',e=>e.stopPropagation());
  drop.addEventListener('click',e=>{
    if(e.target!==browse&&e.target!==input)input.click();
  });
  drop.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}
  });
  for(const event of ['dragenter','dragover']){
    drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('is-over');});
  }
  for(const event of ['dragleave','drop']){
    drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('is-over');});
  }
  drop.addEventListener('drop',e=>setFiles(e.dataTransfer?.files));
  dialog.addEventListener('keydown',e=>{
    if(e.target.closest('input,button'))return;
    if(e.key==='ArrowLeft'){e.preventDefault();void select(index-1);}
    if(e.key==='ArrowRight'){e.preventDefault();void select(index+1);}
  });
  async function photoUrl(item){
    if(urls.has(item.id))return urls.get(item.id);
    if(pending.has(item.id))return pending.get(item.id);
    const task=(async()=>{
      const blob=await api().productPhotoBlob(product.id,item.id);
      if(!live)return null;
      const url=URL.createObjectURL(blob);urls.set(item.id,url);
      return url;
    })();
    pending.set(item.id,task);
    try{return await task;}finally{pending.delete(item.id);}
  }
  async function select(i){
    if(!live||!photos.length)return;
    const position=(i+photos.length)%photos.length;
    const localTicket=++ticket;index=position;
    const photo=photos[index];
    current.textContent=(index+1)+' de '+photos.length;
    prev.disabled=next.disabled=photos.length<2;
    main.hidden=true;empty.hidden=false;empty.textContent='Cargando imagen…';
    thumbs.querySelectorAll('button').forEach((n,k)=>
      n.classList.toggle('is-selected',k===index));
    try{
      const url=await photoUrl(photo);
      if(!live||ticket!==localTicket||!url)return;
      main.src=url;
      main.alt='Fotografía '+(index+1)+' de '+photos.length+' del producto '+product.nombre;
      main.hidden=false;empty.hidden=true;
    }catch(e){if(live&&ticket===localTicket){empty.textContent=error(e);status.textContent=error(e);}}
  }
  async function reload(preferred=null){
    status.textContent='Consultando fotografías…';
    try{
      const data=await api().productPhotos(product.id);
      if(!live)return;
      photos=Array.isArray(data?.items)?data.items:[];
      thumbs.replaceChildren();
      // Miniaturas reales; carga diferida y limitada para no inundar la API
      // cuando un producto tiene cientos de fotografías.
      photos.forEach((item,i)=>{
        const card=button('',()=>void select(i),'product-gallery-thumb');
        const icon=el('span','product-gallery-thumb-symbol','▧');
        const info=el('span','product-gallery-thumb-label',
          'Foto '+(i+1)+' · '+Math.round(item.tamano_bytes/1024)+' KB');
        card.append(icon,info);
        card.title=item.nombre_archivo;
        thumbs.append(card);
      });
      async function thumbImage(item,i){
        if(!live||i>=24)return;
        const card=thumbs.children[i];if(!card)return;
        try{
          const src=await photoUrl(item);
          if(!src||!live||card!==thumbs.children[i])return;
          const img=el('img','product-gallery-mini');
          img.src=src;img.alt='Miniatura '+(i+1);img.loading='lazy';
          card.querySelector('.product-gallery-thumb-symbol')?.replaceWith(img);
        }catch(_ignored){}
      }
      for(let i=0;i<Math.min(photos.length,24);i+=3){
        void Promise.all(photos.slice(i,i+3).map((photo,j)=>thumbImage(photo,i+j)));
      }
      if(!photos.length){
        index=-1;main.hidden=true;empty.hidden=false;
        empty.replaceChildren(el('span','product-gallery-empty-icon','▧'),
          el('strong','','Todavía no hay fotografías'),
          el('p','','Puedes agregar una o varias imágenes desde el panel derecho.'));
        current.textContent='0 de 0';prev.disabled=next.disabled=true;
      }else{
        const target=photos.findIndex(p=>p.id===preferred);
        await select(target>=0?target:Math.min(Math.max(index,0),photos.length-1));
      }
      status.textContent=photos.length+' fotografía(s) almacenada(s) en el producto.';
    }catch(e){if(live)status.textContent=error(e);}
  }
  async function upload(){
    if(working||!files.length)return;
    working=true;submit.disabled=true;status.textContent='Guardando '+files.length+' foto(s) en MariaDB…';
    try{
      const uploaded=await api().uploadProductPhotos(product.id,files);
      if(!live)return;
      setFiles([]);input.value='';
      status.textContent='Fotografías guardadas.';
      await reload(uploaded.ids?.[0]);
      window.dispatchEvent(new CustomEvent('rutahd:product-photos-changed',
        {detail:{productoId:product.id}}));
    }catch(e){status.textContent=error(e);}
    finally{working=false;submit.disabled=!files.length;}
  }
  // Galería profesional: eliminar la foto seleccionada solo con confirmación.
  const remove=button('Eliminar fotografía seleccionada',()=>{
    if(index<0||!photos[index])return;
    const item=photos[index];
    const confirmDialog=el('dialog','modal crud-dialog product-gallery-confirm');
    const content=el('div','product-gallery-confirm-body');
    content.append(el('h3','','¿Eliminar esta fotografía?'),
      el('p','','La imagen se borrará de la base de datos y no podrá recuperarse.'));
    const buttons=el('div','modal-footer');
    buttons.append(button('Cancelar',()=>confirmDialog.close()));
    const yes=button('Eliminar definitivamente',async()=>{
      yes.disabled=true;
      try{
        await api().deleteProductPhoto(product.id,item.id);
        const url=urls.get(item.id);
        if(url){URL.revokeObjectURL(url);urls.delete(item.id);}
        confirmDialog.close();await reload();
        window.dispatchEvent(new CustomEvent('rutahd:product-photos-changed',
          {detail:{productoId:product.id}}));
      }catch(e){status.textContent=error(e);yes.disabled=false;}
    },'button danger');
    buttons.append(yes);content.append(buttons);confirmDialog.append(content);
    document.body.append(confirmDialog);confirmDialog.showModal();
    confirmDialog.addEventListener('close',()=>confirmDialog.remove(),{once:true});
  },'button ghost product-gallery-delete');
  aside.append(remove);
  const footer=el('footer','product-gallery-footer');
  const closeFooter=button('Cerrar galería',()=>dialog.close(),'button ghost product-gallery-close');
  closeFooter.setAttribute('aria-label','Cerrar galería de fotografías');
  footer.append(closeFooter);
  panel.append(footer);
  prev.disabled=next.disabled=true;
  void reload();
 }
 window.RutaHDGaleriaProductos=Object.freeze({open});
})();
