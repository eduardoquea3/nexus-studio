# Tareas — Tabs, Command Bar y contexto por conexión

## 1. Corregir navegación de tabs con `Ctrl + Tab`

- Revisar el bug actual donde `Ctrl + Tab` se traba y deja de continuar el ciclo entre tabs.
- Implementar navegación cíclica entre los tabs abiertos.
- Hacer que `Ctrl + Tab` abra un **Command Bar / Tab Switcher**, similar al comportamiento de VS Code/Cursor.
- Mostrar dentro del Tab Switcher todos los tabs abiertos de la conexión actual.
- Mantener seleccionado inicialmente el siguiente tab respecto al tab activo.
- Permitir avanzar entre opciones manteniendo `Ctrl` y presionando repetidamente `Tab`.
- Permitir navegación inversa con `Ctrl + Shift + Tab`.
- Cambiar al tab seleccionado al soltar `Ctrl`.
- Permitir seleccionar un tab usando las flechas del teclado.
- Permitir confirmar la selección con `Enter`.
- Permitir cerrar el Command Bar con `Escape`.
- Asegurar que el keybind no entre en conflicto con inputs, editores u otros componentes que tengan contexto propio.

## 2. Crear Command Bar global con `Ctrl + P`

- Crear un Command Bar accesible mediante `Ctrl + P`.
- El Command Bar debe utilizar como contexto la **conexión de base de datos que actualmente tiene el foco**.
- Mostrar un campo de búsqueda al abrir el Command Bar.
- Permitir filtrar los resultados mientras el usuario escribe.
- Permitir navegación con `ArrowUp` y `ArrowDown`.
- Permitir ejecutar la opción seleccionada con `Enter`.
- Cerrar el Command Bar con `Escape`.

## 3. Listar tablas de la conexión activa

- Obtener las tablas disponibles de la base de datos asociada a la conexión activa.
- Mostrar las tablas dentro del Command Bar de `Ctrl + P`.
- Diferenciar visualmente los resultados de tipo **tabla**.
- Mostrar, cuando sea posible, información como:
  - nombre de la tabla;
  - schema;
  - tipo de objeto.
- Permitir buscar tablas por nombre.
- Al presionar `Enter` sobre una tabla, abrir un nuevo tab.
- El tab abierto debe mostrar la vista **DataTable** de esa tabla.
- Si la tabla ya está abierta en esa conexión, enfocar el tab existente en lugar de crear uno duplicado.

## 4. Listar conexiones disponibles

- Mostrar dentro del mismo Command Bar las conexiones configuradas.
- Diferenciar visualmente los resultados de tipo **conexión** de los resultados de tipo tabla.
- Mostrar información básica de cada conexión, por ejemplo:
  - nombre;
  - motor de base de datos;
  - base de datos;
  - host, cuando corresponda.
- Marcar claramente cuál es la conexión actualmente activa.
- Permitir buscar conexiones por nombre.

## 5. Cambiar de conexión desde el Command Bar

- Al presionar `Enter` sobre una conexión, intentar conectarse antes de cambiar el contexto activo.
- Mostrar un estado de carga mientras se prueba la conexión.
- Evitar ejecutar múltiples intentos simultáneos sobre la misma conexión.
- Si la conexión es válida:
  - cambiar la conexión activa;
  - restaurar su contexto;
  - actualizar el contenido dependiente de la conexión;
  - cerrar el Command Bar.
- Si la conexión falla:
  - mantener la conexión actual;
  - no modificar el contexto activo;
  - mostrar un toast con el error.
- El toast debe mostrar un mensaje entendible para el usuario y, si aplica, el detalle técnico del error.

## 6. Crear un contexto independiente por conexión

- Crear un estado independiente para cada conexión.
- Cada conexión debe mantener sus propios tabs abiertos.
- Cada conexión debe recordar cuál era su tab activo.
- Evitar que los tabs de una conexión aparezcan en otra conexión.
- Al cambiar de conexión, guardar el estado de la conexión anterior.
- Al volver a una conexión previamente utilizada, restaurar automáticamente su estado.

Ejemplo conceptual del estado:

```ts
type ConnectionWorkspace = {
  connectionId: string;
  activeTabId: string | null;
  tabs: Tab[];
};

type WorkspaceState = {
  activeConnectionId: string | null;
  connections: Record<string, ConnectionWorkspace>;
};

```

## 7. Persistir los tabs de cada conexión

- Persistir el contexto de cada conexión para que no se pierda al cerrar la aplicación.
- Guardar por conexión:
  - tabs abiertos;
  - tab activo;
  - tipo de cada tab;
  - tabla asociada;
  - query asociada, cuando corresponda;
  - metadata necesaria para reconstruir la vista.
- Restaurar los workspaces al iniciar la aplicación.
- Validar que las conexiones guardadas sigan existiendo antes de restaurarlas.
- Ignorar o limpiar tabs cuyo recurso ya no exista, por ejemplo una tabla eliminada.
- Actualizar la persistencia cuando:
  - se abra un tab;
  - se cierre un tab;
  - se cambie el tab activo;
  - se reordenen tabs;
  - se cambie de conexión.

## 8. Definir modelo de tabs

- Crear un modelo común para representar los diferentes tipos de tabs.
- Incluir un identificador único por tab.
- Asociar cada tab explícitamente con su `connectionId`.
- Definir inicialmente tipos como:
  - `datatable`;
  - `query`;
  - otros tipos existentes en la aplicación.
- Para tabs `datatable`, guardar:
  - `connectionId`;
  - `schema`;
  - `tableName`.
- Para tabs de query, conservar el contenido necesario para restaurarlos.

Ejemplo:

```ts
type Tab =
  | {
      id: string;
      type: "datatable";
      connectionId: string;
      schema?: string;
      tableName: string;
    }
  | {
      id: string;
      type: "query";
      connectionId: string;
      title: string;
      query: string;
    };

```

## 9. Manejo de foco y contexto de keybinds

- Centralizar la lógica de shortcuts.
- Definir claramente qué keybinds son globales y cuáles dependen del contexto.
- `Ctrl + P` debe funcionar a nivel global mientras exista una conexión activa.
- `Ctrl + Tab` debe operar únicamente sobre los tabs de la conexión activa.
- El Command Bar debe capturar temporalmente sus propios keybinds mientras esté abierto.
- Evitar que `Ctrl + P`, `Ctrl + Tab`, `Enter`, `Escape` o las flechas propaguen eventos a componentes que estén debajo del Command Bar.
- Restaurar correctamente el foco al cerrar el Command Bar.

## 10. Estados vacíos y casos especiales

- Si no hay ninguna conexión activa, `Ctrl + P` debe mostrar únicamente las conexiones disponibles.
- Si la conexión activa no tiene tablas, mostrar un estado vacío en la sección correspondiente.
- Si no existen tabs abiertos, `Ctrl + Tab` no debe abrir un selector vacío.
- Si solo existe un tab, `Ctrl + Tab` debe mantenerlo seleccionado sin producir comportamientos extraños.
- Manejar correctamente conexiones eliminadas mientras todavía existe información persistida sobre ellas.
- Manejar tablas renombradas o eliminadas.
- Evitar tabs duplicados de la misma DataTable dentro de una misma conexión.

## 11. UX del Command Bar

- Diseñar el componente para que pueda reutilizarse tanto para `Ctrl + Tab` como para `Ctrl + P`.
- Separar visualmente los grupos:
  - tablas;
  - conexiones;
  - tabs abiertos.
- Agregar iconos según el tipo de elemento.
- Resaltar el elemento seleccionado.
- Mostrar indicadores de acciones cuando sea útil.
- Mostrar el keybind asociado dentro del Command Bar.
- Mantener una experiencia similar a la Command Palette / Quick Open de VS Code y Cursor.

## 12. Pruebas

- Probar `Ctrl + Tab` con 1, 2 y múltiples tabs.
- Probar mantener `Ctrl` y pulsar varias veces `Tab`.
- Probar `Ctrl + Shift + Tab`.
- Probar cambio rápido entre varias conexiones.
- Verificar que cada conexión conserve sus propios tabs.
- Cerrar y volver a abrir la aplicación y comprobar que los tabs se restauran.
- Probar apertura de tablas desde `Ctrl + P`.
- Probar selección de una conexión válida.
- Probar selección de una conexión inválida.
- Verificar que una conexión inválida genere un toast y no cambie el contexto.
- Verificar que no se creen tabs duplicados.
- Probar los shortcuts teniendo foco en:
  - editor SQL;
  - DataTable;
  - sidebar;
  - inputs;
  - Command Bar.
