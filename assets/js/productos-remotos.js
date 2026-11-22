/* Ruta H&D2 — CRUD de productos en MySQL real.
 * No comparte ni migra registros desde la demostración local.
 * Las existencias se consultan, pero NO se modifican desde Productos.
 */
(() => {
  'use strict';
  const ATTRS = [
    ['rubroId','rubros','Rubro',null],
    ['departamentoId','departamentos','Departamento','rubroId'],
    ['familiaId','familias','Familia','departamentoId'],
    ['lineaId','lineas','Línea','familiaId'],
    ['marcaId','marcas','Marca',null],
    ['modeloId','modelos','Modelo','marcaId'],
    ['tipoUnidadId','tipos_unidad','Tipo de unidad',null],
    ['tipoEnvasadoId','tipos_envasado','Tipo de envasado',null],
    ['condicionTributariaId','condiciones_tributarias','Condición tributaria',null],
  ];
  const api = () => window.RutaHDApiCatalogos;
  const access = () => window.RutaHDAccesos;
  const el=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=String(text);
    return e;
  };
  const add=(parent,...children)=>{children.forEach(c=>parent.appendChild(c));return parent;};
  const button=(label,onClick,cls='button ghost')=>{
    const b=el('button',cls,label);b.type='button';b.addEventListener('click',onClick);return b;
  };
  let root=null,selectedPage=1,query='',busy=false,cache={},result=null,notifier=null;
  const canManage=()=>Boolean(access()?.authenticated()&&access()?.has('productos.gestionar'));
  function message(text,error=false){
    if(!notifier)return;
    notifier.textContent=text;
    notifier.setAttribute('role',error?'alert':'status');
  }
  function errorMessage(e){
    if(e?.status===401){access()?.clear();api()?.signOut();return 'Sesión caducada. Inicia sesión nuevamente en Administración.';}
    if(e?.status===403)return 'Tu perfil no tiene permisos para esta operación.';
    if(e?.status===404)return 'Producto inexistente o recurso sin publicar.';
    if(e?.status===409)return 'Conflicto: SKU, código de barras o registro relacionado duplicado.';
    if(e?.status===422)return 'Datos incompletos: revisa las clasificaciones, la jerarquía y la presentación.';
    if(e?.name==='AbortError')return 'El servidor agotó el tiempo de respuesta.';
    return 'No se pudo completar la operación con Laravel.';
  }
  async function guarded(fn){
    if(busy){message('Terminando la consulta anterior. Intenta nuevamente.',true);return;}
    busy=true;
    try{await fn();}
    catch(e){message(errorMessage(e),true);}
    finally{busy=false;}
  }
  function mount(parent){
    root=el('section','surface-panel');
    root.id='productosReales';
    notifier=el('p','catalog-footnote','');
    notifier.id='productosRealesEstado';
    add(root,
      el('div','panel-heading',''),
      notifier
    );
    root.querySelector('.panel-heading').appendChild(
      add(el('div'),el('span','overline','BASE PRODUCTIVA'),el('h2','','Productos y presentaciones'))
    );
    root.appendChild(el('p','catalog-footnote',
      'CRUD real con JWT. La clasificación se valida en MySQL y el stock se gestiona exclusivamente en Inventario. Las bajas son lógicas.'));
    parent.replaceChildren(root);
    if(!canManage()){
      message('Inicia sesión en Administración con permiso productos.gestionar para consultar o modificar productos.',true);
      root.appendChild(button('Ir a Administración',()=>document.querySelector('[data-nav="administracion"].nav-link')?.click()));
      return;
    }
    const tools=el('div','workspace-actions');tools.style.flexWrap='wrap';
    const search=el('input');search.type='search';search.placeholder='Buscar SKU o nombre';search.setAttribute('aria-label','Buscar productos reales');
    search.maxLength=120;
    const searchBtn=button('Buscar',()=>guarded(async()=>{selectedPage=1;query=search.value.trim();await loadProducts();}));
    const create=button('Nuevo producto real',()=>guarded(()=>editProduct(null)),'button primary');
    const refresh=button('Actualizar',()=>guarded(loadProducts));
    add(tools,search,searchBtn,create,refresh);
    root.appendChild(tools);
    result=el('div','catalog-table-scroll');
    result.id='productosRealesListado';
    root.appendChild(result);
    // El listado no depende de que todos los catálogos estén disponibles.
    // Cada catálogo se consulta solamente cuando se abre el editor.
    guarded(loadProducts);
  }
  async function loadCatalogs(){
    const names=[...ATTRS.map(([,catalog])=>catalog),'tipos_codigos_barras'];
    const outcome=await Promise.allSettled(names.map(name=>api().list(name)));
    const failed=[];
    outcome.forEach((entry,index)=>{
      const name=names[index];
      if(entry.status==='fulfilled'&&Array.isArray(entry.value?.items)){
        cache[name]=entry.value.items;
      }else{
        cache[name]=[];
        failed.push(name);
      }
    });
    if(failed.length){
      const error=new Error('No se pudieron cargar los catálogos '+failed.join(', ')+'. Revisa permisos o conectividad y vuelve a intentarlo.');
      error.catalogs=failed;
      throw error;
    }
  }
  function catalogErrorDialog(error){
    const dialog=el('dialog','modal catalog-dialog crud-dialog');
    const form=el('div','crud-shell');
    const heading=el('div','crud-heading');
    const label=el('div','crud-heading-copy');
    label.append(el('span','crud-kicker','RUTA H&D · CATÁLOGOS'),
      el('h2','','No se puede completar la carga del producto'),
      el('p','crud-intro','El editor requiere las clasificaciones del servidor para guardar un artículo válido.'));
    const close=button('×',()=>dialog.close(),'crud-close');
    close.setAttribute('aria-label','Cerrar ventana');heading.append(label,close);
    const info=el('p','catalog-footnote',error?.message||'No se recibieron los catálogos necesarios.');
    info.setAttribute('role','alert');
    const actions=el('div','modal-footer crud-footer');
    actions.append(button('Cerrar',()=>dialog.close(),'button ghost'),
      button('Reintentar',()=>{dialog.close();void guarded(()=>editProduct(null));},'button primary'));
    form.append(heading,info,actions);dialog.append(form);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  function money(price){
    return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(Number(price)||0);
  }
  async function loadProducts(){
    if(!canManage())return;
    const data=await api().products(selectedPage,query);
    if(!Array.isArray(data?.data))throw new Error('Respuesta paginada inesperada');
    result.replaceChildren();
    const table=el('table','catalog-table');
    const head=el('tr');
    ['SKU','Producto','Precio neto','IVA','Estado','Acciones'].forEach(t=>head.appendChild(el('th','',t)));
    table.appendChild(add(el('thead'),head));
    const body=el('tbody');
    data.data.forEach(prod=>{
      const row=el('tr');
      row.appendChild(el('td','',prod.sku||'—'));
      row.appendChild(el('td','',prod.nombre));
      row.appendChild(el('td','',prod.presentacion?money(prod.presentacion.precioNeto):'Sin presentación'));
      row.appendChild(el('td','',prod.presentacion?Number(prod.presentacion.tasaIva)+' %':'—'));
      row.appendChild(el('td','',prod.activo?'Activo':'Inactivo'));
      const actions=el('td','catalog-actions');
      actions.appendChild(button('Ver',()=>guarded(()=>detailProduct(prod.id)),'catalog-small-button'));
      actions.appendChild(button('Editar',()=>guarded(()=>editProduct(prod.id)),'catalog-small-button'));
      if(prod.activo)actions.appendChild(button('Desactivar',()=>deactivate(prod),'catalog-small-button danger-text'));
      row.appendChild(actions);body.appendChild(row);
    });
    table.appendChild(body);
    if(!data.data.length)result.appendChild(el('p','catalog-footnote','No hay productos registrados para esta búsqueda. Puedes crear el primero con «Nuevo producto».'));
    else result.appendChild(table);
    const footer=el('div','workspace-actions');
    const previous=button('Anterior',()=>guarded(async()=>{selectedPage--;await loadProducts();}));
    const next=button('Siguiente',()=>guarded(async()=>{selectedPage++;await loadProducts();}));
    previous.disabled=selectedPage<=1;
    next.disabled=selectedPage>=Number(data.last_page||1);
    add(footer,previous,el('span','catalog-footnote',
      'Página '+selectedPage+' / '+Number(data.last_page||1)+' · '+Number(data.total||0)+' productos'),next);
    result.appendChild(footer);
    message('Productos consultados directamente en Laravel/MySQL. Sin sincronizar datos locales.');
  }
  async function detailProduct(id){
    const producto=await api().getProduct(id);
    const modal=el('dialog','modal catalog-dialog crud-dialog product-detail-dialog');
    const box=el('div','form-grid');
    const lines=[
      ['SKU',producto.sku||'—'],['Nombre',producto.nombre],
      ['Descripción',producto.descripcion||'—'],
      ['Precio neto',producto.presentacion?money(producto.presentacion.precioNeto):'Sin presentación'],
      ['IVA',producto.presentacion?producto.presentacion.tasaIva+' %':'—'],
      ['Stock en bodegas (solo lectura)',producto.stock],
    ];
    for(const [field,cat,label] of ATTRS) {
      const item=cache[cat]?.find(x=>Number(x.id)===Number(producto.clasificacion[field]));
      lines.push([label,item?.nombre||'Sin clasificar']);
    }
    lines.forEach(([label,val])=>box.appendChild(add(el('p','catalog-footnote'),
      el('strong','',label+': '),el('span','',val))));
    modal.appendChild(add(el('div'),el('h2','','Ficha de producto'),box,
      button('Cerrar',()=>modal.close())));
    document.body.appendChild(modal);
    modal.addEventListener('close',()=>modal.remove(),{once:true});
    modal.showModal();
  }
  function selectField(label,options,parent,init){
    const wrapper=el('label','field'),labelText=el('span','',label);
    const field=el('select');field.required=true;
    const empty=el('option','','Seleccionar...');empty.value='';field.appendChild(empty);
    options.forEach(item=>{
      const opt=el('option','',item.nombre);opt.value=String(item.id);field.appendChild(opt);
    });
    field.value=init==null?'':String(init);
    add(wrapper,labelText,field);parent.appendChild(wrapper);return field;
  }
  function inputField(label,type,parent,value,options={}){
    const wrapper=el('label','field');wrapper.appendChild(el('span','',label));
    const field=el(type==='textarea'?'textarea':'input');
    if(type!=='textarea')field.type=type;
    field.value=value??'';
    if(options.required)field.required=true;
    if(options.min!==undefined)field.min=String(options.min);
    if(options.max!==undefined)field.max=String(options.max);
    if(options.step!==undefined)field.step=String(options.step);
    if(options.maxLength)field.maxLength=options.maxLength;
    wrapper.appendChild(field);parent.appendChild(wrapper);return field;
  }
  async function editProduct(id){
    if(!canManage())throw Error('No autorizado');
    try{await loadCatalogs();}
    catch(error){catalogErrorDialog(error);return;}
    const producto=id?await api().getProduct(id):null;
    const modal=el('dialog','modal catalog-dialog product-editor-dialog crud-product-dialog');
    const form=el('form','form-grid product-editor-form');
    form.noValidate=false;
    modal.appendChild(form);
    const heading=el('div','product-editor-heading');
    heading.append(el('span','overline','RUTA H&D · CATÁLOGO DE PRODUCTOS'),
      el('h2','',producto?'Editar producto':'Nuevo producto'),
      el('p','','Clasifica el artículo por jerarquía, registra su presentación y añade los códigos de venta para cada unidad logística.'));
    const close=button('×',()=>modal.close(),'crud-close');close.setAttribute('aria-label','Cerrar ventana');
    heading.append(close);form.appendChild(heading);
    form.appendChild(el('h3','product-editor-section','Información del producto'));
    const sku=inputField('SKU / Código','text',form,producto?.sku,{required:true,maxLength:80});
    const nombre=inputField('Nombre del producto','text',form,producto?.nombre,{required:true,maxLength:190});
    const descripcion=inputField('Descripción','textarea',form,producto?.descripcion,{maxLength:10000});
    descripcion.parentElement.classList.add('product-editor-wide');
    const activo=el('input');activo.type='checkbox';activo.checked=producto?.activo!==false;
    const activeLabel=el('label','product-active-toggle');add(activeLabel,activo,el('span','','Producto activo'));form.appendChild(activeLabel);
    form.appendChild(el('h3','product-editor-section','Clasificación comercial'));
    const controls={};
    ATTRS.forEach(([field,,label])=>controls[field]=selectField(label,[],form,null));
    const initial=producto?.clasificacion||{};
    const redraw=()=>{
      ATTRS.forEach(([field,catalog,,depends])=>{
        const select=controls[field],selected=select.value;
        const parent=depends?controls[depends].value:null;
        const valid=(cache[catalog]||[]).filter(x=>x.activo && (!depends||String(x.parentId)===String(parent)));
        const current=(cache[catalog]||[]).find(x=>String(x.id)===selected);
        if(current&&!valid.some(x=>String(x.id)===selected))valid.push(current);
        select.replaceChildren();
        const empty=el('option','','Seleccionar...');empty.value='';select.appendChild(empty);
        valid.forEach(x=>{const option=el('option','',x.nombre);option.value=String(x.id);select.appendChild(option);});
        select.value=valid.some(x=>String(x.id)===selected)?selected:'';
        select.disabled=Boolean(depends&&!parent);
      });
    };
    // Restaurar la selección original respetando primero las dependencias.
    ATTRS.forEach(([field,catalog,,depends])=>{
      if(!controls[field])return;
      const parent=depends?Number(initial[depends]):null;
      const original=(cache[catalog]||[]).find(x=>Number(x.id)===Number(initial[field]));
      if(original&&(!depends||Number(original.parentId)===parent)) {
        const option=el('option','',original.nombre);
        option.value=String(original.id);controls[field].appendChild(option);
        controls[field].value=option.value;
      }
    });
    redraw();
    ATTRS.forEach(([field])=>controls[field].addEventListener('change',()=>{
      const clearChildren=k=>ATTRS.filter(x=>x[3]===k).forEach(([child])=>{
        controls[child].value='';clearChildren(child);
      });
      clearChildren(field);redraw();
    }));
    form.appendChild(el('h3','product-editor-section','Presentación, precio e IVA'));
    form.appendChild(el('p','catalog-footnote product-editor-wide',
      'Precio neto en CLP. La condición tributaria calcula el IVA; el stock se mantiene en Inventario.'));
    const presName=inputField('Nombre de presentación','text',form,producto?.presentacion?.nombre||'Unidad',
      {required:true,maxLength:150});

    const units=inputField('Unidades por envase','number',form,producto?.presentacion?.unidadesPorEnvase??'1',
      {required:true,min:0.001,step:0.001});
    const price=inputField('Precio neto (CLP)','number',form,producto?.presentacion?.precioNeto??'0',
      {required:true,min:0,step:0.0001});
    if(producto)form.appendChild(el('p','catalog-footnote',
      'Presentación principal ID '+(producto.presentacion?.id??'sin asignar')+
      ' · Existencias actuales: '+producto.stock+' (solo lectura).'));
    form.appendChild(el('h3','product-editor-section','Códigos de barras de venta'));
    form.appendChild(el('p','catalog-footnote product-editor-wide',
      'Cada código identifica una cantidad de unidades para venta. No se ingresa aquí código ni costo de proveedor.'));
    const barcodeRows=el('div','product-barcodes-list product-editor-wide');
    const selectedBarcodes=[];
    function addBarcode(data={}){
      const row=el('div','product-barcode-row');
      const type=selectField('Tipo de código de barras',cache.tipos_codigos_barras.filter(x=>x.activo),row,
        data.tipoCodigoBarraId??null);
      type.required=true;
      const code=inputField('Código de barras','text',row,data.codigoBarras||'',{required:true,maxLength:100});
      const quantity=inputField('Unidades por código','number',row,data.unidadesPorCodigo||'1',
        {required:true,min:0.001,step:0.001});
      const active=el('label','product-barcode-enabled');
      const checked=el('input');checked.type='checkbox';checked.checked=data.activo!==false;
      active.append(checked,el('span','','Activo'));row.append(active);
      const rm=button('Quitar código',()=>{row.remove();},'button ghost product-barcode-remove');
      row.append(rm);
      barcodeRows.append(row);
      selectedBarcodes.push({row,type,code,quantity,checked,id:data.id||null});
    }
    (producto?.codigosVenta||[]).forEach(addBarcode);
    form.append(barcodeRows,button('Añadir código de venta',()=>addBarcode(),
      'button ghost product-add-barcode'));
    form.appendChild(el('p','product-editor-hint product-editor-wide',
      'Puedes registrar EAN-13, DUN-14, Code 39, Code 128 y otros tipos. Cada código debe ser único y tener unidades mayores que cero.'));
    const feedback=el('p','form-error','');feedback.hidden=true;form.appendChild(feedback);
    const actions=el('div','modal-footer product-editor-actions');
    const cancel=button('Cancelar',()=>modal.close());
    const submit=el('button','button primary','Guardar en MySQL');submit.type='submit';
    add(actions,cancel,submit);form.appendChild(actions);
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      if(busy)return;
      if(!form.reportValidity())return;
      const classification=Object.fromEntries(ATTRS.map(([field])=>[field,Number(controls[field].value)]));
      if(Object.values(classification).some(x=>!Number.isSafeInteger(x)||x<1)){
        feedback.textContent='Completa todas las clasificaciones antes de guardar.';
        feedback.hidden=false;return;
      }
      const dto={
        sku:sku.value.trim(),nombre:nombre.value.trim(),descripcion:descripcion.value.trim(),
        activo:activo.checked,
        clasificacion:classification,
        presentacion:{
          ...(producto?.presentacion?.id?{id:Number(producto.presentacion.id)}:{}),
          nombre:presName.value.trim(),
          // Preservar el código legado de presentación, no modificar su historial.
          codigoBarras:producto?.presentacion?.codigoBarras||null,
          unidadesPorEnvase:units.value,precioNeto:price.value
        },
        codigosVenta:selectedBarcodes.filter(x=>x.row.isConnected).map(item=>({
          ...(item.id?{id:Number(item.id)}:{}),
          tipoCodigoBarraId:Number(item.type.value),
          codigoBarras:item.code.value.trim(),
          unidadesPorCodigo:item.quantity.value,
          activo:item.checked.checked
        })),
      };
      busy=true;submit.disabled=true;feedback.hidden=true;
      try{
        if(producto)await api().updateProduct(producto.id,dto);
        else await api().createProduct(dto);
        modal.close();await loadProducts();
        message(producto?'Producto actualizado en MariaDB.':'Producto creado en MariaDB.');
      }catch(e){
        feedback.textContent=errorMessage(e);feedback.hidden=false;
      }finally{busy=false;submit.disabled=false;}
    });
    document.body.appendChild(modal);
    modal.addEventListener('close',()=>modal.remove(),{once:true});
    modal.showModal();
  }
  function deactivate(product){
    const modal=el('dialog','modal catalog-dialog');
    const messageText=el('p','', 'Se desactivará '+product.nombre+
      '. Se conservarán su historia, presentaciones, ventas y stock. No se borrará de la base.');
    const ok=button('Confirmar desactivación',async()=>{
      ok.disabled=true;
      try {
        await api().deactivateProduct(product.id);
        modal.close();await loadProducts();
        message('Producto desactivado sin eliminar su historial.');
      }catch(e){message(errorMessage(e),true);ok.disabled=false;}
    },'button danger');
    add(modal,el('h2','','Desactivar producto'),messageText,
      add(el('div','modal-footer'),button('Cancelar',()=>modal.close()),ok));
    document.body.appendChild(modal);
    modal.addEventListener('close',()=>modal.remove(),{once:true});modal.showModal();
  }
  window.RutaHDProductosRemotos=Object.freeze({mount});
})();
