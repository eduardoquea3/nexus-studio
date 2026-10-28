---
description: Prepara y publica una release validada con tag y GitHub Actions
---

Prepara y publica una release del proyecto siguiendo el flujo de `release-workflow`.

Argumento del usuario: $ARGUMENTS

## 1. Precondiciones (detente si algo falla)

Primero, antes de cualquier otra acción, verifica que el index esté vacío:

- Ejecuta `git diff --cached --quiet`.
- Si devuelve código 1, hay cambios en staged. Detente de inmediato y pide al usuario que los commitee o los deshaga. No uses `git stash`, `git reset`, `git checkout` ni commits automáticos para limpiar el index.
- Después comprueba que el árbol de trabajo esté limpio con `git status --porcelain`. Si hay cambios sin stage o archivos sin trackear, detente y muéstralos.
- Confirma que la rama actual es `development`; si no, detente y pregunta.
- Ejecuta `git fetch origin`, revisa `git log -5 --oneline` y `git describe --tags --abbrev=0`. Asegúrate de que `development` no esté detrás de `origin/development`.
- Compara la versión de `package.json` y `src-tauri/tauri.conf.json`. Si no coinciden, detente y pregunta.

## 2. Define la versión y el tag

- Si `$ARGUMENTS` contiene una versión exacta (`X.Y.Z` o `vX.Y.Z`), úsala.
- Si contiene `patch`, `minor` o `major`, calcúlala desde el último tag `v*`.
- Si está vacío, propón la siguiente versión patch y pide confirmación antes de continuar.
- Valida que sea semver y normaliza el tag como `vX.Y.Z`.
- Comprueba que el tag no exista local ni remotamente con `git rev-parse` y `git ls-remote --tags origin`. Si existe, detente.

## 3. Prepara la versión

- Actualiza el campo `version` en `package.json` y `src-tauri/tauri.conf.json` al nuevo valor.
- Vuelve a comparar ambas versiones y confirma que coinciden con el tag `vX.Y.Z`.
- No modifiques `src-tauri/Cargo.toml`; las releases de este proyecto no lo sincronizan.
- No modifiques ningún otro archivo.

## 4. Valida

- Ejecuta `bun test`.
- Ejecuta `bun run build`.
- Ejecuta `git diff --check`.
- Si algo falla, no commitees, no hagas push y no crees el tag. Reporta el fallo.

## 5. Crea el commit de release

- Revisa `git diff` y confirma que solo cambiaron esos dos archivos y solo el campo `version`.
- Stagea únicamente `package.json` y `src-tauri/tauri.conf.json`.
- Crea el commit `chore(release): prepare vX.Y.Z`.
- No añadas atribución de IA.
- Muestra el hash, la versión y la rama actual.

## 6. Push (requiere confirmación)

- Pide confirmación explícita al usuario antes de ejecutar `git push origin development`.
- Solo tras un sí explícito, haz el push.
- Nunca uses `--force`, `--amend`, `--no-verify` ni saltes hooks.

## 7. Tag y release (requiere segunda confirmación)

- Pide una segunda confirmación explícita antes de crear y publicar el tag. Explica que el tag dispara el build y la publicación en GitHub Actions.
- Si el usuario pide notas personalizadas, crea antes un draft con `gh release create vX.Y.Z --draft --target development --title "nexus-studio vX.Y.Z" --notes "<notas>"`. El workflow detectará la release existente y subirá los assets.
- Crea un tag anotado: `git tag -a vX.Y.Z -m "nexus-studio vX.Y.Z"`.
- Publica el tag con `git push origin vX.Y.Z`.
- El workflow `.github/workflows/windows-build.yml` se ejecuta con tags `v*`, compila Windows y Linux, y crea la release con notas generadas si no existe. No ejecutes `gh release create` salvo para el caso de notas personalizadas.
- Si creaste un draft, cuando el workflow termine correctamente pide confirmación antes de publicarlo con `gh release edit vX.Y.Z --draft=false`.

## 8. Verifica y reporta

- Espera al workflow con `gh run list --workflow "Desktop build" --limit 1` y `gh run watch <run-id>`.
- Comprueba el resultado con `gh release view vX.Y.Z --json tagName,url,assets`.
- Reporta validaciones, archivos modificados, hash del commit, resultado del push, tag publicado, estado del workflow y URL de la release.
- Si el workflow falla, dilo claramente y no afirmes que la release se publicó.
