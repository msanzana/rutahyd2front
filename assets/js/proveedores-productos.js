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
    if(error?.status===409)return 'Registro duplicado, código en uso o relación comercial inválida.';
    if(error?.status===422)return 'Revisa los campos requeridos, el código y las cantidades.';
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
        const save=e('button',item?'Guardar código':'Añadir código','button primary');save.type='submit';
        form.append(labeled('Tipo',sel),labeled('Código de compra',code),
          labeled('Unidades por este código',units),status,save);
        form.addEventListener('submit',async ev=>{
          ev.preventDefault();if(!form.reportValidity())return;
          const payload={tipo_codigo_barra_id:Number(sel.value),
            codigo_barras:code.value.trim(),unidades_por_codigo:units.value,activo:true};
          save.disabled=true;
          try{
            if(item)await api().updatePurchaseBarcode(record.id,item.id,payload);
            else await api().createPurchaseBarcode(record.id,payload);
            form.remove();await reload();
          }catch(err){status.textContent=errorText(err);status.classList.add('is-error');}
          finally{save.disabled=false;}
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
    const status=e('p','Consultando productos del proveedor…','supplier-status');
    const list=e('div',null,'catalog-table-scroll supplier-mix-list');
    const pager=e('nav',null,'list-pagination');
    pager.setAttribute('aria-label','Páginas del mix '+supplier.nombre);
    let page=1,loading=false;
    const refresh=async()=>{await load();await refreshDirectory();};
    tools.append(button('Añadir producto al mix',()=>editRelation(null,refresh,supplier),
      'button primary'),button('Actualizar mix',()=>void load()));
    box.append(summary,tools,status,list,pager);
    async function load(){
      if(loading)return;
      loading=true;
      status.textContent='Consultando relaciones reales del proveedor…';
      try{
        const result=await api().productSuppliers(page,{proveedor_id:supplier.id});
        if(!dialog.open)return;
        const rows=result.data||[];
        list.replaceChildren();
        if(!rows.length){
          list.append(e('p','Aún no existen productos asociados. Añade un producto del catálogo para registrar su código de compra.','supplier-status'));
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
            const codeCell=e('td','Consulta desde Acciones','supplier-codes-summary');
            tr.append(codeCell);
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
        status.textContent=(result.total||0)+' vínculos registrados para este proveedor.';
        window.RutaHDListUI?.renderPager(pager,{
          page,pages:Number(result.last_page||1),total:Number(result.total||0),
          label:'productos',onPage:n=>{page=n;void load();}
        });
        pager.hidden=Number(result.last_page||1)<=1;
      }catch(e){status.textContent=errorText(e);status.classList.add('is-error');}
      finally{loading=false;}
    }
    box.append(button('Cerrar panel',()=>dialog.close(),'button ghost supplier-dialog-dismiss'));
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