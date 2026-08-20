# Funcionalidades actuales

Este documento describe el alcance funcional actual de Nexus Studio según la implementación disponible. Las funcionalidades marcadas como parciales tienen interfaz o contratos iniciales, pero todavía no completan el flujo de extremo a extremo.

## Resumen

Nexus Studio es una aplicación de escritorio para guardar conexiones de bases de datos, explorar su estructura, consultar datos mediante SQL y administrar preferencias básicas del espacio de trabajo.

## Pantallas y navegación

| Pantalla | Funcionalidad |
| --- | --- |
| `/` | Dashboard con la lista de conexiones guardadas |
| `/connections/:connectionId` | Workspace de una conexión, con explorador, datos y consultas |
| `/settings` | Configuración de apariencia y preferencias del workspace |

La ruta implementada para el workspace es `/connections/:connectionId`. La ruta `/workspace/:connectionId` que aparece en `docs/PLAN.md` corresponde al diseño planificado, no a la implementación actual.

## Dashboard de conexiones

- Lista de perfiles de conexión persistidos localmente.
- Creación de una conexión mediante un modal.
- Edición de conexiones existentes.
- Eliminación con confirmación.
- Prueba de conexión antes de guardar o abrir un perfil.
- Apertura de una conexión desde su tarjeta.
- Búsqueda por nombre, motor, metadata, SSH y SSL.
- Orden por nombre o última apertura.
- Actualización manual de la lista.
- Registro de la última apertura de cada conexión.
- Copia de la connection string desde una tarjeta cuando está disponible.
- Notificaciones de carga, éxito y error.

## Motores soportados

- PostgreSQL.
- MySQL.
- SQLite.
- Prueba de conexión usando el backend Rust y `sqlx`.
- Selección de un archivo SQLite mediante el selector nativo del sistema.

En SQLite, el archivo debe existir o crearse explícitamente mediante el selector. La conexión no crea automáticamente un archivo inexistente.

## Configuración de conexiones

El formulario actual permite configurar:

- Nombre de la conexión.
- Motor de base de datos.
- Host.
- Puerto.
- Usuario.
- Contraseña.
- Base de datos.
- Archivo SQLite.
- Datos visuales básicos de la conexión.

### Funcionalidades parciales

- Existen campos y tipos previstos para connection strings, SSL y SSH, pero no todos están conectados al estado final del formulario.
- Los datos de SSL se muestran en la interfaz, pero todavía no se envían al backend.
- Los datos de SSH se muestran parcialmente, pero no existe todavía un túnel SSH funcional.
- Las contraseñas se persisten dentro del perfil actual; la integración con el keyring del sistema todavía no está completada.

## Workspace de base de datos

### Explorador lateral

- Selector de base de datos para PostgreSQL y MySQL.
- Exploración de tablas.
- Exploración de vistas.
- Exploración de funciones.
- Exploración de procedimientos almacenados.
- Búsqueda dentro del explorador.
- Actualización manual del explorador.
- Grupos expandibles por tipo de objeto.
- Cambio entre conexiones recientes.
- Edición de la conexión actual.
- Ocultación y visualización del sidebar.

SQLite expone actualmente tablas y vistas. Secuencias, índices, triggers, extensiones y otros objetos todavía no forman parte del explorador completo.

### Editor SQL

- Editor basado en CodeMirror.
- Resaltado de sintaxis SQL.
- Múltiples pestañas de consulta.
- Creación y cierre de pestañas.
- Indicador de cambios no guardados.
- Confirmación antes de cerrar una pestaña modificada.
- Ejecución de la sentencia ubicada bajo el cursor.
- Detección de sentencias considerando strings, comentarios y bloques dollar-quoted.
- Panel de resultados tabulares.
- Mensajes de error de ejecución.
- Resultados de comandos sin columnas, incluyendo filas afectadas y duración.
- Apertura de definiciones de funciones y procedimientos en pestañas SQL.
- Distinción de rutinas sobrecargadas mediante su firma.
- Invalidación del caché de objetos después de crear una tabla.
- Invalidación del caché de bases después de crear una base de datos.

### Datos y estructura de tablas

- Carga paginada de datos.
- Límite de hasta 100 filas por carga desde el backend.
- Columnas dinámicas según la tabla consultada.
- Indicador de filas cargadas y filas visibles.
- Vista de estructura de la tabla.
- Lectura de nombre, tipo, nullable y default de las columnas.
- Indicadores locales de nullable y primary key.
- Edición local de default y comment.
- Reintento cuando falla la carga de datos.
- Creación de una fila draft local.
- Representación visual de booleanos y enums en la fila draft.

### Limitaciones actuales del workspace

- La edición de estructura es solamente local y no ejecuta cambios DDL en la base.
- `Add row` crea un draft local, pero todavía no ejecuta un `INSERT`.
- Los controles para refrescar o agregar estructura todavía están deshabilitados.
- El contador de datos representa las filas cargadas en la página actual, no un `COUNT(*)` total real.
- No están implementados todavía filtros, ordenamiento, edición persistida ni cancelación de consultas largas.

## Settings y apariencia

- Tema claro.
- Tema oscuro.
- Persistencia del tema elegido.
- Persistencia del estado del sidebar.
- Secciones de configuración de Appearance y Workspace.
- Tema `System` visible, pero deshabilitado.
- Barra de título personalizada.
- Controles nativos de ventana para minimizar, maximizar y cerrar.
- Navegación hacia Settings desde la barra de título.
- Diseño responsive para el sidebar de Settings.

## Atajos de teclado

| Atajo | Acción |
| --- | --- |
| `Ctrl+B` | Alternar el sidebar |
| `Ctrl/Cmd+Enter` | Ejecutar la consulta activa |
| `Ctrl/Cmd+T` | Crear una pestaña SQL |
| `Ctrl/Cmd+W` | Cerrar pestañas |
| `Ctrl/Cmd+Tab` | Ir a la siguiente pestaña |
| `Ctrl/Cmd+Shift+Tab` | Ir a la pestaña anterior |

La documentación de `docs/keymaps.md` describe una arquitectura contextual y extensible para los atajos. La implementación actual utiliza handlers concretos y todavía no cuenta con un registry general de comandos y contextos.

## Funcionalidades todavía no implementadas

Estas capacidades aparecen en el plan del producto, pero no forman parte del alcance funcional actual:

- Túneles SSH manuales o mediante aliases de `~/.ssh/config`.
- Autenticación SSH por contraseña o archivo de clave.
- Verificación de host keys SSH.
- Persistencia segura de secretos mediante el keyring del sistema.
- Pools de conexiones persistentes.
- Pestaña Rules.
- Índices, foreign keys, constraints, triggers y políticas RLS completas.
- Historial de queries guardadas.
- Cancelación de consultas largas.
- Cache completo por conexión y base de datos.
- Diagrama ER.
- Edición inline persistida de datos.
- Filtros y sorting de datos.
- Tema automático del sistema.

## Referencias

- [Plan del producto](./PLAN.md)
- [Arquitectura de atajos](./keymaps.md)
