/* Ruta H&D V2 - Módulos oficiales con datos exclusivos del backend.
 * CRUD para clientes, proveedores y bodegas; resto en solo lectura.
 * Nunca se usan localStorage ni listas ficticias de producción.
 */
(() => {
  'use strict';
  const FIELDS={
    clientes:[
      ['codigo','Código','text',50,false],['nombre','Nombre o razón social','text',190,true],
      ['rut','RUT','text',25,false],['correo_electronico','Correo electrónico','email',190,false],
      ['telefono','Teléfono','text',50,false],['direccion','Dirección','text',255,false],
      ['sector','Sector','text',120,false],
      ['observaciones','Observaciones','textarea',10000,false]],
    proveedores:[
      ['nombre','Nombre / identificación comercial','text',190,true],
      ['razon_social','Razón social SII','text',190,false],
      ['nombre_fantasia','Nombre de fantasía','text',190,false],
      ['rut','RUT del proveedor','text',25,false],
      ['giro','Giro o actividad principal','text',255,false],
      ['actividad_economica_codigo','Código actividad económica SII','text',12,false],
      ['tipo_contribuyente','Tipo de contribuyente','select',40,false],
      ['inicio_actividades','Fecha de inicio de actividades','date',10,false],
      ['situacion_tributaria','Situación tributaria (dato declarado)','text',80,false],
      ['direccion','Calle / dirección principal','text',255,false],
      ['direccion_numero','Número','text',30,false],
      ['direccion_detalle','Oficina, local o referencia','text',120,false],
      ['codigo_postal','Código postal','text',16,false],
      ['correo_electronico','Correo de contacto','email',190,false],
      ['correo_dte','Correo para documentos tributarios DTE','email',190,false],
      ['telefono','Teléfono principal','text',50,false],
      ['telefono_secundario','Teléfono secundario','text',50,false],
      ['sitio_web','Sitio web','url',255,false],
      ['representante_legal','Representante legal','text',190,false],
      ['representante_rut','RUT del representante','text',25,false],
      ['contacto_nombre','Contacto comercial','text',190,false],
      ['contacto_cargo','Cargo del contacto','text',120,false],
      ['contacto_telefono','Teléfono del contacto','text',50,false],
      ['contacto_correo','Correo del contacto','email',190,false],
      ['moneda_preferida','Moneda preferida (ISO 4217)','text',3,false],
      ['plazo_pago_dias','Plazo de pago (días)','number',5,false],
      ['observaciones','Observaciones comerciales','textarea',10000,false]
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
    correo_electronico:'Comunicación y responsables',
    moneda_preferida:'Condiciones comerciales'
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
    clientes:{resource:'clientes',title:'Clientes',permission:'clientes.gestionar',fields:[['id','ID'],['codigo','Código'],['nombre','Nombre'],['rut','RUT'],['lista_precio_nombre','Lista de precios'],['activo','Estado']]},
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
      'Completa los datos tributarios, domicilio, representantes y condiciones comerciales.' :
      'Mantén la información de esta entidad actualizada y validada.',
      'official-editor-description'));
    const close=action('×',()=>dialog.close(),'crud-close');close.setAttribute('aria-label','Cerrar ventana');
    heading.append(close);form.append(heading);
    const grid=create('div',undefined,'official-editor-grid'),inputs={};
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
        for(const [value,name] of SELECT_OPTIONS[key]||[]){
          const option=create('option',name);option.value=value;input.append(option);
        }
      }
      input.name=key;
      if(type==='number'){input.min='0';input.step='1';}
      else if(type!=='select'&&type!=='date')input.maxLength=max;
      input.required=required;
      if(required)input.minLength=key==='nombre'?2:1;
      if(type==='email')input.autocomplete='email';
      if(editing&&row[key]!==null&&row[key]!==undefined)input.value=String(row[key]);
      field.append(caption,input);
      if(type==='textarea')field.classList.add('official-editor-wide');
      grid.append(field);inputs[key]=input;
    }
    let location=null;
    if(['clientes','proveedores','bodegas'].includes(cfg.resource)){
      const group=create('div',undefined,'official-editor-wide supplier-location-section');
      group.append(create('h3','Ubicación geográfica','official-editor-section'),
        create('p','Selecciona país, región, provincia, comuna y ciudad. Se guardará únicamente ciudad_id.','official-editor-description'));
      location=await window.RutaHDUbicaciones?.mountSelector(group,row?.ciudad_id||null);
      grid.append(group);
    }
    form.append(grid);
    let clientPriceList=null;
    if(cfg.resource==='clientes'){
      const label=create('label',undefined,'field official-customer-price-field');
      label.append(create('span','Lista de precios para ventas'));
      if(editing){
        try{
          const [available,current]=await Promise.all([
            api().priceLists(),api().customerPriceList(row.id)
          ]);
          clientPriceList=create('select');
          clientPriceList.setAttribute('aria-label','Lista de precios asignada al cliente');
          for(const list of available.data||[]){
            if(!list.activo&&Number(list.id)!==Number(current?.lista?.id))continue;
            const option=create('option',list.nombre+(list.es_base?' (general)':''));option.value=String(list.id);
            clientPriceList.append(option);
          }
          clientPriceList.value=String(current?.lista?.id||'');
          if(!clientPriceList.value&&clientPriceList.options.length)
            clientPriceList.selectedIndex=0;
          clientPriceList.required=true;label.append(clientPriceList);
        }catch(error){
          if(error?.status===404){
            // Compatibilidad con API antigua, sin inventar IDs de listas.
            label.append(create('p','El servidor aún no tiene habilitada la selección de listas. Los datos del cliente siguen editables.','catalog-footnote'));
          }else throw error;
        }
      }else{
        label.append(create('p','Al crear este cliente se le asignará automáticamente la LISTA BASE. Puedes asignarle una lista especial después.','catalog-footnote'));
      }
      form.append(label);
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
      note.textContent='Guardando en el servidor…';note.classList.remove('is-error');
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

  function mount(parent,key){
    if(!parent)return;
    const cfg=CONFIG[key];parent.replaceChildren();
    if(!cfg){parent.append(create('p','Módulo inexistente.','catalog-footnote'));return;}
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
      notice.textContent='El backend no tiene todavía un contrato comprobado de cuentas corrientes. No se mostrarán saldos estimados.';
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
              cell.append(action('Editar',()=>openEditor(cfg,row,load),'ghost'));
              tr.append(cell);
            }
            body.append(tr);
          });
          table.append(body);content.append(table);
          notice.textContent='';
        }else{
          notice.textContent='No existen registros para esta página de la base de datos.';
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