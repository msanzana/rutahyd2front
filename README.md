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
