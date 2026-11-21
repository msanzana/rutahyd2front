/* Ruta H&D2: cliente API de catálogos con Bearer JWT.
 * Los tokens viven únicamente en memoria; jamás en localStorage.
 * Mantenemos cookies técnicas del MISMO ORIGEN para el desafío anti-bot de
 * InfinityFree; nunca usamos cookies como credencial JWT ni enviamos cookies CORS.
 * Sin JWT y API validada, solo funciona el modo demostración.
 */
(() => {
  'use strict';
  const VALID = new Set([
    'rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','gramajes','tipos_envasado','condiciones_tributarias'
  ]);
  const RESOURCES = new Set(['clientes','productos','ventas','notas_venta','bodegas','movimientos_inventario','proveedores']);
  const FIELDS = [
    'rubroId','departamentoId','familiaId','lineaId','marcaId','modeloId',
    'tipoUnidadId','gramajeId','tipoEnvasadoId','condicionTributariaId'
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
    if (!response.ok) throw new Error('No se pudo iniciar sesión (HTTP ' + response.status + ')');
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

  async function send(path, method = 'GET', body) {
    if (!endpoint || !bearer) throw new Error('La API requiere configuración y sesión autenticada.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(endpoint + path, {
        method,
        headers: {
          Authorization: 'Bearer ' + bearer,
          Accept: 'application/json',
          ...(body !== undefined ? {'Content-Type':'application/json'} : {})
        },
        ...(body !== undefined ? {body:JSON.stringify(body)} : {}),
        signal:controller.signal,
        credentials:'same-origin',
        cache:'no-store'
      });
    } finally { clearTimeout(timer); }
    if (!response.ok) {
      const error = new Error('Error HTTP ' + response.status);
      error.status = response.status;
      // No exponer respuestas de error de servidores no verificados ni tokens.
      throw error;
    }
    return response.status === 204 ? null : response.json();
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
    profile: () => send('/perfil'),
    roleCatalogPermissions: () => send('/perfiles/catalogos'),
    usersForProfiles: () => send('/perfiles/usuarios'),
    assignUserRole: (userId,roleId) =>
      send('/perfiles/usuarios/' + id(userId) + '/rol','PUT',{rol_id:Number(id(roleId))}),
    saveRoleCatalogPermissions: (roleId, modulos) =>
      send('/perfiles/' + id(roleId) + '/catalogos','PUT',{modulos}),
    resources: (recurso, pagina = 1) => {
      if (!RESOURCES.has(recurso)) throw new Error('Recurso remoto no permitido.');
      if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000) {
        throw new Error('Página inválida.');
      }
      return send('/recursos/' + encodeURIComponent(recurso) + '?por_pagina=25&page=' + pagina);
    },
    list: (catalogo) => send('/catalogos/' + key(catalogo)),
    create: (catalogo, datos) => send('/catalogos/' + key(catalogo), 'POST', datos),
    update: (catalogo, identificador, datos) =>
      send('/catalogos/' + key(catalogo) + '/' + id(identificador), 'PUT', datos),
    remove: (catalogo, identificador) =>
      send('/catalogos/' + key(catalogo) + '/' + id(identificador), 'DELETE'),
    products: (page=1, buscar='') => {
      if(!Number.isSafeInteger(page)||page<1||page>10000)throw new Error('Página inválida');
      if(typeof buscar!=='string'||buscar.length>120)throw new Error('Búsqueda inválida');
      return send('/productos?por_pagina=25&page='+page+'&incluye_inactivos=1&buscar='+encodeURIComponent(buscar));
    },
    getProduct: (identificador) => send('/productos/'+id(identificador)),
    createProduct: datos => send('/productos','POST',datos),
    updateProduct: (identificador,datos) => send('/productos/'+id(identificador),'PUT',datos),
    deactivateProduct: identificador => send('/productos/'+id(identificador),'DELETE'),
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
