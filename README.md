# Ruta H&D2 — Frontend (espectro violeta)

Base visual del frontend de **Ruta H&D2**. Este repositorio estaba vacío el 19 de noviembre de 2026; se creó una base visual inicial porque el alojamiento `rutahyd2.free.nf` todavía mostraba la página predeterminada de InfinityFree.

## Paleta violeta
La hoja `assets/css/theme-violet.css` es la **fuente única de colores**. Incluye la escala `--violet-50` a `--violet-950` y variables semánticas para encabezados, botones, fondos, bordes, estados y foco.

| Uso | Valor |
| --- | --- |
| Primario | `#6D28D9` |
| Hover / selección | `#5B21B6` |
| Violeta profundo | `#2E1065` |
| Lila claro | `#F5F3FF` |
| Texto principal | `#211438` |
| Fondo | `#FAF8FF` |

## Vista previa local
Abrir `index.html` en el navegador. No requiere NPM, servidores, APIs ni servicios de pago.

La vista muestra los módulos de RutaH&D2 como **prototipo visual**: no inventa cifras de ventas ni se conecta todavía a la API. El archivo `index.html` carga el tema desde `assets/css/theme-violet.css`.

## Estado y seguridad
- No se ha reemplazado ningún frontend preexistente: el repositorio estaba vacío.
- No se ha realizado un despliegue a InfinityFree con estos archivos.
- No contiene contraseñas, tokens ni credenciales de base de datos.
- La API Laravel V2 está en otra rama/repositorio y su activación se controla por separado.
- Para aplicar a una interfaz futura, importar el CSS y utilizar variables semánticas como `var(--action-primary)`, `var(--surface)`, `var(--text-primary)`.

## Archivos
- `index.html`: vista inicial de estilo violeta.
- `assets/css/theme-violet.css`: sistema de diseño reutilizable.
