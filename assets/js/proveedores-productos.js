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

  async function editRelation(record,refresh){
    const {dialog,box}=openDialog(record?'Editar producto del proveedor':'Relacionar proveedor y producto');
    const message=e('p','Cargando proveedores y productos…','supplier-status');
    box.append(message);
    try{
      const [suppliers,products]=await Promise.all([
        api().resources('proveedores',1,'',100),
        api().products(1,'')
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
      const provider=selection(providerRows,'Seleccionar proveedor',record?.proveedor_id);
      provider.required=true;
      const productSearch=field('search','',120);
      productSearch.placeholder='Nombre o SKU del producto…';
      const product=selection(productRows,'Seleccionar producto',record?.producto_id);
      product.required=true;
      if(record){provider.disabled=true;product.disabled=true;providerSearch.disabled=true;productSearch.disabled=true;}
      const searchProvider=button('Buscar proveedor',async()=>{
        const res=await api().resources('proveedores',1,providerSearch.value.trim(),100);
        provider.replaceChildren(new Option('Seleccionar proveedor',''));
        (res.data||[]).forEach(row=>provider.append(new Option(row.nombre+' · '+(row.rut||'Sin RUT'),String(row.id))));
      });
      const searchProduct=button('Buscar producto',async()=>{
        const res=await api().products(1,productSearch.value.trim());
        product.replaceChildren(new Option('Seleccionar producto',''));
        (res.data||[]).forEach(row=>product.append(new Option((row.sku||'Sin SKU')+' · '+row.nombre,String(row.id))));
      });
      if(record){searchProvider.disabled=true;searchProduct.disabled=true;}
      form.append(labeled('Buscar proveedor',providerSearch),searchProvider,
        labeled('Proveedor *',provider),labeled('Buscar producto',productSearch),
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
      const save=e('button',record?'Guardar cambios':'Crear vínculo','button primary');save.type='submit';
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
        save.disabled=true;status.textContent='Guardando en Laravel…';
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

  function mount(parent){
    const current=++marker;
    const root=e('section',null,'surface-panel supplier-products-module');
    const head=e('div',null,'panel-heading');
    head.append(e('h2','Productos de proveedores'),
      e('p','SKU, proveedor, código propio del proveedor, costos y códigos de barras para compras.'));
    const status=e('p','Consultando relaciones…','catalog-footnote');
    const toolbar=e('form',null,'workspace-actions supplier-search-bar');
    const search=field('search','',120);
    search.placeholder='Buscar proveedor, SKU, producto o código del proveedor';
    const submit=e('button','Buscar','button primary');submit.type='submit';
    const create=button('Asociar producto a proveedor',()=>editRelation(null,load),'button primary');
    toolbar.append(search,submit,create);
    const content=e('div',null,'catalog-table-scroll');
    const pager=e('nav',null,'list-pagination');
    pager.setAttribute('aria-label','Páginas de productos por proveedor');
    root.append(head,status,toolbar,content,pager);parent.replaceChildren(root);
    if(!acl()?.authenticated()||!(acl().isAdmin()||acl().has('compras.gestionar'))){
      toolbar.remove();status.textContent='Tu perfil no tiene autorización de compras para administrar productos de proveedores.';
      return;
    }
    let page=1,query='',loading=false;
    async function load(){
      if(loading)return;loading=true;status.textContent='Cargando relaciones de Laravel…';
      try{
        const data=await api().productSuppliers(page,{buscar:query});
        if(current!==marker||!root.isConnected)return;
        const rows=data?.data||[];
        const table=e('table',null,'catalog-table supplier-products-table');
        const h=e('tr');
        ['Proveedor','Producto / SKU','Código proveedor','Costo neto','Última recepción','Estado','Acciones']
          .forEach(x=>h.append(e('th',x)));
        const thead=e('thead');thead.append(h);table.append(thead);
        const body=e('tbody');
        for(const record of rows){
          const tr=e('tr');
          tr.append(e('td',record.proveedor),e('td',record.producto+' · '+(record.codigo_producto||'—')),
            e('td',record.codigo_proveedor_producto||'—'),e('td',money(record.costo_proveedor)),
            e('td',record.fecha_ultima_recepcion||'Sin recepciones'));
          const stateCell=e('td',null,'catalog-status-cell');
          const toggle=window.RutaHDListUI?.statusSwitch(record.producto+' / '+record.proveedor,
            Boolean(record.activo),async active=>{
              await api().updateProductSupplier(record.id,{activo:active});
              await load();
            });
          stateCell.append(toggle||e('span',record.activo?'Activo':'Inactivo'));
          tr.append(stateCell);
          const cell=e('td',null,'supplier-row-actions');
          cell.append(button('Editar',()=>editRelation(record,load)));
          cell.append(button('Códigos de compra',()=>barcodes(record)));
          tr.append(cell);body.append(tr);
        }
        table.append(body);content.replaceChildren(table);
        if(!rows.length)content.append(e('p','No hay relaciones proveedor-producto en esta búsqueda.','catalog-footnote'));
        window.RutaHDListUI?.renderPager(pager,{
          page,pages:Number(data.last_page||1),total:Number(data.total||0),
          label:'relaciones',onPage:n=>{page=n;void load();}
        });
        pager.hidden=Number(data.last_page||1)<=1;
        status.textContent='';
      }catch(err){status.textContent=errorText(err);}
      finally{loading=false;}
    }
    toolbar.addEventListener('submit',event=>{event.preventDefault();query=search.value.trim();page=1;void load();});
    void load();
  }
  window.RutaHDProveedoresProductos=Object.freeze({mount});
})();