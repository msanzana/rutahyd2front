/* Ruta H&D V2 - Módulos oficiales con datos exclusivos del backend.
 * CRUD para clientes, proveedores y bodegas; resto en solo lectura.
 * Nunca se usan localStorage ni listas ficticias de producción.
 */
(() => {
  'use strict';
  const FIELDS={
    clientes:[
      ['codigo','Código interno','text',50,false],
      ['nombre','Nombre completo / razón social','text',190,true],
      ['rut','RUT','text',25,true],
      ['tipo_juridico_id','Tipo jurídico','select',0,true],
      ['actividad_economica_codigo','Código de giro SII','text',6,false],
      ['giro','Giro / actividad económica','text',255,false],
      ['direccion','Dirección','text',255,false],
      ['correo_electronico','Correo electrónico','email',190,false],
      ['telefono','Teléfono (+56 NNNNNNNNN)','tel',13,false],
      ['observaciones','Observaciones','textarea',10000,false]],
    proveedores:[
      ['nombre','Nombre comercial','text',190,true],
      ['razon_social','Razón social SII','text',190,false],
      ['nombre_fantasia','Nombre de fantasía','text',190,false],
      ['rut','RUT del proveedor','text',25,false],
      ['tipo_contribuyente','Tipo de contribuyente','select',40,false],
      ['actividad_economica_codigo','Código SII','text',6,false],
      ['giro','Giro / actividad económica SII','text',255,false],
      ['direccion','Dirección','text',255,false],
      ['direccion_numero','Número','text',30,false],
      ['correo_electronico','Correo electrónico','email',190,false],
      ['telefono','Teléfono','text',50,false],
      ['plazo_pago_dias','Plazo de pago (días)','number',5,false]
    ],
    bodegas:[
      ['codigo','Código','text',30,true],['nombre','Nombre','text',130,true],
      ['tipo','Tipo','text',40,false]]
  };
  const PROVIDER_COLUMNS=Object.freeze([
    ['nombre','Nombre / razón social'],['rut','RUT'],['giro','Giro'],
    ['direccion','Dirección'],['ciudad','Ciudad'],['comuna_nombre','Comuna'],
    ['telefono','Teléfono'],['correo_electronico','Correo'],['activo','Estado']
  ]);
  const PROVIDER_SECTIONS={
    nombre:'Identificación y datos SII',
    direccion:'Domicilio tributario',
    correo_electronico:'Contacto',
    plazo_pago_dias:'Condiciones comerciales'
  };
  const SELECT_OPTIONS={
    tipo_contribuyente:[
      ['','No especificado'],['PERSONA_NATURAL','Persona natural'],
      ['PERSONA_JURIDICA','Persona jurídica'],['EXTRANJERO','Proveedor extranjero']
    ]
  };
  const CONFIG=Object.freeze({
    compras:{resource:'ordenes_compra',title:'Órdenes de compra',fields:[['id','ID'],['numero','Número'],['estado','Estado'],['total_bruto','Total bruto']]},
    ventas:{resource:'ventas',title:'Ventas',fields:[['id','ID'],['numero','Número'],['estado','Estado'],['total_bruto','Total bruto']]},
    proveedores:{resource:'proveedores',title:'Proveedores',permission:'compras.gestionar',fields:PROVIDER_COLUMNS},
    clientes:{resource:'clientes',title:'Listado de clientes',permission:'clientes.gestionar',
      fields:[['rut','RUT'],['nombre','Nombre completo'],['direccion','Dirección'],
        ['ciudad','Ciudad'],['correo_electronico','Correo electrónico'],
        ['tipo_juridico_nombre','Tipo jurídico'],['lista_precio_nombre','Lista de precios activa']]},
    bodega:{resource:'bodegas',title:'Bodegas',permission:'inventario.gestionar',fields:[['id','ID'],['codigo','Código'],['nombre','Nombre'],['tipo','Tipo'],['activo','Estado']]},
    cuentas_corrientes:{resource:null,title:'Cuentas corrientes',fields:[]}
  });
  const create=(tag,text,cls)=>{
    const e=document.createElement(tag);
    if(text!==undefined)e.textContent=String(text);
    if(cls)e.className=cls;
    return e;
  };
  const action=(title,callback,style='primary')=>{
    const button=create('button',title,'button '+style);
    button.type='button';button.addEventListener('click',callback);return button;
  };
  let currentId=0;
  const api=()=>window.RutaHDApiCatalogos;
  const access=()=>window.RutaHDAccesos;
  const statusText=(e)=>{
    if(e?.userMessage)return e.userMessage;
    if(e?.status===409)return 'Ya existe el código o la entidad tiene una relación que impide modificarla.';
    if(e?.status===422)return 'Revisa los datos obligatorios y sus formatos.';
    if(e?.status===403)return 'Tu perfil no tiene permisos para realizar esta operación.';
    if(e?.status===401)return 'La sesión fue revocada. Debes iniciar sesión nuevamente.';
    return 'No se pudo completar la solicitud (HTTP '+(e?.status||'sin respuesta')+').';
  };

  async function openEditor(cfg,row,onSaved){
    const editing=Boolean(row),definition=FIELDS[cfg.resource];
    if(!definition)return;
    const dialog=create('dialog',undefined,'modal official-editor crud-official-dialog');
    dialog.setAttribute('aria-label',(editing?'Editar ':'Crear ')+cfg.title);
    const form=create('form',undefined,'official-editor-form');
    form.noValidate=true;
    const heading=create('div',undefined,'official-editor-heading');
    heading.append(create('span','RUTA H&D · GESTIÓN COMERCIAL','official-editor-eyebrow'),
      create('h2',(editing?'Editar ':'Nuevo registro · ')+cfg.title));
    heading.append(create('p',cfg.resource==='proveedores'?
      'Identificación tributaria, giro SII, dirección, contacto y condiciones comerciales.' :
      'Mantén la información de esta entidad actualizada y validada.',
      'official-editor-description'));
    const close=action('×',()=>dialog.close(),'crud-close');close.setAttribute('aria-label','Cerrar ventana');
    heading.append(close);form.append(heading);
    const grid=create('div',undefined,'official-editor-grid'),inputs={};
    const clientIdentity=cfg.resource==='clientes'
      ?create('div',undefined,'hd-customer-identity-row official-editor-wide'):null;
    if(clientIdentity)grid.append(clientIdentity);
    const legalTypes=cfg.resource==='clientes'
      ?(await api().customerLegalTypes()).items||[]:[];
    for(const [key,label,type,max,required] of definition){
      if(cfg.resource==='proveedores' && PROVIDER_SECTIONS[key]){
        grid.append(create('h3',PROVIDER_SECTIONS[key],
          'official-editor-section official-editor-wide'));
      }
      const field=create('label',undefined,'field');
      const caption=create('span',label+(required?' *':''));
      const input=create(type==='textarea'?'textarea':type==='select'?'select':'input');
      if(type!=='textarea'&&type!=='select')input.type=type;
      if(type==='select'){
        const values=key==='tipo_juridico_id'
          ?[['','Seleccionar tipo jurídico…'],...legalTypes
            .filter(t=>t.activo||Number(t.id)===Number(row?.tipo_juridico_id))
            .map(t=>[String(t.id),t.nombre])]
          :SELECT_OPTIONS[key]||[];
        for(const [value,name] of values){
          const option=create('option',name);option.value=value;input.append(option);
        }
      }
      input.name=key;
      if(type==='number'){input.min='0';input.step='1';}
      else if(type!=='select'&&type!=='date')input.maxLength=max;
      input.required=required;
      if(required)input.minLength=key==='nombre'?2:1;
      if(type==='email')input.autocomplete='email';
      if(cfg.resource==='clientes'&&key==='telefono'){
        input.inputMode='tel';input.autocomplete='tel';
        input.placeholder='+56 912345678';input.pattern='\\+56 [0-9]{9}';
        input.setAttribute('aria-description','Prefijo +56, un espacio y nueve dígitos');
        const checkPhone=()=>{
          const ok=!input.value.trim()||/^\+56 [0-9]{9}$/.test(input.value.trim());
          input.setCustomValidity(ok?'':'Usa el formato +56 NNNNNNNNN (9 dígitos).');
          return ok;
        };
        input.addEventListener('input',checkPhone);
        input.addEventListener('blur',checkPhone);
      }
      if(editing&&row[key]!==null&&row[key]!==undefined)input.value=String(row[key]);
      field.append(caption,input);
      if(type==='textarea')field.classList.add('official-editor-wide');
      if(clientIdentity&&['codigo','nombre','rut'].includes(key)){
        field.classList.add('hd-customer-identity-field');
        clientIdentity.append(field);
      }else grid.append(field);
      inputs[key]=input;
      if(key==='rut')window.RutaHDRut?.bind(input);
    }
    if(cfg.resource==='proveedores'||cfg.resource==='clientes'){
      // El código oficial de 6 dígitos determina la glosa del giro.
      const code=inputs.actividad_economica_codigo;
      const giro=inputs.giro;
      code.readOnly=true;code.placeholder='Seleccionar catálogo SII';
      giro.readOnly=true;giro.placeholder='Se completa al seleccionar el código';
      const original=code.closest('label');
      const wrap=create('div',undefined,'hd-giro-row');
      const select=action('Buscar giro SII',async()=>{
        try{
          const elegido=await window.RutaHDGirosSii?.open({
            title:cfg.resource==='clientes'?'Buscar giro del cliente':'Buscar giro del proveedor',
            buscar:code.value||giro.value||''
          });
          if(elegido){
            code.value=elegido.codigo;
            giro.value=elegido.descripcion;
            const meta=wrap.querySelector('.hd-giro-selected');
            if(meta)meta.textContent='Actividad seleccionada · Código '+elegido.codigo;
          }
        }catch(error){
          const meta=wrap.querySelector('.hd-giro-selected');
          if(meta)meta.textContent='No fue posible consultar el catálogo SII.';
        }
      },'ghost');
      original.replaceWith(wrap);
      wrap.append(original,select,
        create('p',code.value?'Código SII seleccionado: '+code.value:
          'Selecciona el giro desde el catálogo oficial.','hd-giro-selected'));
    }
    let location=null;
    if(['clientes','proveedores','bodegas'].includes(cfg.resource)){
      const group=create('div',undefined,'official-editor-wide supplier-location-section');
      group.append(create('h3','Ubicación geográfica','official-editor-section'),
        create('p','Selecciona país, región, provincia, comuna y ciudad. Solo se guarda la ciudad asignada.','official-editor-description'));
      location=await window.RutaHDUbicaciones?.mountSelector(group,row?.ciudad_id||null);
      grid.append(group);
    }
    form.append(grid);
    let clientPriceList=null;
    if(cfg.resource==='clientes'){
      const section=create('section',undefined,'hd-customer-prices');
      section.append(create('h3','Lista de precios del cliente','hd-customer-prices-title'),
        create('p','Cada cliente tiene una lista activa. La LISTA BASE viene seleccionada y puedes cambiarla antes de guardar.','hd-customer-prices-intro'));
      const field=create('label',undefined,'field official-customer-price-field');
      field.append(create('span','Lista de precios activa *'));
      const state=create('p','Consultando listas de precios…','hd-customer-price-status');
      state.setAttribute('role','status');
      section.append(field,state);form.append(section);
      try{
        const [first,current]=await Promise.all([
          api().priceLists('',true,1,100),
          editing?api().customerPriceList(row.id):Promise.resolve(null)
        ]);
        const lists=[...(first?.data||[])];
        const totalPages=Math.min(50,Math.max(1,Number(first?.last_page||1)));
        for(let nextPage=2;nextPage<=totalPages;nextPage++){
          const remaining=await api().priceLists('',true,nextPage,100);
          lists.push(...(remaining?.data||[]));
        }
        const unique=[...new Map(lists.filter(list=>list.activo)
          .map(list=>[Number(list.id),list])).values()];
        const base=unique.find(list=>Boolean(list.es_base));
        if(!base)throw new Error('No se encontró una LISTA BASE activa.');
        clientPriceList=create('select');
        clientPriceList.name='lista_precio_id';
        clientPriceList.required=true;
        clientPriceList.setAttribute('aria-label','Lista de precios activa del cliente');
        for(const list of unique){
          const option=new Option(list.nombre+(list.es_base?' · LISTA BASE':''),String(list.id));
          clientPriceList.append(option);
        }
        const assigned=editing?Number(current?.lista?.id||0):Number(base.id);
        if(!unique.some(list=>Number(list.id)===assigned)){
          // No asignar otra lista silenciosamente a un cliente existente.
          if(editing)throw new Error('No se encontró la lista vigente de este cliente.');
        }
        clientPriceList.value=String(assigned||base.id);
        const refreshPriceState=()=>{
          const choice=unique.find(list=>String(list.id)===clientPriceList.value);
          const isBase=Boolean(choice?.es_base);
          state.textContent=isBase
            ?'LISTA BASE asignada por defecto · Se guardará en clientes_listas_precios.'
            :'Lista especial seleccionada: '+(choice?.nombre||'')+
              ' · Reemplazará la lista activa del cliente en clientes_listas_precios.';
          state.classList.toggle('is-special',!isBase);
        };
        clientPriceList.addEventListener('change',refreshPriceState);
        field.append(clientPriceList);
        refreshPriceState();
      }catch(error){
        state.classList.add('is-error');
        state.textContent='No se pudieron consultar las listas de precios activas. '+
          (error?.userMessage||error?.message||'Revisa el servicio antes de guardar.');
      }
    }
    if(editing){
      const field=create('label',undefined,'official-active-field');
      const input=create('input');input.type='checkbox';input.checked=Boolean(row.activo);
      field.append(input,create('span','Registro activo (desmarcar para desactivar)'));
      form.append(field);
      inputs.activo=input;
    }
    const note=create('p','', 'official-editor-status');note.setAttribute('role','status');
    note.setAttribute('aria-live','polite');form.append(note);
    const footer=create('div',undefined,'official-editor-actions');
    const cancel=action('Cancelar',()=>dialog.close(),'ghost');
    const submit=create('button','Guardar','button primary');
    submit.type='submit';
    footer.append(cancel,submit);form.append(footer);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(window.RutaHDRut&&!window.RutaHDRut.validateIn(form))return;
      if(cfg.resource==='clientes'){
        const phone=inputs.telefono;
        if(phone?.value.trim()&&!/^\+56 [0-9]{9}$/.test(phone.value.trim())){
          window.RutaHDValidacion?.mostrar(phone,'Usa el formato +56 NNNNNNNNN (9 dígitos).');
          phone.focus();return;
        }
        if(!inputs.tipo_juridico_id?.value){
          window.RutaHDValidacion?.mostrar(inputs.tipo_juridico_id,'Selecciona Empresa o Persona natural.');
          inputs.tipo_juridico_id?.focus();return;
        }
      }
      if(cfg.resource==='clientes'&&(!clientPriceList||!clientPriceList.value)){
        note.textContent='Selecciona una lista de precios activa antes de guardar.';
        note.classList.add('is-error');return;
      }
      if(!form.reportValidity())return;
      const datos={};
      for(const [key,,, ,required] of definition){
        const v=inputs[key].value.trim();
        datos[key]=v===''&&!required?null:v;
      }
      if(location)datos.ciudad_id=location.value();
      if(inputs.activo)datos.activo=inputs.activo.checked;
      if(clientPriceList&&clientPriceList.value)datos.lista_precio_id=Number(clientPriceList.value);
      submit.disabled=true;cancel.disabled=true;
      note.textContent='Guardando cambios…';note.classList.remove('is-error');
      try {
        if(editing)await api().updateResource(cfg.resource,row.id,datos);
        else await api().createResource(cfg.resource,datos);
        dialog.close();
        await onSaved();
      }catch(error){
        note.textContent=statusText(error);note.classList.add('is-error');
      }finally{submit.disabled=false;cancel.disabled=false;}
    });
    dialog.append(form);document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.showModal();
    (inputs.nombre||inputs.codigo)?.focus();
  }

  function confirmDeactivate(cfg,row,onSaved){
    const dialog=create('dialog',undefined,'modal official-confirm crud-official-dialog');
    dialog.setAttribute('aria-label','Confirmar desactivación');
    const panel=create('div',undefined,'official-confirm-panel');
    panel.append(create('span','RUTA H&D · CONFIRMACIÓN','official-editor-eyebrow'),
      create('h2','Desactivar registro'),
      create('p','Se desactivará «'+String(row.nombre||row.codigo)+'». No se borrará su historial comercial.'));
    const note=create('p','', 'official-editor-status');note.setAttribute('role','status');
    panel.append(note);
    const buttons=create('div',undefined,'official-editor-actions');
    const cancel=action('Cancelar',()=>dialog.close(),'ghost');
    const deactivate=action('Sí, desactivar',async()=>{
      deactivate.disabled=true;cancel.disabled=true;
      note.textContent='Desactivando…';
      try{
        await api().deactivateResource(cfg.resource,row.id);
        dialog.close();
        await onSaved();
      }catch(error){
        note.textContent=statusText(error);note.classList.add('is-error');
      }finally{deactivate.disabled=false;cancel.disabled=false;}
    },'danger');
    buttons.append(cancel,deactivate);panel.append(buttons);dialog.append(panel);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }

  // V50 · Clientes: búsqueda y paginación reales en Laravel sobre toda la tabla.
  // No filtrar solo los 25 resultados cargados, ni inventar una lista de precios.
  function mountCustomers(parent,cfg){
    const root=create('section',undefined,'surface-panel official-module hd-customers');
    const header=create('div',undefined,'panel-heading');
    const title=create('div');
    title.append(create('h2','Listado de clientes'),
      create('p','Personas naturales y empresas · Ubicación, contacto y lista de precios activa.',
        'hd-customers-description'));
    header.append(title,create('span','Datos reales · Laravel','official-source'));
    const notice=create('p','', 'catalog-footnote');
    notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const actions=create('div',undefined,'workspace-actions hd-customers-actions');
    const searchBar=create('form',undefined,'official-search-bar hd-customers-search');
    // El filtro avanzado es remoto, no el filtro local genérico del listado.
    searchBar.dataset.productAdvanced='true';
    const quick=create('input');quick.type='search';quick.maxLength=120;
    quick.placeholder='Buscar por RUT, nombre, dirección, giro, ciudad, correo o lista…';
    quick.setAttribute('aria-label','Buscar clientes en todos los registros');
    const searchButton=create('button','Buscar','button primary');
    searchButton.type='submit';
    searchBar.append(quick,searchButton);
    const top=create('nav',undefined,'list-pagination hd-customers-pager');
    const bottom=create('nav',undefined,'list-pagination hd-customers-pager');
    top.setAttribute('aria-label','Paginación superior de clientes');
    bottom.setAttribute('aria-label','Paginación inferior de clientes');
    const tableRegion=create('div',undefined,'catalog-table-scroll hd-customers-scroll');
    root.append(header,notice,searchBar,actions,top,tableRegion,bottom);
    parent.replaceChildren(root);
    const editable=Boolean(access()?.isAdmin()||access()?.has('clientes.gestionar'));
    let page=1,term='',filters={},sort='id',direction='desc',request=0;
    const reset=()=>{page=1;void load();};
    searchBar.addEventListener('submit',event=>{
      event.preventDefault();term=quick.value.trim();reset();
    });
    const listButton=(name,onClick,kind='editar',danger=false)=>
      window.RutaHDListUI?.action(name,onClick,{kind,danger})||
      action(name,onClick,danger?'danger':'ghost');
    const searchAdvanced=async()=>{
      const trigger=advanced;trigger.disabled=true;
      try{
        const types=await api().customerLegalTypes();
        const prices=[];
        // Se recorren las páginas para que una lista de precios no desaparezca
        // del filtro por encontrarse fuera de los primeros 100 registros.
        for(let p=1;p<=50;p++){
          const result=await api().priceLists('',true,p,100);
          prices.push(...(result?.data||[]));
          if(p>=Number(result?.last_page||1))break;
        }
        if(!root.isConnected)return;
        const fields=[
          ['rut','RUT'],['nombre','Nombre completo'],
          ['direccion','Dirección'],['ciudad','Ciudad'],
          ['correo_electronico','Correo electrónico'],['giro','Giro']
        ].map(([key,label])=>({key,label,value:filters[key]||''}));
        fields.push({key:'tipo_juridico_id',label:'Tipo jurídico',
          value:filters.tipo_juridico_id||'',
          options:(types?.items||[]).map(x=>[String(x.id),x.nombre])});
        fields.push({key:'lista_precio_id',label:'Lista de precios activa',
          value:filters.lista_precio_id||'',
          options:prices.filter(x=>x.activo).map(x=>[String(x.id),x.nombre])});
        fields.push({key:'activo',label:'Estado',value:filters.activo||'',
          options:[['1','Activos'],['0','Inactivos']]});
        window.RutaHDListUI?.advanced(fields,next=>{
          filters=Object.fromEntries(Object.entries(next).filter(([,val])=>val!==''));
          reset();
        },{title:'Búsqueda avanzada · Clientes',
          hint:'Filtros combinados en el servidor, aplicados a todas las páginas.'});
      }catch(error){
        notice.textContent=error?.userMessage||'No fue posible cargar los filtros de clientes.';
        notice.classList.add('is-error');
      }finally{trigger.disabled=false;}
    };
    const advanced=action('Búsqueda avanzada',()=>void searchAdvanced(),'ghost');
    advanced.classList.add('advanced-filter-trigger');
    searchBar.append(advanced);
    const clear=action('Limpiar filtros',()=>{
      quick.value='';term='';filters={};sort='id';direction='desc';reset();
    },'ghost');
    clear.setAttribute('aria-label','Limpiar búsqueda y filtros de clientes');
    searchBar.append(clear);
    const refresh=action('Actualizar',()=>void load(),'ghost');
    actions.append(refresh);
    if(editable){
      const add=action('Nuevo cliente',()=>void openEditor(cfg,null,load));
      add.classList.add('hd-list-create-action');actions.append(add);
    }
    function drawPager(response){
      const pages=Math.max(1,Number(response.last_page||1));
      const onPage=n=>{
        if(n===page||n<1||n>pages)return;
        page=n;void load();
        root.scrollIntoView({block:'start',behavior:'smooth'});
      };
      for(const nav of [top,bottom]){
        window.RutaHDListUI?.renderPager(nav,{
          page,pages,total:Number(response.total||0),label:'clientes',onPage
        });
        nav.hidden=pages<=1;
      }
    }
    async function load(){
      const ticket=++request;
      notice.textContent='Consultando clientes…';
      notice.classList.remove('is-error');
      tableRegion.replaceChildren();
      try{
        const response=await api().customers({
          page,buscar:term,filters,orden:sort,direccion_orden:direction
        });
        if(ticket!==request||!root.isConnected)return;
        if(!response||!Array.isArray(response.data))throw Error('Listado remoto inválido');
        const rows=response.data;
        const table=create('table',undefined,'catalog-table official-table hd-customers-table');
        table.setAttribute('aria-label','Listado de clientes');
        const thead=create('thead'),tr=create('tr');
        for(const [key,label] of cfg.fields){
          const th=create('th');
          const heading=create('button',undefined,'hd-customers-sort');
          heading.type='button';
          heading.textContent=label+(sort===key?' '+(direction==='asc'?'↑':'↓'):'');
          heading.setAttribute('aria-label','Ordenar clientes por '+label);
          if(sort===key)th.setAttribute('aria-sort',direction==='asc'?'ascending':'descending');
          heading.addEventListener('click',()=>{
            direction=sort===key&&direction==='asc'?'desc':'asc';
            sort=key;page=1;void load();
          });
          th.append(heading);tr.append(th);
        }
        tr.append(create('th','Acciones'));
        thead.append(tr);table.append(thead);
        const tbody=create('tbody');
        for(const record of rows){
          const item=create('tr');
          if(!record.activo)item.classList.add('hd-customer-inactive');
          for(const [key] of cfg.fields){
            const td=create('td');
            const value=record[key];
            if(key==='lista_precio_nombre'){
              td.append(create('span',value||'Sin lista activa',
                value?'hd-customers-price-pill':'hd-customers-price-pill is-missing'));
            }else if(key==='tipo_juridico_nombre'){
              td.append(create('span',value||'Sin clasificar',
                value?'hd-customers-type-pill':'hd-customers-type-pill is-missing'));
            }else if(key==='nombre'){
              td.append(create('span',value||'—','hd-customers-name'));
              if(!record.activo)td.append(create('small','Inactivo','hd-customers-inactive-tag'));
            }else td.textContent=value===null||value===undefined||value===''?'—':String(value);
            item.append(td);
          }
          const cell=create('td',undefined,'official-row-actions hd-customers-row-actions');
          if(editable){
            cell.append(listButton('Editar '+record.nombre,()=>void openEditor(cfg,record,load),'editar'));
            if(record.activo){
              cell.append(listButton('Desactivar '+record.nombre,
                ()=>confirmDeactivate(cfg,record,load),'desactivar',true));
            }else{
              cell.append(listButton('Activar '+record.nombre,async()=>{
                const dialog=create('dialog',undefined,'modal official-confirm crud-official-dialog');
                const panel=create('div',undefined,'official-confirm-panel');
                panel.append(create('span','RUTA H&D · CONFIRMACIÓN','official-editor-eyebrow'),
                  create('h2','Activar cliente'),
                  create('p','¿Deseas activar «'+record.nombre+'»? Se conservarán sus datos.'));
                const controls=create('div',undefined,'official-editor-actions');
                const cancel=action('Cancelar',()=>dialog.close(),'ghost');
                const okButton=action('Sí, activar',async()=>{
                  okButton.disabled=true;cancel.disabled=true;
                  try{await api().updateResource('clientes',record.id,{activo:true});
                    dialog.close();void load();}
                  catch(err){notice.textContent=statusText(err);notice.classList.add('is-error');
                    okButton.disabled=false;cancel.disabled=false;}
                });
                controls.append(cancel,okButton);panel.append(controls);dialog.append(panel);
                document.body.append(dialog);
                dialog.addEventListener('close',()=>dialog.remove(),{once:true});
                dialog.showModal();
                return;
              },'seleccionar'));
            }
          }else cell.append(create('span','Solo lectura','hd-customers-readonly'));
          item.append(cell);tbody.append(item);
        }
        table.append(tbody);
        window.RutaHDListUI?.wrapTable(table);
        tableRegion.append(table);
        if(!rows.length){
          tableRegion.append(create('p','No se encontraron clientes con estos filtros.',
            'hd-customers-empty'));
        }
        drawPager(response);
        notice.textContent=Number(response.total||0)+' clientes encontrados.';
      }catch(error){
        if(ticket!==request||!root.isConnected)return;
        notice.textContent=statusText(error);
        notice.classList.add('is-error');
        for(const nav of [top,bottom])nav.hidden=true;
      }
    }
    void load();
  }

  function mount(parent,key){
    if(!parent)return;
    const cfg=CONFIG[key];parent.replaceChildren();
    if(!cfg){parent.append(create('p','Módulo inexistente.','catalog-footnote'));return;}
    if(cfg.resource==='clientes'){
      if(!access()?.authenticated()){
        parent.append(create('p','Se requiere una sesión autorizada.','catalog-footnote'));
        return;
      }
      mountCustomers(parent,cfg);
      return;
    }
    const root=create('section',undefined,'surface-panel official-module');
    const header=create('div',undefined,'panel-heading');
    header.append(create('h2',cfg.title),
      create('span','Directorio comercial protegido','official-source'));
    const notice=create('p','', 'catalog-footnote');
    notice.setAttribute('role','status');
    root.append(header,notice);parent.append(root);
    const current=++currentId;
    if(!access()?.authenticated()){
      notice.textContent='Se requiere una sesión autorizada para consultar registros.';
      root.append(action('Iniciar sesión',()=>window.RutaHDLogin?.show()));
      return;
    }
    if(!cfg.resource){
      notice.textContent='Este módulo aún no está disponible. No se mostrarán saldos estimados.';
      return;
    }
    const editable=Boolean(FIELDS[cfg.resource]&&(access()?.isAdmin()||access()?.has(cfg.permission)));
    const bar=create('div',undefined,'workspace-actions');
    const content=create('div',undefined,'catalog-table-scroll');
    const searchBar=create('form',undefined,'official-search-bar');
    const searchInput=create('input');searchInput.type='search';
    searchInput.maxLength=120;
    searchInput.placeholder='Buscar '+(cfg.resource==='clientes'?'cliente':'proveedor')+' por nombre, RUT o correo';
    searchInput.setAttribute('aria-label','Buscar en listado de '+cfg.title);
    const searchButton=create('button','Buscar','button primary');
    searchButton.type='submit';
    if(cfg.resource==='proveedores'||cfg.resource==='clientes'){
      searchBar.append(searchInput,searchButton);
      searchBar.addEventListener('submit',event=>{
        event.preventDefault();page=1;searchTerm=searchInput.value.trim();void load();
      });
      root.append(searchBar);
    }
    const pager=create('nav',undefined,'list-pagination');
    pager.setAttribute('aria-label','Páginas de '+cfg.title);
    root.append(bar,content,pager);
    let page=1,loading=false,searchTerm='';
    async function load(){
      if(loading)return;
      loading=true;bar.replaceChildren();content.replaceChildren();
      notice.textContent='Consultando registros reales…';
      try{
        const response=await api().resources(cfg.resource,page,searchTerm);
        if(current!==currentId||!root.isConnected)return;
        if(!response||!Array.isArray(response.data))throw Error('Lista remota inválida');
        const rows=response.data;
        if(editable){
          const create=action('Nuevo registro',()=>openEditor(cfg,null,load));
          create.classList.add('hd-list-create-action');bar.append(create);
        }
        if(rows.length){
          const columns=cfg.fields.filter(([f])=>rows.some(v=>Object.prototype.hasOwnProperty.call(v,f)));
          const table=create('table',undefined,'catalog-table official-table');
          const thead=create('thead'),head=create('tr');
          columns.forEach(([,label])=>head.append(create('th',label)));
          if(editable)head.append(create('th','Acciones'));
          thead.append(head);table.append(thead);
          const body=create('tbody');
          rows.forEach(row=>{
            const tr=create('tr');
            for(const [field] of columns){
              if(field==='activo'){
                const cell=create('td',undefined,'catalog-status-cell');
                const toggle=window.RutaHDListUI?.statusSwitch(row.nombre||row.codigo||'Registro',
                  Boolean(row.activo),async active=>{
                    await api().updateResource(cfg.resource,row.id,{activo:active});
                    await load();
                  },{disabled:!editable});
                cell.append(toggle||create('span',Boolean(row.activo)?'Activo':'Inactivo'));
                tr.append(cell);continue;
              }
              const value=row[field];
              tr.append(create('td',value===undefined||value===null?'—':String(value)));
            }
            if(editable){
              const cell=create('td',undefined,'official-row-actions');
              cell.append(window.RutaHDListUI?.action('Editar '+(row.nombre||row.codigo),
                ()=>openEditor(cfg,row,load),{kind:'editar'})||
                action('Editar',()=>openEditor(cfg,row,load),'ghost'));
              tr.append(cell);
            }
            body.append(tr);
          });
          table.append(body);content.append(table);
          notice.textContent='';
        }else{
          notice.textContent='No hay registros para mostrar en esta página.';
        }
        window.RutaHDListUI?.renderPager(pager,{
          page,pages:Number(response.last_page||1),total:Number(response.total||rows.length),
          label:'registros',onPage:n=>{page=n;void load();}
        });
        pager.hidden=Number(response.last_page||1)<=1;
        bar.append(action('Actualizar',()=>void load(),'ghost'));
      }catch(error){
        if(current!==currentId||!root.isConnected)return;
        notice.textContent=statusText(error);
        bar.append(action('Reintentar',()=>void load()));
      }finally{loading=false;}
    }
    void load();
  }
  window.RutaHDProveedorColumns=PROVIDER_COLUMNS;
  window.RutaHDOficial=Object.freeze({mount});
})();