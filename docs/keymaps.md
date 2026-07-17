# Keyboard Shortcut Architecture

## Objetivo

El sistema de atajos de teclado debe ser **contextual**, **predecible** y **extensible**.

Un atajo nunca debe depender únicamente de la combinación de teclas.

Cada keymap debe definirse mediante tres componentes:

- **Shortcut** (la combinación de teclas)
- **Command** (la acción a ejecutar)
- **Context** (cuándo está permitido ejecutarlo)

```
Shortcut + Context → Command
```

---

# Principios

## 1. Todo keymap requiere un contexto

❌ Incorrecto

```ts
Ctrl + C -> Copy
```

✅ Correcto

```ts
Ctrl + C
when editorFocused
-> Copy
```

Nunca se debe registrar un shortcut global si realmente pertenece a un contexto específico.

---

## 2. Los contextos son mutuamente exclusivos cuando sea posible

Evitar situaciones como:

```
Ctrl + Enter

editorFocused
terminalFocused
sidebarFocused
```

Debe existir un único contexto activo.

Correcto:

```
editorFocused

terminalFocused

sidebarFocused
```

Solo uno puede ser verdadero.

---

## 3. Los estados no son el foco

El foco indica **dónde** está interactuando el usuario.

Ejemplos:

```
editorFocused

terminalFocused

sidebarFocused

modalFocused
```

Los estados indican **qué está ocurriendo**.

Ejemplos:

```
suggestVisible

renameMode

selectionExists

recordingMacro

searchMode
```

No mezclar ambos conceptos.

---

# Tipos de Contextos

## Focus Context

Representa qué componente recibe el teclado.

Ejemplo:

```
Editor

Sidebar

Tree

Terminal

Command Palette

Modal

Dialog

Search
```

Solo uno debería estar activo.

---

## UI State Context

Representa estados temporales.

Ejemplo:

```
suggestVisible

findVisible

replaceVisible

renameVisible

commandPaletteVisible
```

Puede haber varios simultáneamente.

---

## Selection Context

Describe la selección actual.

Ejemplo:

```
hasSelection

multipleSelections

hasCursor

hasItemSelected
```

---

## Mode Context

Representa modos de funcionamiento.

Ejemplo:

```
normalMode

insertMode

visualMode

readonlyMode

presentationMode
```

Solo un modo principal debería estar activo.

---

## Resource Context

Depende del documento actual.

Ejemplo:

```
language == markdown

language == json

language == ts

resourceReadonly

resourceDirty
```

---

# Organización

Cada keymap debería pertenecer a un único módulo.

```
keymaps/

    editor.ts

    explorer.ts

    terminal.ts

    search.ts

    modal.ts

    global.ts
```

Nunca mezclar shortcuts de distintos módulos.

---

# Prioridad

El orden de resolución debe ser:

```
1. Modal

2. Popup

3. Focused View

4. Global
```

Ejemplo:

```
Rename Dialog

↓

Suggestion Widget

↓

Editor

↓

Global
```

Mientras exista un popup abierto, el editor no debe consumir shortcuts.

---

# Reglas de Resolución

Al recibir un evento de teclado:

```
Keyboard Event

↓

Buscar shortcuts con esa combinación

↓

Evaluar contexto

↓

Descartar los inválidos

↓

Ordenar por prioridad

↓

Ejecutar el primero
```

---

# Definición de un Keymap

Cada shortcut debe declarar explícitamente:

```ts
{
    id: "editor.copy",

    keys: ["Ctrl", "C"],

    when: [
        "editorFocused",
        "!editorReadonly"
    ],

    command: copySelection
}
```

Nunca depender de lógica implícita.

---

# Convenciones para Context Keys

## Focus

```
editorFocused

terminalFocused

sidebarFocused

treeFocused

modalFocused
```

Siempre terminar en:

```
Focused
```

---

## Visibilidad

```
suggestVisible

findVisible

renameVisible

dialogVisible
```

Siempre terminar en:

```
Visible
```

---

## Estados

```
hasSelection

hasClipboard

isReadonly

isDirty

isRecording
```

Usar:

```
has

is
```

como prefijos.

---

## Modos

```
normalMode

insertMode

visualMode

commandMode
```

Siempre terminar en:

```
Mode
```

---

# Buenas Prácticas

## ✔ Mantener los contextos pequeños

Mejor:

```
editorFocused
```

que:

```
editorFocusedAndEditable
```

---

## ✔ Preferir composición

Correcto:

```
editorFocused

&&

!readonly

&&

hasSelection
```

En lugar de:

```
editableEditorWithSelection
```

---

## ✔ Evitar shortcuts globales

Todo shortcut debe pertenecer a un contexto.

---

## ✔ Un contexto representa un solo concepto

Incorrecto:

```
editorOrTerminalFocused
```

Correcto:

```
editorFocused

terminalFocused
```

---

## ✔ Los comandos nunca verifican el contexto

El comando solo ejecuta la acción.

Incorrecto:

```ts
copy() {

    if (!editorFocused)
        return;

}
```

Correcto:

```
Keymap

↓

Context

↓

Command
```

El contexto decide si el comando puede ejecutarse.

---

# Arquitectura

```
Keyboard Event
        │
        ▼
Keybinding Registry
        │
        ▼
Filtrar por Shortcut
        │
        ▼
Evaluar Contextos
        │
        ▼
Resolver Prioridad
        │
        ▼
Ejecutar Command
```

---

# Resumen

Un keymap siempre está definido por:

```
Shortcut

+

Context

+

Command
```

El comando nunca conoce el teclado.

El teclado nunca conoce la implementación del comando.

El contexto es el único responsable de decidir cuándo un shortcut es válido.

> [!NOTE]
> Si un keymap **no define ningún contexto (`when`)**, se considera un **keymap global**.
>
> Un keymap global está disponible en toda la aplicación, independientemente del foco o del estado de la interfaz. Debe reservarse únicamente para acciones que tengan sentido desde cualquier lugar.

Ejemplo:

```ts
{
    id: "app.openCommandPalette",

    keys: ["Ctrl", "Shift", "P"],

    command: openCommandPalette
}
```

En este caso, al no existir un contexto, el atajo podrá ejecutarse desde cualquier vista.

## ¿Cuándo usar un keymap global?

Los keymaps globales deben ser la excepción, no la regla. Solo deberían utilizarse para acciones que:

- Son válidas desde cualquier parte de la aplicación.
- No dependen del componente que tenga el foco.
- No requieren un estado específico de la interfaz.

Ejemplos:

- Abrir la Command Palette.
- Abrir la configuración.
- Mostrar la ayuda.
- Cambiar de tema.
- Abrir el selector rápido de archivos.

## ¿Cuándo NO usar un keymap global?

No registrar como global acciones que pertenecen a un contexto específico.

❌ Incorrecto

```ts
Ctrl + C → Copiar selección
```

El comportamiento de copiar depende de qué componente tenga el foco.

✔ Correcto

```ts
Ctrl + C

when editorFocused

→ Copiar texto
```

```ts
Ctrl + C

when terminalFocused

→ Enviar SIGINT
```

```ts
Ctrl + C

when treeFocused

→ Copiar elemento
```

La misma combinación de teclas puede tener distintos comportamientos siempre que cada uno esté asociado a un contexto diferente.
