# Instalación en Linux

El instalador descarga el AppImage x86_64 de la última release estable de GitHub, verifica el SHA-256 publicado por GitHub y lo instala para el usuario actual. No requiere `yay` ni AUR. En Arch comprueba las dependencias de ejecución y pregunta antes de instalar las que falten con `pacman` (para lo que puede solicitar `sudo`).

## Instalar o actualizar

```bash
curl -fsSL https://raw.githubusercontent.com/eduardoquea3/nexus-studio/main/scripts/install-appimage.sh | bash
```

El instalador necesita `curl` y `sha256sum`. En Arch también comprueba Python 3 y las bibliotecas de ejecución; muestra los paquetes que falten y solicita confirmación `[y/N]`. Responder `n` cancela sin instalar la app. En otras distribuciones, Python 3 debe estar instalado manualmente. Luego instala el AppImage en `~/.local/opt/nexus-studio`, crea el comando `~/.local/bin/nexus-studio` y registra el lanzador del escritorio y el icono.

Al volver a ejecutar el mismo comando se instalará la última versión publicada. Para lanzarlo, ejecuta `nexus-studio` o búscalo en el menú de aplicaciones. Si `~/.local/bin` no está en `PATH`, el script muestra la ruta completa para ejecutarlo.

## Desinstalar

```bash
curl -fsSL https://raw.githubusercontent.com/eduardoquea3/nexus-studio/main/scripts/install-appimage.sh | bash -s -- --uninstall
```

La desinstalación elimina la aplicación, el lanzador y el icono; no toca los datos ni las conexiones guardadas.

## Dependencias en otras distribuciones

Fuera de Arch, el instalador no modifica paquetes del sistema. Si faltan bibliotecas de ejecución, instala las dependencias equivalentes de Tauri con el gestor de paquetes de tu distribución. En Arch, la lista consultada por el instalador es `fuse2`, `gtk3`, `libayatana-appindicator`, `librsvg`, `python` y `webkit2gtk-4.1`.

Para instalarlas manualmente en Arch:

```bash
sudo pacman -S --needed fuse2 gtk3 libayatana-appindicator librsvg python webkit2gtk-4.1
```
