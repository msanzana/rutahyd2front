# Integración de catálogos Ruta H&D2

El frontend actual utiliza `localStorage`. Este incremento incorpora **solamente** el cliente `assets/js/catalogos-api.js` para la API autenticada desarrollada en el backend, PR #4: https://github.com/msanzana/rutahyd2/pull/4.

El archivo **no está referenciado por `index.html`**. Esto es deliberado: la URL efectiva de la API, su configuración TLS/CORS, el acceso del usuario y las migraciones 13/14 aún no han sido confirmados en InfinityFree.

## Contrato listo
`configure(apiOrigin)`, `authenticate(token)`, `signOut()`, `list(catalogo)`, `create(catalogo,datos)`, `update(catalogo,id,datos)`, `remove(catalogo,id)` y `classifyProduct(id,datos)`.

Se rechazan catálogos desconocidos e IDs inválidos. El token no se guarda en `localStorage` ni se escribe en archivos. Solo se permiten HTTPS y HTTP local para desarrollo.

## Paso siguiente, aún pendiente
Una vez desplegada y verificada la API, conectar eventos de `assets/js/catalogos.js` a este cliente, sustituir el CRUD local **solo en modo autenticado** y adaptar el formulario de productos a IDs enteros MySQL. Mantener la demostración separada, sin migrar identificadores `cat-...` a la fuerza.

No publicar ni activar esta integración mientras el backend tenga `.htaccess` de denegación o no exista autenticación y migración verificada.
