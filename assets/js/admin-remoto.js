/* Ruta H&D2: administración MySQL voluntaria, independiente de la demo local.
 * Jamás persistir sesión ni sincronizar automáticamente registros de prueba.
 */
(() => {
  'use strict';
  const API=()=>window.RutaHDApiCatalogos;
  const CONFIG={
    rubros:['Rubros',null],
    departamentos:['Departamentos','rubros'],
    familias:['Familias','departamentos'],
    lineas:['Líneas','familias'],
    marcas:['Marcas',null],
    modelos:['Modelos','marcas'],
    tipos_unidad:['Tipos de unidad',null],
    gramajes:['Gramajes',null],
    tipos_envasado:['Tipos de envasado',null],
    condiciones_tributarias:['Condiciones tributarias',null]
  };
  const KEYS=Object.keys(CONFIG);
  // Consultas remotas de solo lectura; jamás se mezclan con localStorage.
  const REMOTE_RESOURCES={
    clientes:{titulo:'Clientes reales',permiso:'clientes.gestionar',campos:[['id','ID'],['nombre','Nombre'],['activo','Activo']]},
    productos:{titulo:'Productos reales',permiso:'productos.gestionar',campos:[['id','ID'],['sku','SKU'],['nombre','Producto'],['activo','Activo']]},
    ventas:{titulo:'Ventas reales',permiso:'ventas.ver',campos:[['id','ID'],['total','Total'],['estado','Estado']]},
    notas_venta:{titulo:'Notas de venta',permiso:'ventas.ver',campos:[['id','ID'],['estado','Estado']]},
    bodegas:{titulo:'Bodegas',permiso:'inventario.ver',campos:[['id','ID'],['nombre','Bodega'],['activo','Activo']]},
    movimientos_inventario:{titulo:'Movimientos de inventario',permiso:'inventario.ver',campos:[['id','ID'],['tipo','Tipo'],['cantidad','Cantidad']]},
    proveedores:{titulo:'Proveedores',permiso:'compras.gestionar',campos:[['id','ID'],['nombre','Proveedor'],['activo','Activo']]}
  };
  const PRODUCTS=[
    ['rubroId','rubros',null],
    ['departamentoId','departamentos','rubroId'],
    ['familiaId','familias','departamentoId'],
    ['lineaId','lineas','familiaId'],
    ['marcaId','marcas',null],
    ['modeloId','modelos','marcaId'],
    ['tipoUnidadId','tipos_unidad',null],
    ['gramajeId','gramajes',null],
    ['tipoEnvasadoId','tipos_envasado',null],
    ['condicionTributariaId','condiciones_tributarias',null]
  ];
  const cache=Object.fromEntries(KEYS.map(k=>[k,[]]));
  let authorized=false,selected='rubros',restrictedKey=null,root=null,busy=false;
  const access=()=>window.RutaHDAccesos;
  const canSee=key=>access()?.canViewCatalog(key)??true;
  const canManage=key=>access()?.canManageCatalog(key)??true;
  const el=(tag,cls,text)=>{
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!==undefined)x.textContent=String(text);
    return x;
  };
  const add=(parent,...items)=>{items.forEach(x=>parent.appendChild(x));return parent;};
  const button=(name,handler,cls='button ghost')=>{
    const b=el('button',cls,name);b.type='button';b.addEventListener('click',handler);return b;
  };
  const status=(message,isError=false)=>{
    const box=root?.querySelector('#remoteStatus');
    if(box){box.textContent=message;box.setAttribute('role',isError?'alert':'status');}
  };
  const errorText=e=>{
    if(e?.status===401)return 'Sesión vencida: vuelve a iniciar sesión.';
    if(e?.status===503)return 'Laravel aún no está habilitado: faltan configurar sus secretos privados y la cuenta administradora.';
    if(e?.status===403)return 'El perfil no tiene permiso para operar este submódulo.';
    if(e?.status===404)return 'El recurso no existe o aún no se ha desplegado.';
    if(e?.status===409)return 'Conflicto: registro duplicado o con referencias.';
    if(e?.status===422)return 'Datos inválidos: revisa nombre, jerarquía y condición tributaria.';
    return e?.name==='AbortError'?'Tiempo de conexión agotado.':
      'No se pudo completar la operación. Comprueba URL, CORS, conexión y despliegue.';
  };
  async function guarded(fn){
    if(busy)return;
    busy=true;
    try {await fn();}
    catch(e){status(errorText(e),true);if(e?.status===401){API().signOut();authorized=false;access()?.clear();render();}}
    finally{busy=false;}
  }
  async function refresh(){
    const permitted=KEYS.filter(key=>canSee(key));
    const response=await Promise.all(permitted.map(key=>API().list(key)));
    KEYS.forEach(key=>cache[key]=[]);
    permitted.forEach((key,i)=>{cache[key]=response[i].items;});
    if(!permitted.includes(selected))selected=permitted[0]||'rubros';
    authorized=true;render();
    status('Catálogos cargados desde la API autenticada. No se importaron los datos locales.');
  }
  function mount(parent,key=null){
    restrictedKey=key&&KEYS.includes(key)?key:null;
    if(restrictedKey)selected=restrictedKey;
    const container=el('section','surface-panel');
    container.id='adminRemoto';
    container.style.marginBottom='20px';
    root=container;
    parent.prepend(container);
    render();
  }
  function render(){
    if(!root)return;
    root.replaceChildren();
    const header=el('div','panel-heading');
    add(header,add(el('div'),el('span','overline','CONEXIÓN SEGURA'),el('h3','','Administración MySQL')),
      el('p','','Separada de los catálogos de demostración.'));
    root.appendChild(header);
    const message=el('p','catalog-footnote','');message.id='remoteStatus';root.appendChild(message);
    if(!authorized){renderLogin();return;}
    const keys=KEYS.filter(key=>canSee(key));
    if(!keys.length && !access()?.has('productos.gestionar')){
      root.appendChild(el('p','catalog-footnote','Tu perfil no tiene acceso a los catálogos de Productos.'));
      return;
    }
    const bar=el('div','workspace-actions');
    bar.style.flexWrap='wrap';
    add(bar,button('Actualizar datos',()=>guarded(refresh)),
      button('Cerrar sesión remota',()=>guarded(async()=>{
        try { await API().logout(); }
        catch(e) { API().signOut(); }
        authorized=false;
        access()?.clear();
        KEYS.forEach(k=>cache[k]=[]);
        render();
        status('Sesión remota cerrada y token descartado.');
      })));
    root.appendChild(bar);
    if(!restrictedKey){
      const tabs=el('div','catalog-tabs');
      keys.forEach(key=>{
        const b=button(CONFIG[key][0],()=>{selected=key;render();},'catalog-tab');
        b.classList.toggle('selected',selected===key);tabs.appendChild(b);
      });
      root.appendChild(tabs);
    }
    if(!keys.includes(selected)){
      root.appendChild(el('p','catalog-footnote','Acceso denegado al submódulo solicitado.'));
      return;
    }
    const action=el('div','workspace-actions');
    const create=button('Nuevo registro de '+CONFIG[selected][0],()=>edit(null),'button primary');
    create.disabled=!canManage(selected);
    action.appendChild(create);
    root.appendChild(action);
    const list=el('div','catalog-table-scroll'),table=el('table','catalog-table');
    const headerRow=el('tr');
    ['Nombre','Estado','Acciones'].forEach(s=>headerRow.appendChild(el('th','',s)));
    table.appendChild(add(el('thead'),headerRow));
    const rows=el('tbody');
    cache[selected].forEach(rec=>{
      const tr=el('tr'),name=el('td','',rec.nombre);
      tr.appendChild(name);tr.appendChild(el('td','',rec.activo?'Activo':'Inactivo'));
      const actions=el('td','catalog-actions');
      const editBtn=button('Editar',()=>edit(rec),'catalog-small-button');
      const deleteBtn=button('Eliminar',()=>remove(rec),'catalog-small-button danger-text');
      editBtn.disabled=!canManage(selected);deleteBtn.disabled=!canManage(selected);
      actions.appendChild(editBtn);actions.appendChild(deleteBtn);
      tr.appendChild(actions);rows.appendChild(tr);
    });
    table.appendChild(rows);list.appendChild(table);root.appendChild(list);
    if(!restrictedKey && access()?.has('productos.gestionar'))renderProductAssignment();
    if(!restrictedKey)renderReadOnlyResources();
  }
  function renderLogin(){
    const form=el('form','form-grid');
    const field=(label,type,placeholder)=>{
      const wrapper=el('label','field'),name=el('span','',label);
      const input=el('input');input.type=type;input.placeholder=placeholder;input.required=true;
      wrapper.appendChild(name);wrapper.appendChild(input);form.appendChild(wrapper);return input;
    };
    const url=field('URL de la API Laravel','url','https://dominio-seguro.example');
    url.value=window.location.origin;
    const email=field('Correo del administrador','email','administracion@example.cl');
    const password=field('Contraseña','password','');
    form.appendChild(el('p','catalog-footnote','No uses el formulario mientras la API esté bloqueada o no tenga autenticación verificada.'));
    const check=button('Verificar API Laravel',()=>guarded(async()=>{
      API().configure(url.value.trim());
      const estado=await API().status();
      if(!estado.disponible) {
        status('API protegida (HTTP '+estado.http+'). No intentes iniciar sesión hasta que se habilite Laravel.',true);
      } else {
        status('API Laravel disponible. Puedes iniciar sesión con tu cuenta autorizada.');
      }
    }));
    form.appendChild(check);
    const submit=el('button','button primary','Conectar a API');submit.type='submit';form.appendChild(submit);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const secret=password.value;password.value='';
      guarded(async()=>{
        API().configure(url.value.trim());
        try {
          const usuario=await API().login(email.value.trim(),secret);
          access()?.setSession(usuario);
          await refresh();
        } catch (error) {
          API().signOut();
          authorized=false;
          access()?.clear();
          throw error;
        }
      });
    });
    root.appendChild(form);
  }
  function dialog(title,formBody,onSubmit,deleteMode=false){
    const dialog=el('dialog','modal catalog-dialog'),form=el('form');
    form.noValidate=true;
    form.appendChild(el('h2','',title));form.appendChild(formBody);
    const footer=el('div','modal-footer');
    footer.appendChild(button('Cancelar',()=>dialog.close()));
    const confirm=el('button',deleteMode?'button danger':'button primary',deleteMode?'Eliminar':'Guardar');
    confirm.type='submit';footer.appendChild(confirm);form.appendChild(footer);
    const msg=el('p','form-error');msg.hidden=true;form.appendChild(msg);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      guarded(async()=>{
        try{await onSubmit();dialog.close();}
        catch(e){msg.textContent=errorText(e);msg.hidden=false;}
      });
    });
    dialog.appendChild(form);document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.showModal();
  }
  function edit(rec){
    if(!canManage(selected)){status('Tu perfil no puede modificar este catálogo.',true);return;}
    const key=selected,parentKey=CONFIG[key][1],body=el('div','form-grid');
    const name=el('input');name.required=true;name.maxLength=100;name.value=rec?.nombre??'';
    add(body,el('label','','Nombre o valor'),name);
    const state=el('select');
    [['1','Activo'],['0','Inactivo']].forEach(([id,label])=>{
      const opt=el('option','',label);opt.value=id;state.appendChild(opt);
    });
    state.value=rec?.activo===false?'0':'1';
    add(body,el('label','','Estado'),state);
    let parent=null;
    if(parentKey){
      parent=el('select');parent.required=true;
      const blank=el('option','','Seleccione un padre');blank.value='';parent.appendChild(blank);
      cache[parentKey].filter(x=>x.activo||String(x.id)===String(rec?.parentId)).forEach(p=>{
        const option=el('option','',p.nombre);option.value=p.id;parent.appendChild(option);
      });
      parent.value=rec?.parentId??'';
      add(body,el('label','','Pertenece a '+CONFIG[parentKey][0]),parent);
    }
    if(key==='condiciones_tributarias'&&rec){
      name.readOnly=true;
    }
    dialog((rec?'Editar ':'Crear ')+CONFIG[key][0],body,async()=>{
      if(!name.value.trim()||(parent&&!parent.value))throw new Error('Formulario incompleto');
      const data={nombre:name.value.trim(),activo:state.value==='1',parentId:parent?Number(parent.value):null};
      if(rec)await API().update(key,rec.id,data);
      else await API().create(key,data);
      await refresh();status('Catálogo actualizado en servidor.');
    });
  }
  function remove(rec){
    if(!canManage(selected)){status('Tu perfil no puede eliminar este catálogo.',true);return;}
    const key=selected;
    dialog('¿Eliminar '+rec.nombre+'?',el('p','','Se eliminará en la base de datos. Solo es posible si no existen relaciones.'),async()=>{
      await API().remove(key,rec.id);await refresh();status('Registro eliminado del servidor.');
    },true);
  }
  function renderReadOnlyResources(){
    const permitted=Object.entries(REMOTE_RESOURCES).filter(([,config])=>access()?.has(config.permiso));
    if(!permitted.length)return;
    const panel=el('section','catalog-main');
    panel.appendChild(el('h3','','Consultas reales del servidor'));
    panel.appendChild(el('p','catalog-footnote','Lecturas paginadas desde MySQL autenticado. Los registros de demostración permanecen separados y no se sincronizan.'));
    const bar=el('div','workspace-actions');
    bar.style.flexWrap='wrap';
    const selection=el('select');
    selection.setAttribute('aria-label','Recurso real de MySQL');
    permitted.forEach(([key,config])=>{
      const option=el('option','',config.titulo);option.value=key;selection.appendChild(option);
    });
    const results=el('div','catalog-table-scroll');
    const pagination=el('p','catalog-footnote','');
    let pageNumber=1,lastPage=1;
    const load=async()=>{
      const key=selection.value,definition=REMOTE_RESOURCES[key];
      if(!definition||!access()?.has(definition.permiso))throw new Error('Acceso no permitido');
      const response=await API().resources(key,pageNumber);
      if(!Array.isArray(response?.data) || !Number.isFinite(Number(response.last_page))) {
        throw new Error('Respuesta paginada inválida');
      }
      lastPage=Math.max(1,Number(response.last_page));
      const table=el('table','catalog-table'),head=el('thead'),headRow=el('tr');
      definition.campos.forEach(([,label])=>headRow.appendChild(el('th','',label)));
      head.appendChild(headRow);table.appendChild(head);
      const body=el('tbody');
      response.data.forEach(record=>{
        const row=el('tr');
        definition.campos.forEach(([field])=>{
          const value=record?.[field];
          row.appendChild(el('td','',value===null||value===undefined?'—':String(value)));
        });
        body.appendChild(row);
      });
      table.appendChild(body);
      results.replaceChildren(table);
      pagination.textContent='Página '+pageNumber+' de '+lastPage+' · Registros: '+Number(response.total||0);
      prev.disabled=pageNumber<=1;next.disabled=pageNumber>=lastPage;
      status('Datos consultados desde Laravel/MySQL. Solo lectura; no se modificó ningún registro.');
    };
    const consult=button('Consultar MySQL',()=>guarded(load));
    const prev=button('Anterior',()=>guarded(async()=>{if(pageNumber>1){pageNumber--;await load();}}));
    const next=button('Siguiente',()=>guarded(async()=>{if(pageNumber<lastPage){pageNumber++;await load();}}));
    prev.disabled=true;next.disabled=true;
    selection.addEventListener('change',()=>{pageNumber=1;lastPage=1;prev.disabled=true;next.disabled=true;results.replaceChildren();pagination.textContent='';});
    add(bar,selection,consult,prev,next);
    add(panel,bar,results,pagination);
    root.appendChild(panel);
  }

  function renderProductAssignment(){
    const panel=el('section','catalog-main');
    panel.appendChild(el('h3','','Clasificar un producto existente'));
    panel.appendChild(el('p','catalog-footnote','Este formulario solo cambia la clasificación; no crea productos ni altera precios o stock.'));
    const form=el('form','form-grid');
    const idRow=el('label','field','ID numérico del producto en MySQL');
    const productId=el('input');productId.type='number';productId.min='1';productId.step='1';productId.required=true;
    idRow.appendChild(productId);form.appendChild(idRow);
    const identity=el('p','catalog-footnote','Primero consulta el producto para comprobar su identidad y clasificación actual.');
    form.appendChild(identity);
    let loaded=null;
    const approval=el('input');approval.type='checkbox';
    productId.addEventListener('input',()=>{
      loaded=null;approval.checked=false;
      identity.textContent='Producto sin verificar. Consulta el ID antes de guardar.';
    });
    const controls={};
    PRODUCTS.forEach(([field,catalog])=>{
      const label=el('label','field',CONFIG[catalog][0]),select=el('select');
      select.required=true;select.dataset.field=field;
      controls[field]=select;label.appendChild(select);form.appendChild(label);
    });
    function update(){
      PRODUCTS.forEach(([field,catalog,depends])=>{
        const control=controls[field],old=control.value;
        const subset=cache[catalog].filter(rec=>rec.activo&&
          (!depends||String(rec.parentId)===String(controls[depends].value)));
        control.replaceChildren();
        const placeholder=el('option','','Seleccionar...');placeholder.value='';
        control.appendChild(placeholder);
        subset.forEach(rec=>{
          const option=el('option','',rec.nombre);option.value=rec.id;control.appendChild(option);
        });
        control.value=subset.some(rec=>String(rec.id)===String(old))?old:'';
        control.disabled=Boolean(depends&&!controls[depends].value);
      });
    }
    PRODUCTS.forEach(([field])=>controls[field].addEventListener('change',update));
    update();
    form.appendChild(button('Consultar producto en MySQL',()=>guarded(async()=>{
      const id=Number(productId.value);
      if(!Number.isSafeInteger(id)||id<1){status('Ingresa un ID válido para consultar.',true);return;}
      const registro=await API().getProductClassification(id);
      if(Number(registro.id)!==id)throw new Error('El ID consultado no coincide.');
      loaded={id,nombre:registro.nombre,sku:registro.sku};
      identity.textContent='Producto verificado: '+registro.nombre+' · SKU: '+registro.sku+' · ID: '+id;
      PRODUCTS.forEach(([field])=>{
        const value=registro.clasificacion?.[field];
        if(value!==undefined&&value!==null){
          controls[field].value=String(value);
          update();
        }
      });
      approval.checked=false;
      status('Producto consultado. Confirma la identidad antes de guardar.');
    })));
    const approvalLabel=el('label','field');
    approvalLabel.appendChild(approval);
    approvalLabel.appendChild(el('span','',
      'Confirmo que el ID, SKU y nombre corresponden al producto que quiero modificar.'));
    form.appendChild(approvalLabel);
    const submit=el('button','button primary','Guardar clasificación en MySQL');submit.type='submit';
    form.appendChild(submit);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      guarded(async()=>{
        if(!loaded||Number(productId.value)!==loaded.id){
          status('Consulta el producto para verificar su identidad antes de guardar.',true);return;
        }
        if(!approval.checked){
          status('Confirma la identidad del producto antes de modificarlo.',true);return;
        }
        const payload=Object.fromEntries(PRODUCTS.map(([field])=>[field,Number(controls[field].value)]));
        await API().classifyProduct(loaded.id,payload);
        approval.checked=false;
        status('Clasificación guardada para '+loaded.nombre+' (SKU '+loaded.sku+').');
      });
    });
    panel.appendChild(form);root.appendChild(panel);
  }
  window.RutaHDRemoto=Object.freeze({mount});
})();
