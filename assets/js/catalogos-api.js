/* Ruta H&D2 — cliente API opcional para catálogos.
 * No se carga ni activa automáticamente en la demo actual.
 * El bearer token vive solo en memoria, jamás en localStorage.
 */
(() => {
  'use strict';
  const VALID = new Set([
    'rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','gramajes','tipos_envasado','condiciones_tributarias'
  ]);
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
    if (url.hostname !== window.location.hostname && !localDev) {
      throw new Error('Para proteger la sesión, la API debe estar alojada en el mismo dominio.');
    }
    endpoint = url.toString().replace(/\/$/,'').replace(/\/api\/v1$/,'') + '/api/v1';
  }

  function authenticate(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      throw new Error('Token de acceso inválido.');
    }
    bearer = token;
  }

  function signOut() { bearer = null; }
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
        credentials:'omit', cache:'no-store', signal:controller.signal
      });
    } finally { clearTimeout(timer); }
    if (!response.ok) throw new Error('No se pudo iniciar sesión (HTTP ' + response.status + ')');
    const data = await response.json();
    authenticate(data.token);
    return data.usuario;
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
        credentials:'omit',
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
    configure, authenticate, login, signOut,
    list: (catalogo) => send('/catalogos/' + key(catalogo)),
    create: (catalogo, datos) => send('/catalogos/' + key(catalogo), 'POST', datos),
    update: (catalogo, identificador, datos) =>
      send('/catalogos/' + key(catalogo) + '/' + id(identificador), 'PUT', datos),
    remove: (catalogo, identificador) =>
      send('/catalogos/' + key(catalogo) + '/' + id(identificador), 'DELETE'),
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
