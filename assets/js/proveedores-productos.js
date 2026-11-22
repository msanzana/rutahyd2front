/* Ruta H&D V2 · Abastecimiento real: relación producto-proveedor y códigos de compra.
 * Una misma SKU puede tener distintos proveedores, códigos y costos.
 * Las referencias a recepción son de solo lectura hasta integrar Recepciones.
 */
(()=>{
  'use strict';
  const api=()=>window.RutaHDApiCatalogos;
  const acl=()=>window.RutaHDAccesos;
  const e=(tag,text='',cls='')=>{
    const node=document.createElement(tag);if(text!==null)node.textContent=String(text);
    if(cls)node.className=cls;return node;
  };
  const button=(name,handler,css='button ghost')=>{
    const b=e('button',name,css);b.type='button';b.addEventListener('click',handler);return b;
  };
  const money=n=>n===null||n===undefined?'Sin costo registrado':
    new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:4}).format(Number(n));
  let marker=0;
  function errorText(error){
    if(error?.status===401)return 'Sesión expirada. Inicia sesión nuevamente.';
    if(error?.status===403)return 'No tienes permiso para gestionar productos de proveedores.';
    if(error?.status===409)return error?.userMessage||'Registro duplicado, código en uso o relación comercial inválida.';
    if(error?.status===422)return error?.userMessage||'Revisa los campos requeridos, el código y las cantidades.';
    return 'No se pudo consultar el servidor (HTTP '+(error?.status||'sin respuesta')+').';
  }
  function labeled(label,control){
    const wrap=e('label',null,'supplier-field');
    wrap.append(e('span',label),control);return wrap;
  }
  function field(type='text',value='',max=100){
    const input=e('input');input.type=type;input.value=value??'';
    if(type!=='number')input.maxLength=max;return input;
  }
  function selection(items,placeholder,selected){
    const s=e('select');s.append(new Option(placeholder,''));
    items.forEach(row=>s.append(new Option(row.label,String(row.id))));
    if(selected!==undefined&&selected!==null)s.value=String(selected);
    return s;
  }
  function openDialog(title){
    const dialog=e('dialog',null,'modal supplier-product-dialog crud-supplier-dialog');
    const box=e('div',null,'supplier-dialog-body');
    const heading=e('div',null,'supplier-dialog-header');
    heading.append(e('span','RUTA H&D · ABASTECIMIENTO','overline'),e('h2',title),
      e('p','Administra la relación comercial y los códigos logísticos asociados.','crud-supplier-subtitle'));
    const close=button('×',()=>dialog.close(),'crud-close');close.setAttribute('aria-label','Cerrar ventana');
    heading.append(close);box.append(heading);dialog.append(box);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.showModal();
    return {dialog,box};
  }

  async function editRelation(record,refresh,fixedSupplier=null){
    const {dialog,box}=openDialog(record?'Editar producto del proveedor':'Relacionar proveedor y producto');
    const message=e('p','Cargando proveedores y productos…','supplier-status');
    box.append(message);
    try{
      const [suppliers,products]=await Promise.all([
        fixedSupplier?Promise.resolve({data:[fixedSupplier]}):api().resources('proveedores',1,'',100),
        api().buscarProductos({page:1})
      ]);
      const providerRows=(suppliers.data||[]).map(v=>({id:v.id,label:v.nombre+' · '+(v.rut||'Sin RUT')}));
      const productRows=(products.data||[]).map(v=>({id:v.id,label:(v.sku||'Sin SKU')+' · '+v.nombre}));
      if(record&&!providerRows.some(x=>x.id===record.proveedor_id))
        providerRows.unshift({id:record.proveedor_id,label:record.proveedor});
      if(record&&!productRows.some(x=>x.id===record.producto_id))
        productRows.unshift({id:record.producto_id,label:record.codigo_producto+' · '+record.producto});
      const form=e('form',null,'supplier-dialog-form crud-supplier-form');
      const providerSearch=field('search','',120);
      providerSearch.placeholder='Nombre o RUT del proveedor…';
      const provider=selection(providerRows,'Seleccionar proveedor',
        record?.proveedor_id??fixedSupplier?.id);
      provider.required=true;
      const productSearch=field('search','',120);
      productSearch.placeholder='Nombre o SKU del producto…';
      const product=selection(productRows,'Seleccionar producto',record?.producto_id);
      product.required=true;
      if(record||fixedSupplier){provider.disabled=true;providerSearch.disabled=true;}
      if(record){product.disabled=true;productSearch.disabled=true;}
      const searchProvider=button('Buscar proveedor',async()=>{
        const res=await api().resources('proveedores',1,providerSearch.value.trim(),100);
        provider.replaceChildren(new Option('Seleccionar proveedor',''));
        (res.data||[]).forEach(row=>provider.append(new Option(row.nombre+' · '+(row.rut||'Sin RUT'),String(row.id))));
      });
      const searchProduct=button('Buscar en catálogo de productos',async()=>{
        try{
          const picked=await window.RutaHDBuscadorProductos?.openSingle({
            title:'Seleccionar producto para '+(fixedSupplier?.nombre||'el proveedor'),
            initialSearch:productSearch.value.trim(),
            lockedFilters:fixedSupplier?{solo_sin_proveedor_id:fixedSupplier.id}:{}
          });
          if(picked){
            const id=String(picked.id);
            if(![...product.options].some(opt=>opt.value===id))
              product.append(new Option((picked.sku||'Sin SKU')+' · '+picked.nombre,id));
            product.value=id;
          }
        }catch(error){
          message.textContent=errorText(error);message.classList.add('is-error');
          box.append(message);
        }
      });
      if(record||fixedSupplier)searchProvider.disabled=true;
      if(record)searchProduct.disabled=true;
      if(fixedSupplier){
        const badge=e('div',fixedSupplier.nombre+' · '+(fixedSupplier.rut||'Sin RUT'),
          'supplier-linked-provider supplier-dialog-wide');
        form.append(badge);
      }else form.append(labeled('Buscar proveedor',providerSearch),searchProvider,
        labeled('Proveedor *',provider));
      form.append(labeled('Buscar producto',productSearch),
        searchProduct,labeled('Producto del catálogo *',product));
      const supplierCode=field('text',record?.codigo_proveedor_producto||'',80);
      const cost=field('number',record?.costo_proveedor??'',40);
      cost.min='0';cost.step='0.0001';cost.placeholder='Costo neto CLP';
      const active=field('checkbox');active.checked=record?.activo!==false;
      form.append(labeled('Código de producto según proveedor',supplierCode),
        labeled('Costo neto acordado (CLP)',cost),labeled('Relación activa',active));
      if(record){
        form.append(e('p','Última recepción: '+(record.ultima_recepcion_id??'Sin recepción')+
          ' · '+(record.fecha_ultima_recepcion||'Fecha pendiente'),
          'supplier-readonly supplier-dialog-wide'));
      }
      const status=e('p','', 'supplier-status supplier-dialog-wide');status.setAttribute('role','status');
      const actions=e('div',null,'supplier-dialog-actions supplier-dialog-wide');
      const cancel=button('Cancelar',()=>dialog.close());
      const save=e('button','Guardar','button primary');save.type='submit';
      actions.append(cancel,save);form.append(status,actions);message.remove();box.append(form);
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        if(!form.reportValidity())return;
        const data={
          codigo_proveedor_producto:supplierCode.value.trim()||null,
          costo_proveedor:cost.value===''?null:cost.value,
          activo:active.checked
        };
        if(!record){data.proveedor_id=Number(provider.value);data.producto_id=Number(product.value);}
        save.disabled=true;status.textContent='Guardando cambios…';
        try{
          if(record)await api().updateProductSupplier(record.id,data);
          else await api().createProductSupplier(data);
          dialog.close();await refresh();
        }catch(err){status.textContent=errorText(err);status.classList.add('is-error');}
        finally{save.disabled=false;}
      });
    }catch(err){message.textContent=errorText(err);message.classList.add('is-error');}
  }

  const purchaseBarcodeLengths=Object.freeze({EAN13:13,EAN8:8,DUN14:14,ITF14:14,UPCA:12,UPCE:8});
  function purchaseBarcodeValidation(type,rawCode,rawUnits){
    if(!type)return 'Selecciona un tipo de código de barras vigente.';
    const barcode=String(rawCode||'').trim();
    if(!barcode)return 'Ingresa el código de barras de compra.';
    if(barcode.length>100)return 'El código no puede superar 100 caracteres.';
    if(/[\x00-\x1f\x7f]/.test(barcode))return 'El código contiene caracteres de control.';
    const kind=String(type.codigo||'').toUpperCase();
    const size=purchaseBarcodeLengths[kind];
    if(size && !new RegExp('^[0-9]{'+size+'}$').test(barcode))
      return 'El tipo '+kind+' requiere exactamente '+size+' dígitos numéricos.';
    const quantity=String(rawUnits||'').trim();
    if(!/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/.test(quantity)
       || !/[1-9]/.test(quantity))
      return 'Las unidades deben ser mayores que cero, con hasta 3 decimales y 12 cifras enteras.';
    return '';
  }
  async function barcodes(record){
    const {dialog,box}=openDialog('Códigos de barras de compra · '+record.producto);
    const message=e('p','Consultando códigos y tipos…','supplier-status');box.append(message);
    const list=e('div',null,'supplier-barcodes');
    box.append(list);
    try{
      const [current,types]=await Promise.all([
        api().purchaseBarcodes(record.id),api().list('tipos_codigos_barras')
      ]);
      message.textContent='Cada código de compra indica el tipo de simbología y las unidades recibidas por lectura.';
      let entries=current.items||[];
      const avail=(types.items||[]).filter(x=>x.activo);
      const draw=()=>{
        list.replaceChildren();
        if(!entries.length)list.append(e('p','No se han registrado códigos de compra para este proveedor.','supplier-status'));
        for(const row of entries){
          const item=e('div',null,'supplier-barcode-item');
          item.append(e('strong',row.codigo_barras),
            e('span',row.tipo_nombre+' · '+row.unidades_por_codigo+' unidades'));
          item.append(button('Editar',()=>editCode(row)));
          const toggle=window.RutaHDListUI?.statusSwitch('Código '+row.codigo_barras,
            Boolean(row.activo),async active=>{
              await api().updatePurchaseBarcode(record.id,row.id,{activo:active});
              await reload();
            });
          if(toggle)item.append(toggle);
          list.append(item);
        }
      };
      const reload=async()=>{entries=(await api().purchaseBarcodes(record.id)).items||[];draw();};
      const editCode=(item=null)=>{
        const form=e('form',null,'supplier-barcode-form');
        const sel=selection(avail.map(t=>({id:t.id,label:t.nombre})),
          'Tipo de código *',item?.tipo_codigo_barra_id);
        sel.required=true;
        const code=field('text',item?.codigo_barras||'',100);code.required=true;
        const units=field('number',item?.unidades_por_codigo||'1',20);
        units.required=true;units.min='0.001';units.step='0.001';
        const status=e('p','', 'supplier-status supplier-dialog-wide');
        status.setAttribute('role','alert');
        const hint=e('p','', 'supplier-barcode-hint supplier-dialog-wide');
        const refreshHint=()=>{
          const type=avail.find(t=>String(t.id)===String(sel.value));
          const kind=String(type?.codigo||'').toUpperCase();
          const required=purchaseBarcodeLengths[kind];
          hint.textContent=required
            ?kind+': ingresa exactamente '+required+' dígitos, sin espacios ni guiones.'
            :'Ingresa el código asignado por el proveedor. Unidades: hasta 3 decimales.';
          code.inputMode=required?'numeric':'text';
          code.placeholder=required?'Ej.: '+('0'.repeat(required)):'Código del proveedor';
        };
        sel.addEventListener('change',refreshHint);
        refreshHint();
        const clearMessage=()=>{
          status.textContent='';status.classList.remove('is-error');
          for(const el of [sel,code,units])el.removeAttribute('aria-invalid');
        };
        for(const el of [sel,code,units])el.addEventListener(
          el===sel?'change':'input',clearMessage);
        const save=e('button',item?'Guardar código':'Añadir código','button primary');save.type='submit';
        form.append(labeled('Tipo',sel),labeled('Código de compra',code),
          labeled('Unidades por este código',units),hint,status,save);
        const report=(message,field)=>{
          status.textContent=message;status.classList.add('is-error');
          if(field){field.setAttribute('aria-invalid','true');field.focus();}
        };
        form.addEventListener('submit',async ev=>{
          ev.preventDefault();
          if(!form.reportValidity())return;
          clearMessage();
          const chosen=avail.find(t=>String(t.id)===String(sel.value));
          const invalid=purchaseBarcodeValidation(chosen,code.value,units.value);
          if(invalid){
            const size=purchaseBarcodeLengths[String(chosen?.codigo||'').toUpperCase()];
            const target=!chosen?sel:
              !code.value.trim() || (size&&!new RegExp('^[0-9]{'+size+'}$')
                .test(code.value.trim()))?code:units;
            report(invalid,target);return;
          }
          const payload={tipo_codigo_barra_id:Number(sel.value),
            codigo_barras:code.value.trim(),unidades_por_codigo:units.value.trim(),activo:true};
          save.disabled=true;status.textContent='Guardando código…';
          try{
            if(item)await api().updatePurchaseBarcode(record.id,item.id,payload);
            else await api().createPurchaseBarcode(record.id,payload);
            form.remove();await reload();
          }catch(err){
            const field=err?.validationErrors && Object.keys(err.validationErrors)[0];
            report(errorText(err),
              field==='tipo_codigo_barra_id'?sel:
              field==='codigo_barras'?code:
              field==='unidades_por_codigo'?units:null);
          }finally{save.disabled=false;}
        });
        list.prepend(form);
        code.focus();
      };
      draw();
      box.append(button('Añadir código de barras de compra',()=>editCode(),
        'button primary supplier-dialog-add'));
    }catch(err){message.textContent=errorText(err);message.classList.add('is-error');}
    box.append(button('Cerrar',()=>dialog.close(),'button ghost supplier-dialog-dismiss'));
  }

  /**
   * El mantenedor principal muestra PROVEEDORES (no vínculos individuales).
   * Cada fila abre su mix con las relaciones y los códigos de compra ya existentes.
   */
  function mixEditor(supplier,refreshDirectory){
    const {dialog,box}=openDialog('Mix de productos · '+supplier.nombre);
    dialog.classList.add('supplier-mix-dialog');
    const summary=e('div',null,'supplier-mix-summary');
    summary.append(e('strong',supplier.razon_social||supplier.nombre),
      e('span',(supplier.rut||'Sin RUT')+' · '+(supplier.giro||'Giro no informado')));
    const tools=e('div',null,'supplier-mix-tools');
    tools.setAttribute('role','group');
    tools.setAttribute('aria-label','Acciones del mix de productos');
    const status=e('p','Consultando productos del proveedor…','supplier-status supplier-mix-feedback');
    status.setAttribute('role','status');
    const staged=e('section',null,'supplier-mix-staged');
    staged.setAttribute('aria-label','Productos seleccionados pendientes de guardar');
    const stagedHeading=e('div',null,'supplier-mix-staged-heading');
    const stagedTitle=e('strong','Productos seleccionados para agregar');
    const stagedCount=e('span','0 pendientes','supplier-mix-badge');
    stagedHeading.append(stagedTitle,stagedCount);
    const stagedList=e('div',null,'catalog-table-scroll supplier-mix-staged-scroll');
    const batchActions=e('div',null,'supplier-mix-batch-actions');
    const saveBatch=button('Guardar productos seleccionados',()=>void saveSelected(),'button primary');
    saveBatch.disabled=true;
    batchActions.append(e('p','La selección no se incorpora al proveedor hasta pulsar Guardar.','supplier-status'),
      saveBatch);
    staged.append(stagedHeading,stagedList,batchActions);
    staged.hidden=true;
    const list=e('div',null,'catalog-table-scroll supplier-mix-list');
    const pager=e('nav',null,'list-pagination');
    pager.setAttribute('aria-label','Páginas del mix '+supplier.nombre);
    const pending=new Map();
    let page=1,loading=false,saving=false,currentRows=[];
    const metrics=e('div',null,'supplier-mix-metrics');
    const stat=(label,value)=>{
      const card=e('div',null,'supplier-mix-stat');
      card.append(e('span',label,'supplier-mix-stat-label'),value);
      metrics.append(card);
      return value;
    };
    const savedNumber=stat('Productos guardados',e('strong','—','supplier-mix-stat-number'));
    const pendingNumber=stat('Pendientes de guardar',e('strong','0','supplier-mix-stat-number'));
    const stateNumber=stat('Estado del mix',e('strong','Sin cambios','supplier-mix-stat-state'));

    const refresh=async()=>{await load();await refreshDirectory();};
    const openPicker=async()=>{
      if(saving)return;
      if(!window.RutaHDBuscadorProductos?.openMultiple){
        status.textContent='El buscador de productos no está disponible. Actualiza la página.';
        status.classList.add('is-error');return;
      }
      try{
        const picked=await window.RutaHDBuscadorProductos.openMultiple({
          title:'Buscar productos para '+supplier.nombre,
          context:'compras',
          lockedFilters:{solo_sin_proveedor_id:Number(supplier.id)},
          excludeIds:currentRows.map(row=>Number(row.producto_id)),
          initial:[...pending.values()].map(row=>row.producto),
        });
        if(picked===null)return;
        if(picked.length>50){
          status.textContent='Puedes agregar hasta 50 productos por guardado. Divide la selección en dos grupos.';
          status.classList.add('is-error');return;
        }
        const selectedIds=new Set(picked.map(row=>Number(row.id)));
        for(const id of pending.keys())if(!selectedIds.has(id))pending.delete(id);
        let added=0;
        for(const product of picked){
          const id=Number(product.id);
          if(!Number.isSafeInteger(id)||id<1||pending.has(id))continue;
          pending.set(id,{producto:product,codigo:'',costo:''});
          added++;
        }
        renderPending();
        status.classList.remove('is-error');
        status.textContent=pending.size
          ?pending.size+' producto(s) listos para guardar. Puedes completar código y costo por artículo.'
          :'No hay productos pendientes de guardar.';
      }catch(error){
        status.classList.add('is-error');status.textContent=errorText(error);
      }
    };
    const addMany=button('Buscar y agregar productos',()=>void openPicker(),'button primary');
    const addOne=button('Agregar individualmente',()=>editRelation(null,refresh,supplier));
    const update=button('Actualizar mix',()=>void load());
    tools.append(addMany,addOne,update);
    const content=e('div',null,'supplier-mix-content');
    const providerBlock=e('section',null,'supplier-mix-provider-block');
    providerBlock.setAttribute('aria-label','Datos del proveedor');
    providerBlock.append(e('span','PROVEEDOR SELECCIONADO','supplier-mix-provider-kicker'),summary);
    const savedBlock=e('section',null,'supplier-mix-saved-block');
    savedBlock.append(e('h3','Productos asociados','supplier-mix-section-heading'),list,pager);
    content.append(providerBlock,tools,metrics,status,staged,savedBlock);
    box.append(content);

    function renderPending(){
      staged.hidden=pending.size===0;
      pendingNumber.textContent=String(pending.size);
      stateNumber.textContent=pending.size?'Cambios sin guardar':'Sin cambios';
      stateNumber.classList.toggle('has-pending',pending.size>0);
      stagedCount.textContent=pending.size+' pendientes';
      saveBatch.textContent='Guardar '+pending.size+' producto'+(pending.size===1?'':'s');
      saveBatch.disabled=saving||pending.size===0;
      addMany.disabled=saving;addOne.disabled=saving;
      stagedList.replaceChildren();
      if(!pending.size)return;
      const table=e('table',null,'catalog-table supplier-mix-table supplier-mix-draft-table');
      const head=e('tr');
      ['SKU / producto','Código del proveedor','Costo neto CLP','Estado','Acciones']
        .forEach(label=>head.append(e('th',label)));
      const thead=e('thead');thead.append(head);table.append(thead);
      const body=e('tbody');
      for(const [id,item] of pending){
        const tr=e('tr',null,'supplier-mix-draft-row');
        const title=e('td');
        title.append(e('strong',(item.producto.sku||'Sin SKU')+' · '+item.producto.nombre),
          e('small','Pendiente de guardar','supplier-mix-pending-label'));
        const codeCell=e('td');
        const code=field('text',item.codigo,80);
        code.placeholder='Opcional';
        code.setAttribute('aria-label','Código del proveedor para '+item.producto.nombre);
        code.addEventListener('input',()=>{item.codigo=code.value;});
        codeCell.append(code);
        const costCell=e('td');
        const cost=field('number',item.costo,40);
        cost.min='0';cost.step='0.0001';cost.max='99999999999';
        cost.placeholder='Opcional';
        cost.setAttribute('aria-label','Costo neto para '+item.producto.nombre);
        cost.addEventListener('input',()=>{item.costo=cost.value;});
        costCell.append(cost);
        const state=e('td','Por guardar','supplier-mix-pending-state');
        const actions=e('td',null,'supplier-row-actions');
        const remove=window.RutaHDListUI?.action('Quitar '+item.producto.nombre,
          ()=>{pending.delete(id);renderPending();},{kind:'quitar'})||
          button('Quitar',()=>{pending.delete(id);renderPending();});
        actions.append(remove);
        tr.append(title,codeCell,costCell,state,actions);body.append(tr);
      }
      table.append(body);stagedList.append(table);
    }

    async function saveSelected(){
      if(saving||!pending.size)return;
      if(pending.size>50){
        status.textContent='El máximo por guardado es 50 productos.';
        status.classList.add('is-error');return;
      }
      const inputs=stagedList.querySelectorAll('input');
      for(const input of inputs){
        if(!input.checkValidity()){input.reportValidity();input.focus();return;}
      }
      const codes=new Set();
      const products=[];
      for(const [id,item] of pending){
        const code=item.codigo.trim();
        if(code){
          const normalized=code.toLocaleLowerCase('es-CL');
          if(codes.has(normalized)){
            status.textContent='Hay códigos de proveedor repetidos. Cada producto debe tener un código distinto.';
            status.classList.add('is-error');return;
          }
          codes.add(normalized);
        }
        products.push({
          producto_id:id,
          codigo_proveedor_producto:code||null,
          costo_proveedor:item.costo===''?null:item.costo
        });
      }
      saving=true;renderPending();
      status.classList.remove('is-error');
      status.textContent='Guardando '+products.length+' productos del proveedor…';
      try{
        const saved=await api().createProductSuppliersBatch({
          proveedor_id:Number(supplier.id),productos:products
        });
        pending.clear();
        page=1;renderPending();
        await refresh();
        status.textContent=(saved.cantidad||products.length)+' producto(s) agregados al mix correctamente.';
        status.classList.remove('is-error');
      }catch(error){
        // La transacción del backend se revierte completa ante cualquier error.
        // La selección permanece editable para corregir códigos y reintentar.
        status.textContent=errorText(error)+' Ninguna selección pendiente fue descartada.';
        status.classList.add('is-error');
      }finally{
        saving=false;renderPending();
      }
    }

    async function load(){
      if(loading)return;
      loading=true;
      status.classList.remove('is-error');
      status.textContent='Consultando productos registrados del proveedor…';
      try{
        const result=await api().productSuppliers(page,{proveedor_id:supplier.id});
        if(!dialog.open)return;
        const rows=result.data||[];currentRows=rows;
        list.replaceChildren();
        if(!rows.length){
          const empty=e('div',null,'supplier-mix-empty');
          const emblem=e('span','▦','supplier-mix-empty-icon');
          emblem.setAttribute('aria-hidden','true');
          const text=e('div',null,'supplier-mix-empty-copy');
          text.append(e('h4','Aún no hay productos asociados'),
            e('p','Busca productos del catálogo, selecciónalos y guárdalos en el mix de este proveedor.'));
          empty.append(emblem,text);list.append(empty);
        }else{
          const table=e('table',null,'catalog-table supplier-mix-table');
          const head=e('tr');
          ['SKU / producto','Código del proveedor','Costo neto','Códigos de compra','Estado','Acciones']
            .forEach(label=>head.append(e('th',label)));
          const thead=e('thead');thead.append(head);table.append(thead);
          const body=e('tbody');
          for(const item of rows){
            const tr=e('tr');
            tr.append(e('td',(item.codigo_producto||'—')+' · '+item.producto),
              e('td',item.codigo_proveedor_producto||'—'),e('td',money(item.costo_proveedor)));
            tr.append(e('td','Consulta desde Acciones','supplier-codes-summary'));
            const stateCell=e('td',null,'catalog-status-cell');
            const switchControl=window.RutaHDListUI?.statusSwitch(
              item.producto+' · '+supplier.nombre,Boolean(item.activo),async active=>{
                await api().updateProductSupplier(item.id,{activo:active});
                await refresh();
              });
            stateCell.append(switchControl||e('span',item.activo?'Activo':'Inactivo'));
            tr.append(stateCell);
            const actions=e('td',null,'supplier-row-actions');
            actions.append(
              window.RutaHDListUI?.action('Editar producto '+item.producto,
                ()=>editRelation(item,refresh,supplier),{kind:'editar'})||
                button('Editar',()=>editRelation(item,refresh,supplier)),
              window.RutaHDListUI?.action('Códigos de compra de '+item.producto,
                ()=>barcodes(item),{kind:'barras'})||
                button('Códigos de compra',()=>barcodes(item))
            );
            tr.append(actions);body.append(tr);
          }
          table.append(body);list.append(table);
        }
        savedNumber.textContent=String(Number(result.total||0));
        status.textContent=pending.size
          ?'Tienes '+pending.size+' producto(s) pendientes. Guárdalos antes de cerrar el panel.'
          :'El mix está actualizado. Puedes buscar y asociar más productos.';
        window.RutaHDListUI?.renderPager(pager,{
          page,pages:Number(result.last_page||1),total:Number(result.total||0),
          label:'productos',onPage:n=>{page=n;void load();}
        });
        pager.hidden=Number(result.last_page||1)<=1;
      }catch(error){status.textContent=errorText(error);status.classList.add('is-error');}
      finally{loading=false;}
    }
    const close=button('Cerrar panel',()=>dialog.close(),'button ghost supplier-dialog-dismiss');
    const reminder=e('p','Los cambios pendientes no se guardan al cerrar el panel.',
      'supplier-mix-draft-reminder');
    const footer=e('div',null,'supplier-mix-footer');
    footer.append(reminder,close);
    box.append(footer);
    renderPending();
    void load();
  }

  function mount(parent){
    const current=++marker;
    const root=e('section',null,'surface-panel supplier-products-module');
    const head=e('div',null,'panel-heading');
    head.append(e('h2','Proveedores · Mix de productos'),
      e('p','Directorio de proveedores y cantidad real de artículos asociados. Edítalos desde su ficha de mix.'));
    const status=e('p','Consultando proveedores…','catalog-footnote');
    const toolbar=e('form',null,'workspace-actions supplier-search-bar');
    const search=field('search','',120);
    search.placeholder='Buscar proveedor por razón social, RUT o correo';
    search.setAttribute('aria-label','Buscar proveedor en directorio de mix');
    const submit=e('button','Buscar','button primary');submit.type='submit';
    toolbar.append(search,submit);
    const content=e('div',null,'catalog-table-scroll');
    const pager=e('nav',null,'list-pagination');
    pager.setAttribute('aria-label','Páginas del mix de proveedores');
    root.append(head,status,toolbar,content,pager);parent.replaceChildren(root);
    if(!acl()?.authenticated()||!(acl().isAdmin()||acl().has('compras.gestionar'))){
      toolbar.remove();
      status.textContent='Tu perfil no tiene autorización para consultar el mix de proveedores.';
      return;
    }
    let page=1,query='',loading=false;
    async function load(){
      if(loading)return;
      loading=true;status.textContent='Cargando directorio de proveedores…';
      try{
        const data=await api().supplierMix(page,query);
        if(current!==marker||!root.isConnected)return;
        const rows=data?.data||[];
        const columns=window.RutaHDProveedorColumns||[
          ['nombre','Nombre / razón social'],['rut','RUT'],['giro','Giro'],
          ['direccion','Dirección'],['ciudad','Ciudad'],['comuna_nombre','Comuna'],
          ['telefono','Teléfono'],['correo_electronico','Correo'],['activo','Estado']
        ];
        const table=e('table',null,'catalog-table supplier-products-table');
        const head=e('tr');
        columns.forEach(([,label])=>head.append(e('th',label)));
        head.append(e('th','Productos en mix'),e('th','Acciones'));
        const thead=e('thead');thead.append(head);table.append(thead);
        const body=e('tbody');
        for(const row of rows){
          const tr=e('tr');
          for(const [key] of columns){
            const cell=e('td');
            if(key==='activo'){
              const toggle=window.RutaHDListUI?.statusSwitch(row.nombre,Boolean(row.activo),
                async active=>{
                  await api().updateResource('proveedores',row.id,{activo:active});
                  await load();
                });
              cell.className='catalog-status-cell';
              cell.append(toggle||e('span',row.activo?'Activo':'Inactivo'));
            }else cell.textContent=String(row[key]??'—');
            tr.append(cell);
          }
          const count=e('td',null,'supplier-mix-count');
          count.append(e('span',Number(row.cantidad_productos_mix||0),'supplier-mix-badge'));
          const actions=e('td',null,'supplier-row-actions');
          const edit=window.RutaHDListUI?.action('Editar mix de '+row.nombre,
            ()=>mixEditor(row,load),{kind:'editar'})||
            button('Editar',()=>mixEditor(row,load),'button ghost');
          edit.setAttribute('aria-label','Editar mix de '+row.nombre);
          actions.append(edit);tr.append(count,actions);body.append(tr);
        }
        table.append(body);content.replaceChildren(table);
        if(!rows.length)content.append(e('p','No hay proveedores registrados para esta búsqueda.','catalog-footnote'));
        window.RutaHDListUI?.renderPager(pager,{
          page,pages:Number(data.last_page||1),total:Number(data.total||0),
          label:'proveedores',onPage:n=>{page=n;void load();}
        });
        pager.hidden=Number(data.last_page||1)<=1;
        status.textContent='';
      }catch(error){status.textContent=errorText(error);}
      finally{loading=false;}
    }
    toolbar.addEventListener('submit',event=>{
      event.preventDefault();query=search.value.trim();page=1;void load();
    });
    void load();
  }
  window.RutaHDProveedoresProductos=Object.freeze({mount});
})();