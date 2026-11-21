# Ruta H&D V2 — Frontend exclusivo de producción

Frontend oficial de Comercializadora H&D: **https://rutahyd2.free.nf/**

## Arquitectura vigente (21-11-2026)

- La portada carga `assets/js/login-produccion.js`, `assets/js/app-produccion.js`, `assets/js/catalogos-api.js` y los adaptadores remotos de módulos.
- **No existe modo demostrativo en la interfaz publicada.** Los archivos históricos `app.js` y `catalogos.js` quedan como legado no cargado; nunca deben reintroducirse en el HTML productivo ni publicarse como alternativa de uso.
- El navegador no conserva JWT, contraseñas ni registros operativos en `localStorage`: la sesión Bearer solo vive en memoria. Las cookies técnicas de InfinityFree se limitan al mismo origen.
- Menú oficial y orden: **Administración, Compras, Ventas, Proveedores, Clientes, Productos, Bodega, Cuentas corrientes**. Inicio se abre desde el logo.
- Catálogos de Productos y Administración: Rubros → Departamentos → Familias → Líneas; Marcas → Modelos; Tipos de unidad, Gramajes, Tipos de envasado y Condiciones tributarias.
- Producto, catálogos, usuarios y permisos utilizan contratos API JWT. Los módulos Compras, Ventas, Proveedores, Clientes y Bodega consultan la API en modo lectura. Cuentas corrientes aún carece de contrato de backend y muestra una advertencia, nunca saldos inventados.

## Conexión real y estado

Frontend: `GET /api/v1/estado` → `POST /api/v1/sesion` → Bearer JWT → recursos y CRUD autorizados por Laravel → MariaDB.

**No confundir conexión implementada con login activado.** La auditoría de 21-11-2026 confirma que Laravel interno se conecta a la base productiva (46 tablas, 5 roles, 1 administrador activo), pero que el gateway público seguía en **HTTP 503 / no_habilitada**, sin marcador privado de activación. No se enviarán credenciales si ese estado no cambia. La auditoría de ese momento también detectó que la configuración SMTP no estaba activa en el `.env` examinado, aunque el titular ha informado que puede recibir mensajes desde el backend. Esta diferencia requiere verificación antes de activar el gateway.

Auditoría de backend: https://github.com/msanzana/rutahyd2/actions/runs/44959577317

## Producción y validaciones

```bash
npm install
npx playwright install chromium
npx playwright test tests/produccion-sin-demo.spec.mjs
```

- El workflow `.github/workflows/produccion-sin-demo-v2-ci.yml` ahora **valida la rama `main`**; comprueba login obligatorio, menú oficial, aislamiento de datos y ausencia de entradas a la demo.
- La antigua suite de demostración `.github/workflows/verificar-tema.yml` se conserva solo para ejecución manual, fuera del flujo automático de `main`.
- El despliegue productivo se gestiona desde `msanzana/rutahyd2`, workflow `publicar-produccion-sin-demo-20261121.yml`: toma este repositorio `main`, respalda y verifica la publicación FTPS, protege el backend y conserva el PNG oficial de `/hd-branding`.
- La apertura del gateway, el alta/validación de credenciales y las pruebas JWT reales son un paso operativo **separado**. Nunca marcar como terminado el login productivo basándose solo en CI con APIs simuladas.

## Regla de base de datos

Cualquier cambio de **estructura** se prepara y entrega como script SQL **DDL**, no como migración Laravel ni automatización Firecrawl. La ejecución y su resultado se documentan por separado. No subir `.env`, claves, hashes de usuarios, contraseñas ni tokens.

Diario oficial: https://github.com/msanzana/rutahyd2/blob/main/docs/DIARIO_CONTINUIDAD_2026-11-21.md
