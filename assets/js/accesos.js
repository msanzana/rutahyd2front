/* Visibilidad según rol autenticado. Laravel valida siempre los permisos.
 * Sin JWT no hay acceso y ningún secreto se persiste en el navegador.
 */
(() => {
  'use strict';
  const catalogos = [
    'rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','tipos_envasado','condiciones_tributarias','tipos_codigos_barras'
  ];
  let sesion = null;
  function actualizar() {
    document.dispatchEvent(new CustomEvent('rutahd:permisos-actualizados'));
  }
  function setSession(usuario) {
    if (!usuario || !Array.isArray(usuario.permisos) || typeof usuario.rol !== 'string') {
      throw new Error('La API no devolvió el perfil con sus permisos; se niega el acceso.');
    }
    sesion = {
      id: Number.isSafeInteger(Number(usuario.id))&&Number(usuario.id)>0?Number(usuario.id):null,
      nombre: String(usuario.nombre || 'Usuario'),
      rol: usuario.rol,
      permisos: new Set(usuario.permisos.filter(v => typeof v === 'string')),
      submodulos: usuario.submodulos&&typeof usuario.submodulos==='object'?usuario.submodulos:null,
      tema_interfaz: ['claro','oscuro'].includes(usuario.tema_interfaz)?usuario.tema_interfaz:null
    };
    actualizar();
  }
  function clear() { sesion = null; actualizar(); }
  const authenticated = () => sesion !== null;
  const isAdmin = () => sesion?.rol === 'administrador';
  function has(code) {
    // Sin JWT no existe autorización, ni siquiera de lectura.
    if (!sesion) return false;
    return isAdmin() || sesion.permisos.has(code);
  }
  function canSeeSubmodule(key,action='ver') {
    if(!sesion)return false;
    if(isAdmin())return true;
    const grant=sesion.submodulos?.[key];
    if(grant&&typeof grant==='object')return Boolean(grant[action]);
    // Compatibilidad: mientras DDL23 no esté aplicado, solo rige el permiso general.
    const base={
      'productos.listado':'productos.gestionar',
      'proveedores.listado':'compras.gestionar',
      'proveedores.productos':'compras.gestionar'
    };
    return base[key]?has(base[key]):false;
  }
  function canViewCatalog(key) {
    if (!catalogos.includes(key)) return false;
    return has('productos.catalogos.' + key + '.ver') ||
      has('productos.catalogos.' + key + '.gestionar');
  }
  function canManageCatalog(key) {
    return catalogos.includes(key) && has('productos.catalogos.' + key + '.gestionar');
  }
  window.RutaHDAccesos = Object.freeze({
    catalogos, setSession, clear, authenticated, isAdmin, has,
    canViewCatalog, canManageCatalog, canSeeSubmodule,
    usuario: () => sesion && {id:sesion.id,nombre:sesion.nombre,rol:sesion.rol,tema_interfaz:sesion.tema_interfaz}
  });
})();
