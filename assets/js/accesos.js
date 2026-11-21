/* Visibilidad según rol autenticado. Laravel valida siempre los permisos.
 * Sin JWT no hay acceso y ningún secreto se persiste en el navegador.
 */
(() => {
  'use strict';
  const catalogos = [
    'rubros','departamentos','familias','lineas','marcas','modelos',
    'tipos_unidad','gramajes','tipos_envasado','condiciones_tributarias'
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
      nombre: String(usuario.nombre || 'Usuario'),
      rol: usuario.rol,
      permisos: new Set(usuario.permisos.filter(v => typeof v === 'string'))
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
    canViewCatalog, canManageCatalog,
    usuario: () => sesion && {nombre:sesion.nombre,rol:sesion.rol}
  });
})();
