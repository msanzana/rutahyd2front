/* Ruta H&D2: cliente API de catálogos con Bearer JWT.
 * Los tokens viven únicamente en memoria; jamás en localStorage.
 * Mantenemos cookies técnicas del MISMO ORIGEN para el desafío anti-bot de
 * InfinityFree; nunca usamos cookies como credencial JWT ni enviamos cookies CORS.
 * Producción exclusivamente: sin JWT y API validada no se muestra información operativa.
 */
(() => {
  'use strict';
  const VALID = new Set([
    'rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','tipos_envasado','condiciones_tributarias','tipos_codigos_barras'
  ]);
  const RESOURCES = new Set(['clientes','productos','ventas','notas_venta','bodegas','movimientos_inventario','proveedores','ordenes_compra']);
  const MANAGEABLE = new Set(['clientes','proveedores','bodegas']);
  const FIELDS = [
    'rubroId','departamentoId','familiaId','lineaId','marcaId','modeloId',
    'tipoUnidadId','tipoEnvasadoId','condicionTributariaId'
  ];
  let endpoint = null;
  let bearer = null;

  function configure(apiOrigin) {
    const url = new URL(apiOrigin, window.location.origin);
    if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) {
      throw new Error('La API debe usar HTTPS.');
    }
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash) throw new Error('URL de API no permitida.');
    const localDev=['localhost','127.0.0.1'].includes(window.location.hostname);
    if (url.origin !== window.location.origin && !localDev) {
      throw new Error('Para proteger la sesión, la API debe estar alojada en el mismo origen HTTPS.');
    }
    if (url.pathname !== '/' && url.pathname !== '/api/v1' && url.pathname !== '/api/v1/') {
      throw new Error('La ruta de API debe ser la raíz del servidor o /api/v1.');
    }
    endpoint = url.origin + '/api/v1';
  }

  function authenticate(token) {
    if (typeof token !== 'string' || token.length > 4096 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      throw new Error('Token Bearer JWT inválido.');
    }
    bearer = token;
  }

  function signOut() { bearer = null; }
  async function logout() {
    try { if (bearer) await send('/sesion','DELETE'); }
    finally { bearer = null; }
  }
  async function login(email, password) {
    if (!endpoint) throw new Error('Configura primero el servidor.');
    if (typeof email !== 'string' || !email.includes('@') || !password)
      throw new Error('Se requiere correo y contraseña.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(endpoint + '/sesion', {
        method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({correo_electronico:email,contrasena:password}),
        credentials:'same-origin', cache:'no-store', signal:controller.signal
      });
    } finally { clearTimeout(timer); }
    if (!response.ok) {
      const error = new Error('No se pudo iniciar sesión (HTTP ' + response.status + ')');
      error.status = response.status;
      throw error;
    }
    if (!(response.headers.get('Content-Type') || '').includes('application/json')) {
      throw new Error('La dirección no respondió como API JSON. Laravel aún puede estar deshabilitado.');
    }
    const data = await response.json();
    if (data.token_type !== 'Bearer') throw new Error('La API no devolvió un JWT Bearer.');
    authenticate(data.token);
    return data.usuario;
  }

  // Comprobación anónima del gateway antes de solicitar credenciales.
  async function status() {
    if (!endpoint) throw new Error('Configura primero el servidor.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(endpoint + '/estado', {
        method: 'GET', headers: {Accept:'application/json'},
        credentials:'same-origin', cache:'no-store', signal:controller.signal
      });
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('La URL no corresponde a la API de Ruta H&D.');
      }
      const body = await response.json();
      if (!body || body.servicio !== 'Ruta H&D2 API' ||
          !['disponible','no_habilitada'].includes(body.estado)) {
        throw new Error('El servidor no devolvió el estado de Ruta H&D.');
      }
      return Object.freeze({
        disponible: response.status === 200 && body.estado === 'disponible',
        http: response.status,
        estado: body.estado
      });
    } finally { clearTimeout(timer); }
  }

  async function sendCore(path, method = 'GET', body) {
    if (!endpoint || !bearer) throw new Error('La API requiere configuración y sesión autenticada.');
    const sessionBearer = bearer;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(endpoint + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + sessionBearer,
          Accept: 'application/json',
          ...(body !== undefined && !(body instanceof FormData) ? {'Content-Type':'application/json'} : {})
        },
        ...(body !== undefined ? {body:body instanceof FormData?body:JSON.stringify(body)} : {}),
        signal:controller.signal,
        credentials:'same-origin',
        cache:'no-store'
      });
    if (!response.ok) {
      const error = new Error('Error HTTP ' + response.status);
      error.status = response.status;
      // Un 401 revoca la sesión de toda la aplicación (no solo del módulo abierto).
      // Un 403 conserva la sesión y únicamente deniega la operación solicitada.
      if (response.status === 401 && path !== '/sesion' && bearer === sessionBearer) {
        // Una respuesta tardía de una sesión anterior nunca puede cerrar la actual.
        bearer = null;
        window.RutaHDAccesos?.clear();
      }
      // Mostrar validaciones Laravel de forma segura, sin datos de sesión ni SQL.
      if ([409,413,415,422,503].includes(response.status) &&
          (response.headers.get('Content-Type')||'').includes('application/json')) {
        try {
          const details=await response.json();
          const values=details?.errors&&typeof details.errors==='object'?
            Object.values(details.errors).flat().filter(x=>typeof x==='string'):[];
          const explanation=values[0]||(typeof details?.message==='string'?details.message:'');
          if(explanation && explanation.length<350 &&
             !/SQLSTATE|stack trace|password|token|database connection/i.test(explanation))
            error.userMessage=explanation;
          error.validationErrors=details?.errors||null;
        }catch(_ignored){}
      }
      throw error;
    }
    if (response.status === 204) return null;
    if (!(response.headers.get('Content-Type') || '').includes('application/json')) {
      throw new Error('La API no devolvió una respuesta JSON válida.');
    }
    return await response.json();
    } catch (e) {
      if(e?.name==='AbortError'){const err=new Error('La solicitud excedió el tiempo de espera.');err.userMessage=method==='GET'?'No se pudo completar la consulta. Puede cerrar la ventana y volver a intentarlo.':'No se confirmó el resultado de la operación. Revise el estado antes de volver a intentarlo.';throw err;}
      throw e;
    } finally { clearTimeout(timer); }
  }

  async function send(path,method='GET',body){
    const finish=window.RutaHDCarga?.start({path,method});
    try{return await sendCore(path,method,body);}
    finally{finish?.();}
  }

  async function pdfOrden(idValue,resource='ordenes-compra') {
    if(!endpoint||!bearer)throw Error('Inicia sesión para ver el documento.');
    const token=bearer;
    const done=window.RutaHDCarga?.start({path:'/'+resource+'/'+idValue+'/pdf',method:'GET'});
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
    try{
      const response=await fetch(endpoint+'/'+resource+'/'+id(idValue)+'/pdf',{
        headers:{Authorization:'Bearer '+token,Accept:'application/pdf'},
        credentials:'same-origin',cache:'no-store',signal:abort.signal
      });
      if(!response.ok){
        if(response.status===401&&bearer===token){
          bearer=null;window.RutaHDAccesos?.clear();
        }
        const err=new Error('No se pudo abrir el PDF (HTTP '+response.status+')');
        err.status=response.status;throw err;
      }
      if(!(response.headers.get('Content-Type')||'').includes('application/pdf'))
        throw Error('El servidor no entregó un PDF válido.');
      const blob=await response.blob();
      if(blob.size<100||blob.size>10485760)throw Error('Tamaño del PDF incorrecto.');
      return blob;
    }finally{clearTimeout(timer);done?.();}
  }

  async function sendBinaryCore(path,method='GET',files=null,attachment=false) {
    if(!endpoint||!bearer)throw new Error('Debes iniciar sesión.');
    const token=bearer;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try {
      const response=await fetch(endpoint+path,{
        method,
        headers:{Authorization:'Bearer '+token,Accept:files?'application/json':attachment?'application/octet-stream':'image/*'},
        ...(files?{body:files}:{}),
        credentials:'same-origin',cache:'no-store',signal:controller.signal
      });
      if(!response.ok){
        const error=new Error('Error HTTP '+response.status);error.status=response.status;
        if(response.status===401&&token===bearer){
          bearer=null;window.RutaHDAccesos?.clear();
        }
        if((response.headers.get('Content-Type')||'').includes('application/json')){
          try {
            const body=await response.json();
            const first=Object.values(body.errors||{}).flat()[0];
            const msg=typeof first==='string'?first:body.message;
            if(typeof msg==='string'&&msg.length<350&&
              !/SQLSTATE|stack trace|password|token/i.test(msg))error.userMessage=msg;
          }catch(_ignored){}
        }
        throw error;
      }
      if(files){
        if(!(response.headers.get('Content-Type')||'').includes('application/json'))
          throw Error('El servidor no confirmó el guardado de las fotografías.');
        return response.json();
      }
      const kind=(response.headers.get('Content-Type')||'').split(';')[0];
      if(attachment?kind!=='application/octet-stream':!['image/jpeg','image/png','image/webp'].includes(kind))
        throw Error('La API no devolvió una fotografía válida.');
      const blob=await response.blob();
      if(blob.size>2097152+2048)throw Error('La imagen supera el límite de carga.');
      return blob;
    }finally{clearTimeout(timer);}
  }

  async function sendBinary(path,method='GET',files=null,attachment=false){
    const finish=window.RutaHDCarga?.start({path,method});
    try{return await sendBinaryCore(path,method,files,attachment);}
    finally{finish?.();}
  }

  async function publicoCore(path,payload) {
    if (!endpoint) configure(window.location.origin);
    if(!['/recuperacion/solicitar','/recuperacion/restablecer'].includes(path))
      throw new Error('Ruta no autorizada');
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(endpoint+path,{
        method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},
        body:JSON.stringify(payload),credentials:'same-origin',cache:'no-store',signal:controller.signal
      });
      if(!response.ok){const err=new Error('HTTP '+response.status);err.status=response.status;throw err;}
      if(!(response.headers.get('Content-Type')||'').includes('application/json'))throw new Error('No se recibió JSON');
      return response.json();
    }finally{clearTimeout(timer);}
  }

  async function publico(path,payload){
    const finish=window.RutaHDCarga?.start({path,method:'POST'});
    try{return await publicoCore(path,payload);}
    finally{finish?.();}
  }

  function key(catalogo) {
    if (!VALID.has(catalogo)) throw new Error('Catálogo desconocido.');
    return encodeURIComponent(catalogo);
  }
  function id(value) {
    if (!/^\d+$/.test(String(value)) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
      throw new Error('Identificador inválido.');
    }
    return String(value);
  }
  const api = Object.freeze({
    configure, authenticate, login, logout, signOut, status,
    branchContext: ()=>send('/contexto-sucursal'),
    selectBranchContext: (sid,version)=>send('/contexto-sucursal','POST',{sucursal_id:Number(id(sid)),version_contexto:version}),
    branches: (page=1,buscar='')=>send('/sucursales?'+new URLSearchParams({page:String(page),buscar})),
    createBranch: data=>send('/sucursales','POST',data),
    updateBranch: (sid,data)=>send('/sucursales/'+id(sid),'PUT',data),
    branchStatus: (sid,activo)=>send('/sucursales/'+id(sid)+'/estado','PATCH',{activo}),
    branchWarehouses: (sid,page=1,buscar='')=>send('/sucursales/'+id(sid)+'/bodegas?'+new URLSearchParams({page:String(page),buscar})),
    assignBranchWarehouse: (sid,bid)=>send('/sucursales/'+id(sid)+'/bodegas/'+id(bid),'PUT',{}),
    branchUsers: (sid,page=1,buscar='')=>send('/sucursales/'+id(sid)+'/usuarios?'+new URLSearchParams({page:String(page),buscar})),
    branchAccess: (sid,uid,activo)=>send('/sucursales/'+id(sid)+'/usuarios/'+id(uid),'PUT',{activo}),
    inventoryCatalogs: (page=1,buscar='',rapido=false)=>send('/inventario/catalogos?'+new URLSearchParams({page:String(page),buscar,rapido:rapido?'1':'0'})),
    inventoryUpdateReason: (rid,datos)=>send('/inventario/motivos/'+id(rid),'PUT',datos),
    transfers: (page=1,buscar='',filters={})=>send('/inventario/traspasos?'+new URLSearchParams({page:String(page),buscar,...filters})),
    transfer: rid=>send('/inventario/traspasos/'+id(rid)),
    transferPdf: rid=>pdfOrden(rid,'inventario/traspasos'),
    transferWarehouses: ()=>send('/inventario/traspasos/bodegas'),
    transferCreate: data=>send('/inventario/traspasos','POST',data),
    transferAction: (rid,action,data)=>{if(!['aprobar','anular','confirmar','despachar'].includes(action))throw Error('Acción inválida.');return send('/inventario/traspasos/'+id(rid)+'/'+action,'POST',data);},
    transferReceiptCreate: (rid,data)=>send('/inventario/traspasos/'+id(rid)+'/recepciones','POST',data),
    transferReceiptAction: (rid,oid,action,data)=>{if(!['aprobar','anular','confirmar'].includes(action))throw Error('Acción inválida.');return send('/inventario/traspasos/'+id(rid)+'/recepciones/'+id(oid)+'/'+action,'POST',data);},
    generalAdjustments: (page=1,buscar='')=>send('/inventario/ajustes?'+new URLSearchParams({page:String(page),buscar})),
    generalAdjustment: rid=>send('/inventario/ajustes/'+id(rid)),
    generalAdjustmentPreview: data=>send('/inventario/ajustes/revision','POST',data),
    generalAdjustmentCreate: data=>{if(!(data instanceof FormData))throw Error('Adjunte los respaldos.');return send('/inventario/ajustes','POST',data);},
    generalAdjustmentAttachment: (rid,aid)=>sendBinary('/inventario/ajustes/'+id(rid)+'/respaldos/'+id(aid),'GET',null,true),
    generalAdjustmentAction: (rid,action,data)=>{if(!['aprobar','anular','confirmar'].includes(action))throw Error('Acción inválida.');return send('/inventario/ajustes/'+id(rid)+'/'+action,'POST',data);},
    inventoryAdjustments: (page=1,buscar='')=>send('/inventario/ajustes-rapidos?'+new URLSearchParams({page:String(page),buscar})),
    inventoryAdjustment: rid=>send('/inventario/ajustes-rapidos/'+id(rid)),
    inventoryCandidates: (page=1,buscar='')=>send('/inventario/ajustes-rapidos/candidatos?'+new URLSearchParams({page:String(page),buscar})),
    inventoryOrigin: kid=>send('/inventario/ajustes-rapidos/origen/'+id(kid)),
    inventoryWarehouses: ()=>send('/inventario/ajustes-rapidos/bodegas'),
    inventoryCreateAdjustment: datos=>send('/inventario/ajustes-rapidos','POST',datos),
    inventoryAdjustmentAction: (rid,action,datos)=>{
      if(!['aprobar','anular','confirmar'].includes(action))throw Error('Acción inválida');
      return send('/inventario/ajustes-rapidos/'+id(rid)+'/'+action,'POST',datos);
    },
    operationalPurchasePdf: (kind,cid)=>{if(!['recepcion','consolidacion'].includes(kind))throw Error('Tipo de documento inválido.');return pdfOrden(cid,'documentos-recepcion/'+kind);},
    regularizationPdf: sid=>pdfOrden(sid,'solicitudes-regularizacion'),
    retryRegularizationMail: (nid,datos)=>send('/notificaciones-regularizacion/'+id(nid)+'/reenviar','POST',datos),
    consolidationCandidates: oc=>send('/consolidaciones-recepcion/candidatas/'+id(oc)),
    createConsolidation: datos=>send('/consolidaciones-recepcion','POST',datos),
    getConsolidation: cid=>send('/consolidaciones-recepcion/'+id(cid)),
    updateConsolidation: (cid,datos)=>send('/consolidaciones-recepcion/'+id(cid),'PUT',datos),
    confirmConsolidation: (cid,datos)=>send('/consolidaciones-recepcion/'+id(cid)+'/confirmar','POST',datos),
    cancelConsolidation: (cid,datos)=>send('/consolidaciones-recepcion/'+id(cid)+'/anular','POST',datos),
    confirmReceiptDraft: (receiptId,datos)=>send('/recepciones-borrador/'+id(receiptId)+'/confirmar','POST',datos),
    reviewReceiptDraft: receiptId=>send('/recepciones-borrador/'+id(receiptId)+'/revision'),
    cancelReceiptDraft: (receiptId,datos)=>send('/recepciones-borrador/'+id(receiptId)+'/anular','POST',datos),
    createReceiptDraft: datos=>send('/recepciones-borrador','POST',datos),
    getReceiptDraft: receiptId=>send('/recepciones-borrador/'+id(receiptId)),
    updateReceiptDraft: (receiptId,datos)=>send('/recepciones-borrador/'+id(receiptId),'PUT',datos),
    purchaseConsultation: (key,page=1,buscar='',filters={})=>{
      const stock=['stock','kardex'].includes(key);
      if(!stock&&!['facturas','recepciones','consolidaciones','libro'].includes(key))throw Error('Consulta no válida');
      return send((stock?'/inventario-consultas/':'/compras-consultas/')+key+'?'+new URLSearchParams({page:String(page),buscar,...filters}));
    },
    profile: () => send('/perfil'),
    userTheme: () => send('/perfil/preferencias'),
    saveTheme: tema_interfaz => {
      if(!['claro','oscuro'].includes(tema_interfaz))throw Error('Tema inválido');
      return send('/perfil/preferencias','PUT',{tema_interfaz});
    },
    requestRecovery: correo_electronico =>
      publico('/recuperacion/solicitar',{correo_electronico}),
    resetPassword: (token,contrasena,contrasena_confirmation) =>
      publico('/recuperacion/restablecer',{token,contrasena,contrasena_confirmation}),
    usersAll: () => send('/usuarios'),
    createUser: datos => send('/usuarios','POST',datos),
    updateUser: (userId,datos) => send('/usuarios/'+id(userId),'PUT',datos),
    deleteUser: userId => send('/usuarios/'+id(userId),'DELETE'),
    roleCatalogPermissions: () => send('/perfiles/catalogos'),
    usersForProfiles: () => send('/perfiles/usuarios'),
    assignUserRole: (userId,roleId) =>
      send('/perfiles/usuarios/' + id(userId) + '/rol','PUT',{rol_id:Number(id(roleId))}),
    saveRoleCatalogPermissions: (roleId, modulos, submodulos=null) =>
      send('/perfiles/' + id(roleId) + '/catalogos','PUT',
        submodulos?{modulos,submodulos}:{modulos}),
    // Ubicaciones geográficas: CRUD JWT y una única FK ciudad_id en entidades.
    locations: (tipo,{padreId=null,buscar='',page=1,perPage=100,incluirInactivos=false}={})=>{
      const allowed=new Set(['paises','regiones','provincias','comunas','ciudades']);
      if(!allowed.has(tipo))throw Error('Catálogo de ubicación inválido');
      const q=new URLSearchParams({page:String(page),por_pagina:String(perPage)});
      if(padreId!=null)q.set('padre_id',id(padreId));
      if(buscar)q.set('buscar',String(buscar).slice(0,120));
      if(incluirInactivos)q.set('incluye_inactivos','1');
      return send('/ubicaciones/'+tipo+'?'+q);
    },
    locationPath: ciudadId=>send('/ubicaciones/jerarquia/'+id(ciudadId)),
    createLocation: (tipo,datos)=>send('/ubicaciones/'+encodeURIComponent(tipo),'POST',datos),
    updateLocation: (tipo,geoId,datos)=>
      send('/ubicaciones/'+encodeURIComponent(tipo)+'/'+id(geoId),'PUT',datos),
    deactivateLocation: (tipo,geoId)=>
      send('/ubicaciones/'+encodeURIComponent(tipo)+'/'+id(geoId),'DELETE'),
    // Catálogos SII vigentes y buscador de producto reutilizable para cualquier módulo.
    girosSii: ({buscar='',page=1,perPage=25,codigo=null}={})=>{
      const q=new URLSearchParams({buscar:String(buscar).slice(0,120),
        page:String(page),por_pagina:String(perPage)});
      if(codigo!==null)q.set('codigo',String(codigo));
      return send('/giros-sii?'+q.toString());
    },
    buscarProductos: ({buscar='',page=1,filters={},orden='nombre',perPage=25}={})=>{
      const allowed=new Set([
        'codigo_barras','rubro_id','departamento_id','familia_id','linea_id',
        'marca_id','modelo_id','tipo_unidad_id','tipo_envasado_id',
        'condicion_tributaria_id','proveedor_id','solo_sin_proveedor_id',
        'sku_desde','sku_hasta','id_desde','id_hasta'
      ]);
      if(!Number.isInteger(Number(page))||Number(page)<1||Number(page)>10000)
        throw Error('Página de buscador inválida');
      if(![ 'sku','nombre' ].includes(orden))throw Error('Orden inválido');
      if(!Number.isInteger(Number(perPage))||Number(perPage)<1||Number(perPage)>25)
        throw Error('Cantidad de productos fuera del límite');
      const q=new URLSearchParams({page:String(page),por_pagina:String(perPage),
        orden,buscar:String(buscar).slice(0,120)});
      for(const [key,value] of Object.entries(filters||{})){
        if(!allowed.has(key))throw Error('Filtro de producto no permitido: '+key);
        if(value===null||value===undefined||value==='')continue;
        const str=String(value);
        if(str.length>100)throw Error('Filtro demasiado largo');
        if(key.endsWith('_id')||key.startsWith('id_')){
          if(!/^[1-9][0-9]*$/.test(str))throw Error('ID de filtro inválido');
        }
        q.set(key,str);
      }
      return send('/productos/buscador?'+q.toString());
    },
    supplierMix: (page=1,buscar='')=>send('/proveedores/mix?'+
      new URLSearchParams({page:String(page),por_pagina:'25',buscar:String(buscar).slice(0,120)})),
    resources: (recurso, pagina = 1, buscar = '', perPage=25) => {
      if (!RESOURCES.has(recurso)) throw new Error('Recurso remoto no permitido.');
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000 ||
        !Number.isSafeInteger(perPage)||perPage<1||perPage>100)throw new Error('Paginación inválida.');
      if(typeof buscar!=='string'||buscar.length>120)throw Error('Búsqueda inválida');
      const query=new URLSearchParams({por_pagina:String(perPage),page:String(pagina)});
      if(buscar.trim()&&['clientes','proveedores'].includes(recurso))query.set('buscar',buscar.trim());
      return send('/recursos/'+encodeURIComponent(recurso)+'?'+query.toString());
    },
    customerLegalTypes: () => send('/clientes/tipos-juridicos'),
    customers: ({page=1,buscar='',filters={},orden='id',direccion_orden='desc',perPage=25}={})=>{
      if(!Number.isSafeInteger(page)||page<1||page>10000||
         !Number.isSafeInteger(perPage)||perPage<1||perPage>100)throw Error('Paginación de clientes inválida');
      const allowed=new Set(['rut','nombre','direccion','ciudad','correo_electronico',
        'giro','tipo_juridico_id','lista_precio_id','activo']);
      const sorts=new Set(['id','rut','nombre','direccion','ciudad','correo_electronico',
        'tipo_juridico_nombre','lista_precio_nombre']);
      if(!sorts.has(orden)||!['asc','desc'].includes(direccion_orden))throw Error('Orden inválido');
      if(String(buscar).length>120)throw Error('Búsqueda demasiado larga');
      const query=new URLSearchParams({page:String(page),por_pagina:String(perPage),
        buscar:String(buscar).trim(),orden,direccion_orden});
      for(const [key,value] of Object.entries(filters||{})){
        if(!allowed.has(key))throw Error('Filtro no permitido: '+key);
        if(value===null||value===undefined||String(value)==='')continue;
        const v=String(value).trim();
        if(v.length>190)throw Error('Filtro demasiado largo');
        if(['tipo_juridico_id','lista_precio_id'].includes(key)&&!/^[1-9][0-9]*$/.test(v))
          throw Error('Identificador inválido');
        if(key==='activo'&&!['0','1'].includes(v))throw Error('Estado inválido');
        query.set('filtros['+key+']',v);
      }
      return send('/recursos/clientes?'+query.toString());
    },
    createResource: (recurso,datos) => {
      if (!MANAGEABLE.has(recurso)) throw new Error('La escritura no está permitida para esta entidad.');
      return send('/recursos/'+recurso,'POST',datos);
    },
    updateResource: (recurso,identificador,datos) => {
      if (!MANAGEABLE.has(recurso)) throw new Error('La escritura no está permitida para esta entidad.');
      return send('/recursos/'+recurso+'/'+id(identificador),'PUT',datos);
    },
    deactivateResource: (recurso,identificador) => {
      if (!MANAGEABLE.has(recurso)) throw new Error('La escritura no está permitida para esta entidad.');
      return send('/recursos/'+recurso+'/'+id(identificador),'DELETE');
    },
    list: (catalogo) => send('/catalogos/' + key(catalogo)),
    create: (catalogo, datos) => send('/catalogos/' + key(catalogo), 'POST', datos),
    update: (catalogo, identificador, datos) =>
      send('/catalogos/' + key(catalogo) + '/' + id(identificador), 'PUT', datos),
    remove: (catalogo, identificador) =>
      send('/catalogos/' + key(catalogo) + '/' + id(identificador), 'DELETE'),
    createSale: data => send('/ventas','POST',data),
    // Los selectores heredados conservan hasta 100 opciones; el mantenedor
    // solicita explícitamente páginas de 25 para recorrer TODAS las listas.
    priceLists: (buscar='',activo=null,page=1,perPage=100) => {
      if(!Number.isSafeInteger(page)||page<1||page>10000||
         !Number.isSafeInteger(perPage)||perPage<1||perPage>100)
        throw Error('Paginación de listas inválida');
      const q=new URLSearchParams({por_pagina:String(perPage),page:String(page)});
      if(buscar)q.set('buscar',String(buscar).slice(0,120));
      if(activo!==null)q.set('activo',activo?'1':'0');
      return send('/listas-precios?'+q);
    },
    createPriceList: data => send('/listas-precios','POST',data),
    updatePriceList: (listId,data) => send('/listas-precios/'+id(listId),'PUT',data),
    deactivatePriceList: listId => send('/listas-precios/'+id(listId),'DELETE'),
    productPriceLists: productId => send('/productos/'+id(productId)+'/precios'),
    saveProductPrice: (productId,listId,data) =>
      send('/productos/'+id(productId)+'/precios/'+id(listId),'PUT',data),
    removeProductPrice: (productId,listId) =>
      send('/productos/'+id(productId)+'/precios/'+id(listId),'DELETE'),
    customerPriceList: customerId => send('/clientes/'+id(customerId)+'/lista-precio'),
    assignCustomerPriceList: (customerId,listId) =>
      send('/clientes/'+id(customerId)+'/lista-precio','PUT',{lista_precio_id:Number(id(listId))}),
    saleCustomers: (buscar='',page=1) =>
      send('/ventas/clientes-disponibles?'+new URLSearchParams({
        buscar:String(buscar).slice(0,120),page:String(page)
      })),
    saleProducts: (customerId,buscar='',page=1) =>
      send('/ventas/productos-disponibles?'+new URLSearchParams({
        cliente_id:id(customerId),buscar:String(buscar).slice(0,120),page:String(page)
      })),
    customerSalePrice: (customerId,productId) =>
      send('/ventas/precio-cliente?'+new URLSearchParams({
        cliente_id:id(customerId),producto_id:id(productId)
      })),
    products: (page=1, buscar='', filters={},sort={}) => {
      if(!Number.isSafeInteger(page)||page<1||page>10000)throw new Error('Página inválida');
      if(typeof buscar!=='string'||buscar.length>120)throw new Error('Búsqueda inválida');
      if(!filters||typeof filters!=='object'||Array.isArray(filters))throw new Error('Filtros inválidos');
      const allowed=new Set([
        'sku','nombre','descripcion','codigo_barras','activo','proveedor_id',
        'rubro_id','departamento_id','familia_id','linea_id','marca_id','modelo_id',
        'tipo_unidad_id','tipo_envasado_id','condicion_tributaria_id',
        'tipo_codigo_barra_id','precio_min','precio_max','iva','presentacion',
        'unidades_min','unidades_max'
      ]);
      const integerKeys=new Set([
        'proveedor_id','rubro_id','departamento_id','familia_id','linea_id',
        'marca_id','modelo_id','tipo_unidad_id','tipo_envasado_id',
        'condicion_tributaria_id','tipo_codigo_barra_id'
      ]);
      const numericKeys=new Set(['precio_min','precio_max','iva','unidades_min','unidades_max']);
      const query=new URLSearchParams({por_pagina:'25',page:String(page),incluye_inactivos:'1'});
      if(buscar.trim())query.set('buscar',buscar.trim());
      for(const [key,val] of Object.entries(filters)){
        if(!allowed.has(key))throw new Error('Filtro de productos no permitido');
        const value=String(val??'').trim();
        if(!value)continue;
        if(integerKeys.has(key)&&(!/^[1-9][0-9]*$/.test(value)||!Number.isSafeInteger(Number(value))))
          throw new Error('Identificador de filtro inválido');
        if(numericKeys.has(key)&&(!/^\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value))))
          throw new Error('Rango numérico inválido');
        if(key==='activo'&&value!=='0'&&value!=='1')throw new Error('Estado de filtro inválido');
        if(value.length>200)throw new Error('Filtro demasiado largo');
        query.set(key,value);
      }
      if(sort&&sort.key){
        if(!['sku','nombre','rubro','departamento','familia','linea','marca','modelo','activo','precios','codigos']
          .includes(sort.key))throw Error('Columna de ordenación inválida');
        if(!['asc','desc'].includes(sort.direction))throw Error('Dirección de ordenación inválida');
        query.set('orden',sort.key);query.set('direccion',sort.direction);
      }
      return send('/productos?'+query.toString());
    },
    documentTypes: ({page=1,buscar='',familia='',activo=''}={})=>{
      const query=new URLSearchParams({page:String(page),buscar:String(buscar).slice(0,120)});
      if(familia)query.set('familia',familia);
      if(activo!==''&&activo!==null)query.set('activo',String(activo));
      return send('/tipos-documentos?'+query.toString());
    },
    documentType: documentId=>send('/tipos-documentos/'+id(documentId)),
    createDocumentType: data=>send('/tipos-documentos','POST',data),
    updateDocumentType: (documentId,data)=>
      send('/tipos-documentos/'+id(documentId),'PUT',data),
    setDocumentTypeActive: (documentId,activo)=>
      send('/tipos-documentos/'+id(documentId)+'/estado','PATCH',{activo:Number(activo)}),
    orderStates: ()=>send('/ordenes-compra/estados'),
    orderSuppliers: (page=1,buscar='')=>send('/ordenes-compra/proveedores?'+
      new URLSearchParams({page:String(page),buscar:String(buscar).slice(0,120)})),
    purchaseOrders: ({page=1,buscar='',estadoId=null,proveedorId=null}={})=>{
      const q=new URLSearchParams({page:String(page),por_pagina:'25',
        buscar:String(buscar).slice(0,120)});
      if(estadoId)q.set('estado_id',id(estadoId));
      if(proveedorId)q.set('proveedor_id',id(proveedorId));
      return send('/ordenes-compra?'+q.toString());
    },
    getPurchaseOrder: orderId=>send('/ordenes-compra/'+id(orderId)),
    purchaseProductCosts: data=>send('/ordenes-compra/costos-productos','POST',data),
    calculatePurchaseOrder: data=>send('/ordenes-compra/calcular','POST',data),
    createPurchaseOrder: data=>send('/ordenes-compra','POST',data),
    updatePurchaseOrder: (orderId,data)=>
      send('/ordenes-compra/'+id(orderId),'PUT',data),
    cancelPurchaseOrder: orderId=>send('/ordenes-compra/'+id(orderId)+'/anular','POST'),
    resendPurchaseOrder: orderId=>send('/ordenes-compra/'+id(orderId)+'/reenviar','POST'),
    purchaseOrderPdf: orderId=>pdfOrden(orderId),
    productPhotos: productId => send('/productos/'+id(productId)+'/fotos'),
    productPhotoBlob: (productId,photoId) =>
      sendBinary('/productos/'+id(productId)+'/fotos/'+id(photoId)),
    uploadProductPhotos: (productId,files) => {
      if(!Array.isArray(files)||files.length<1||files.length>6)throw Error('Selecciona de 1 a 6 fotos');
      const form=new FormData();
      files.forEach(file=>{
        if(!(file instanceof File)||file.size<1||file.size>2097152||
           !['image/jpeg','image/png','image/webp'].includes(file.type))
          throw Error('Solo imágenes JPG, PNG o WebP de hasta 2 MB.');
        form.append('fotos[]',file,file.name);
      });
      return sendBinary('/productos/'+id(productId)+'/fotos','POST',form);
    },
    deleteProductPhoto: (productId,photoId) =>
      send('/productos/'+id(productId)+'/fotos/'+id(photoId),'DELETE'),
    getProduct: (identificador) => send('/productos/'+id(identificador)),
    createProduct: datos => send('/productos','POST',datos),
    updateProduct: (identificador,datos) => send('/productos/'+id(identificador),'PUT',datos),
    deactivateProduct: identificador => send('/productos/'+id(identificador),'DELETE'),
    productSuppliers: (page=1,filters={}) => {
      if(!Number.isSafeInteger(page)||page<1)throw new Error('Página inválida');
      const query=new URLSearchParams({page:String(page),por_pagina:'25',incluye_inactivos:'1'});
      if(filters.proveedor_id)query.set('proveedor_id',id(filters.proveedor_id));
      if(filters.producto_id)query.set('producto_id',id(filters.producto_id));
      if(filters.buscar)query.set('buscar',String(filters.buscar).slice(0,120));
      return send('/proveedores-productos?'+query.toString());
    },
    createProductSupplier: data => send('/proveedores-productos','POST',data),
    createProductSuppliersBatch: data => send('/proveedores-productos/lote','POST',data),
    updateProductSupplier: (identificador,data) => send('/proveedores-productos/'+id(identificador),'PUT',data),
    deactivateProductSupplier: identificador => send('/proveedores-productos/'+id(identificador),'DELETE'),
    saleBarcodes: productId => send('/productos/'+id(productId)+'/codigos-venta'),
    createSaleBarcode: (productId,data) => send('/productos/'+id(productId)+'/codigos-venta','POST',data),
    updateSaleBarcode: (productId,barcodeId,data) =>
      send('/productos/'+id(productId)+'/codigos-venta/'+id(barcodeId),'PUT',data),
    deactivateSaleBarcode: (productId,barcodeId) =>
      send('/productos/'+id(productId)+'/codigos-venta/'+id(barcodeId),'DELETE'),
    purchaseBarcodes: linkId => send('/proveedores-productos/'+id(linkId)+'/codigos-compra'),
    createPurchaseBarcode: (linkId,data) =>
      send('/proveedores-productos/'+id(linkId)+'/codigos-compra','POST',data),
    updatePurchaseBarcode: (linkId,barcodeId,data) =>
      send('/proveedores-productos/'+id(linkId)+'/codigos-compra/'+id(barcodeId),'PUT',data),
    deactivatePurchaseBarcode: (linkId,barcodeId) =>
      send('/proveedores-productos/'+id(linkId)+'/codigos-compra/'+id(barcodeId),'DELETE'),
    getProductClassification: (identificador) =>
      send('/productos/' + id(identificador) + '/clasificacion'),
    classifyProduct: (identificador, datos) => {
      if (!datos || FIELDS.some(k=>!Number.isSafeInteger(Number(datos[k])) || Number(datos[k]) < 1)) {
        throw new Error('Clasificación incompleta.');
      }
      const request = Object.fromEntries(FIELDS.map(k=>[k,Number(datos[k])]));
      return send('/productos/' + id(identificador) + '/clasificacion','PATCH',request);
    }
  });
  window.RutaHDApiCatalogos = api;
})();
