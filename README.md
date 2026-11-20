# Ruta H&D2 — Frontend violeta

**Sitio de comercializadora H&D**, versión visual funcional de demostración.

## Interfaz implementada
- Pantalla de inicio corporativa con paleta violeta, logotipo circular H&D, indicadores locales, módulos y actividad.
- Menú responsive: inicio, pedidos, clientes, productos, inventario, informes y administración.
- CRUD de demostración: formularios con validación, altas, vistas de detalle, ediciones y eliminaciones con confirmación.
- Avisos (toast) de éxito, error, advertencia e información.
- Inventario derivado del catálogo, alertas de stock bajo, búsqueda y exportación CSV de pedidos/clientes/productos.
- Informes con gráfica de pedidos según los datos realmente creados en el navegador.
- Sin cifras inventadas de producción. El almacenamiento se realiza **exclusivamente en localStorage**. No se debe ingresar información personal real en esta demo.

## Integración del backend
**El backend Laravel V2 NO está activado aún.** Los archivos se transfirieron en staging protegido mediante FTPS, pero falta `.env` privado, conexión real MySQL, autenticación, tabla `tokens_acceso`, alta de administrador y prueba HTTPS. Esta interfaz **no invoca** todavía API real ni escribe en MySQL.

La conexión final debe implementar login autenticado y un adaptador seguro para los recursos del backend; nunca publicar secretos, tokens ni rutas internas sin controles.

## Desarrollo
Abrir `index.html` directamente o ejecutar un servidor estático para la demostración:
```bash
python3 -m http.server 4173
```
Para ejecutar pruebas con Chromium:
```bash
npm install
npx playwright install chromium
npm test
```
El workflow `.github/workflows/verificar-tema.yml` ejecuta pruebas de navegación, CRUD y responsividad.

## Archivos principales
- `index.html` — shell accesible y cuadros de diálogo.
- `assets/css/app.css` — sistema visual violeta responsive.
- `assets/js/app.js` — lógica interactiva local, sin dependencias de pago.
- `assets/img/prueba-rutahd2.webp` — logo circular H&D sobre fondo exterior transparente, derivado del archivo de Ruta H&D V1.
- `tests/frontend-violeta.spec.mjs` — pruebas de extremo a extremo con Playwright.

## Publicación
GitHub Actions despliega el frontend estático por FTPS. Se transfieren solo HTML, CSS, JS y logo, no carpetas de desarrollo ni datos sensibles. La carpeta Laravel `/htdocs/api-v2` permanece separada y protegida.

**No subir un `.env` o credenciales de la base en este repositorio.**


## Integración JWT V2 — actualización de noviembre 2026
La versión actual conserva los siete padres originales: Inicio, Pedidos, Clientes, Productos, Inventario, Informes y Administración. Debajo de Productos están las diez clasificaciones; debajo de Administración está Perfiles y permisos.

La interfaz de catálogos admite **dos modos separados**:
- **Demostración local**, sin cuenta real y con datos de `localStorage`. No equivale a información de la empresa ni autoriza uso de MySQL.
- **Catálogos autenticados**, usando `assets/js/catalogos-api.js`: inicio de sesión Laravel en `/api/v1/sesion`, JWT HS256 tipo Bearer, token solo en memoria, permisos de lectura/escritura por rol y revocación con `DELETE /api/v1/sesion`. Cada acción autenticada se valida en backend.

**No se deben confundir:** los demás CRUD del prototipo (Pedidos/Clientes/Inventario/Informes) aún no están integrados al backend productivo. El backend Laravel está protegido y el gateway `/api` devuelve estado no habilitado hasta instalar las migraciones y la configuración privada correctas.

Prueba de integración completa con navegador, Laravel y MySQL temporal: [GitHub Actions](https://github.com/msanzana/rutahyd2front/actions/runs/44749026047). No se accedió a MySQL de producción ni se usaron contraseñas de usuarios reales.

**Nunca publicar usuario/contraseña reales, hash ni secreto JWT en este repositorio.** Para preparar la instalación consultar `docs/JWT_ADMIN_PRODUCCION.md` del backend.
