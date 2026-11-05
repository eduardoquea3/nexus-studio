---
description: Crea un commit a partir de los cambios actuales usando Conventional Commits
---

Genera y crea un commit para los cambios actuales usando Conventional Commits.

Indicaciones del usuario: $ARGUMENTS

Pasos:

1. Inspecciona el repositorio antes de tocar nada:
   - `git status --short`
   - `git diff` y `git diff --cached`
   - `git log -8 --oneline` para respetar el estilo, idioma y scopes existentes.
2. Decide qué entra en el commit:
   - Si ya hay cambios en el index (staged), commitea únicamente esos.
   - Si no hay nada staged, prepara con `git add <rutas>` solo los cambios relevantes.
   - Si detectas grupos de cambios no relacionados, no los mezcles: sepáralos en commits distintos o pregunta al usuario.
   - No incluyas secretos (`.env`, credenciales, claves) ni archivos ignorados o generados.
3. Redacta el mensaje:
   - Formato: `tipo(scope): descripción`
   - Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   - Descripción en imperativo, minúscula, sin punto final y con 72 caracteres como máximo.
   - Usa el idioma de los commits recientes del repo (por defecto, inglés).
   - Añade `scope` cuando aporte claridad (módulo, capa o área afectada).
   - Añade cuerpo solo si aporta contexto útil (qué cambia y por qué), separado por una línea en blanco.
   - Si rompe compatibilidad, añade el signo de exclamación tras el tipo/scope y un footer `BREAKING CHANGE: <detalle>`.
   - No añadas firmas ni trailers de atribución de IA.
4. Crea el commit:
   - Una sola línea: `git commit -m "tipo(scope): descripción"`.
   - Con cuerpo o footer: usa varios `-m` (`git commit -m "asunto" -m "cuerpo"`).
   - Nunca hagas `push`, `amend`, `rebase` ni `reset` salvo que el usuario lo pida explícitamente.
5. Verifica el resultado con `git log -1 --stat` y responde con el hash corto y el mensaje final del commit.
