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
  let root=null,selectedPage=1,query='',busy=false,cache={},result=null,notifier=null,filters={};
  const FILTER_MAP=Object.fromEntries(ATTRS.map(([field,catalog,label,depends])=>[
    field,{catalog,label,depends,column:field.replace(/Id$/,'').replace(/[A-Z]/g,x=>'_'+x.toLowerCase())+'_id'}
  ]));
  // El servidor utiliza estos nombres de columnas, no propiedades del frontend.
  const DB_FIELDS={
    rubroId:'rubro_id',departamentoId:'departamento_id',familiaId:'familia_id',
    lineaId:'linea_id',marcaId:'marca_id',modeloId:'modelo_id',
    tipoUnidadId:'tipo_unidad_id',tipoEnvasadoId:'tipo_envasado_id',
    condicionTributariaId:'condicion_tributaria_id'
  };
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
    filters={};selectedPage=1;query='';
    const tools=el('div','workspace-actions normalized-toolbar');tools.style.flexWrap='wrap';
    tools.dataset.productAdvanced='true';
    const search=el('input');search.type='search';search.placeholder='Buscar SKU o nombre';search.setAttribute('aria-label','Buscar productos reales');
    search.maxLength=120;
    const searchBtn=button('Buscar',()=>guarded(async()=>{selectedPage=1;query=search.value.trim();await loadProducts();}),'button ghost');
    const create=button('Nuevo producto real',()=>guarded(()=>editProduct(null)),'button primary');
    const refresh=button('Actualizar',()=>guarded(loadProducts));
    const advanced=button('Búsqueda avanzada',()=>guarded(openAdvancedSearch),'button ghost advanced-filter-trigger');
    advanced.innerHTML=window.RutaHDListUI?.icon('filtros')+'<span>Búsqueda avanzada</span>';
    add(tools,search,searchBtn,advanced,create,refresh);
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
  async function openAdvancedSearch(){
    // La búsqueda nunca depende de tener todas las clasificaciones disponibles.
    const names=[...new Set([...ATTRS.map(([,cat])=>cat),'tipos_codigos_barras'])];
    const responses=await Promise.allSettled(names.map(name=>api().list(name)));
    const failed=[];
    responses.forEach((item,index)=>{
      const key=names[index];
      if(item.status==='fulfilled'&&Array.isArray(item.value?.items))cache[key]=item.value.items;
      else{cache[key]=[];failed.push(key);}
    });
    const fields=[
      {key:'sku',label:'SKU / Código',value:filters.sku||''},
      {key:'nombre',label:'Nombre',value:filters.nombre||''},
      {key:'descripcion',label:'Descripción',value:filters.descripcion||''},
    ];
    for(const [key,cat,label,depends] of ATTRS){
      const entries=cache[cat]||[];
      fields.push({
        key:DB_FIELDS[key],label,value:filters[DB_FIELDS[key]]||'',
        options:entries.map(item=>[String(item.id),item.nombre,
          item.parentId==null?'':String(item.parentId)]),
        ...(depends?{dependsOn:DB_FIELDS[depends]}:{})
      });
    }
    fields.push(
      {key:'activo',label:'Estado del producto',
        options:[['1','Activo'],['0','Inactivo']],value:filters.activo||''},
      {key:'codigo_barras',label:'Código de barras',value:filters.codigo_barras||''},
      {key:'tipo_codigo_barra_id',label:'Tipo de código de barras',
        options:(cache.tipos_codigos_barras||[]).map(item=>[String(item.id),item.nombre]),
        value:filters.tipo_codigo_barra_id||''},
      {key:'presentacion',label:'Nombre de presentación',value:filters.presentacion||''},
      {key:'precio_min',label:'Precio neto desde (CLP)',type:'number',min:'0',value:filters.precio_min||''},
      {key:'precio_max',label:'Precio neto hasta (CLP)',type:'number',min:'0',value:filters.precio_max||''},
      {key:'iva',label:'Tasa IVA (%)',type:'number',min:'0',value:filters.iva||''},
      {key:'unidades_min',label:'Unidades por envase desde',type:'number',min:'0',value:filters.unidades_min||''},
      {key:'unidades_max',label:'Unidades por envase hasta',type:'number',min:'0',value:filters.unidades_max||''},
      {key:'proveedor_id',label:'ID del proveedor asociado',type:'number',min:'1',step:'1',value:filters.proveedor_id||''}
    );
    const modal=window.RutaHDListUI?.advanced(fields,values=>{
      filters=Object.fromEntries(Object.entries(values).filter(([,v])=>v!==''&&!(/^0+$/.test(v)&&v!==values.activo)));
      selectedPage=1;
      void guarded(loadProducts);
    },{
      title:'Búsqueda avanzada · Productos',
      hint:'Filtra el catálogo completo por jerarquía, marca, modelo, estado, presentación, precios y códigos de barras. Los criterios se combinan entre sí.',
      validate:values=>{
        for(const [min,max] of [['precio_min','precio_max'],['unidades_min','unidades_max']]){
          if(values[min]!==''&&values[max]!==''&&Number(values[min])>Number(values[max]))
            return {field:max,message:'El valor máximo debe ser igual o mayor que el mínimo.'};
        }
        return null;
      }
    });
    if(!modal)throw new Error('No está disponible el formulario de búsqueda avanzada');
    modal.classList.add('product-advanced-dialog');
    if(failed.length){
      const warning=el('p','hd-filter-warning',
        'Algunos catálogos no se pudieron consultar: '+failed.join(', ')+'. Puedes usar los filtros disponibles y reintentar después.');
      warning.setAttribute('role','status');
      modal.querySelector('.crud-fields')?.before(warning);
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
    const data=await api().products(selectedPage,query,filters);
    if(!Array.isArray(data?.data))throw new Error('Respuesta paginada inesperada');
    result.replaceChildren();
    const advancedKeys=Object.keys(filters).filter(key=>filters[key]!==''&&filters[key]!=null);
    const serverFiltering=data.filtros_aplicados===true;
    if(advancedKeys.length){
      const note=el('p',serverFiltering?'hd-filter-active':'hd-filter-warning',
        serverFiltering?
          advancedKeys.length+' filtros avanzados aplicados a la base de productos.':
          'El servidor todavía no admite los filtros avanzados. Se mostrarán coincidencias de esta página hasta actualizar la API.');
      note.setAttribute('role','status');result.appendChild(note);
    }
    let products=data.data;
    if(advancedKeys.length&&!serverFiltering){
      const match=(p,key,value)=>{
        if(key==='activo')return String(p.activo?'1':'0')===value;
        const mapped=Object.entries(DB_FIELDS).find(([,column])=>column===key);
        if(mapped)return String(p.clasificacion?.[mapped[0]]??'')===value;
        if(key==='sku'||key==='nombre'||key==='descripcion')return String(p[key]??'').toLowerCase().includes(value.toLowerCase());
        if(key==='proveedor_id')return String(p.proveedorId??'')===value;
        if(key==='presentacion')return String(p.presentacion?.nombre??'').toLowerCase().includes(value.toLowerCase());
        if(key==='precio_min')return Number(p.presentacion?.precioNeto)>=Number(value);
        if(key==='precio_max')return Number(p.presentacion?.precioNeto)<=Number(value);
        if(key==='iva')return Number(p.presentacion?.tasaIva)===Number(value);
        if(key==='unidades_min')return Number(p.presentacion?.unidadesPorEnvase)>=Number(value);
        if(key==='unidades_max')return Number(p.presentacion?.unidadesPorEnvase)<=Number(value);
        // Si el servidor no expone código de barras en el listado,
        // no inventar coincidencias de estos criterios.
        return false;
      };
      products=products.filter(p=>advancedKeys.every(key=>match(p,key,String(filters[key]))));
    }
    const table=el('table','catalog-table');
    const head=el('tr');
    ['SKU','Producto','Precio neto','IVA','Estado','Acciones'].forEach(t=>head.appendChild(el('th','',t)));
    table.appendChild(add(el('thead'),head));
    const body=el('tbody');
    products.forEach(prod=>{
      const row=el('tr');
      row.appendChild(el('td','',prod.sku||'—'));
      row.appendChild(el('td','',prod.nombre));
      row.appendChild(el('td','',prod.presentacion?money(prod.presentacion.precioNeto):'Sin presentación'));
      row.appendChild(el('td','',prod.presentacion?Number(prod.presentacion.tasaIva)+' %':'—'));
      row.appendChild(el('td','',prod.activo?'Activo':'Inactivo'));
      const actions=el('td','catalog-actions');
      actions.appendChild(button('Ver',()=>guarded(()=>detailProduct(prod.id)),'catalog-small-button'));
      actions.appendChild(button('Editar',()=>guarded(()=>editProduct(prod.id)),'catalog-small-button'));
      actions.appendChild(button('Códigos de barras',()=>guarded(()=>editProduct(prod.id,true)),'catalog-small-button'));
      if(prod.activo)actions.appendChild(button('Desactivar',()=>deactivate(prod),'catalog-small-button danger-text'));
      row.appendChild(actions);body.appendChild(row);
    });
    table.appendChild(body);
    if(!products.length)result.appendChild(el('p','catalog-footnote',
      advancedKeys.length?'No hay productos que coincidan con estos filtros. Puedes limpiar los filtros y reintentar.':
      'No hay productos registrados para esta búsqueda. Puedes crear el primero con «Nuevo producto».'));
    else result.appendChild(table);
    const footer=el('div','workspace-actions');
    const previous=button('Anterior',()=>guarded(async()=>{selectedPage--;await loadProducts();}));
    const next=button('Siguiente',()=>guarded(async()=>{selectedPage++;await loadProducts();}));
    previous.disabled=selectedPage<=1;
    next.disabled=selectedPage>=Number(data.last_page||1);
    add(footer,previous,el('span','catalog-footnote',
      'Página '+selectedPage+' / '+Number(data.last_page||1)+' · '+Number(data.total||0)+
      ' productos'+(advancedKeys.length&&!serverFiltering?' (total sin filtrar)':'')),next);
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
  async function editProduct(id,focusBarcodes=false){
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
    const barcodeHeading=el('h3','product-editor-section','Códigos de barras de venta');
    form.appendChild(barcodeHeading);
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
    const addCode=button('Agregar código de barras',()=>addBarcode(),
      'button ghost product-add-barcode');
    addCode.setAttribute('aria-label','Agregar código de barras al producto');
    form.append(addCode,barcodeRows);
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
    if(focusBarcodes){barcodeHeading.scrollIntoView({block:'start',behavior:'instant'});addCode.focus();}
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
