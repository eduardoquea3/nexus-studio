#!/usr/bin/env bash
set -Eeuo pipefail

repository='eduardoquea3/nexus-studio'
home_dir="${HOME:?HOME must be set}"
install_dir="${NEXUS_STUDIO_INSTALL_DIR:-$home_dir/.local/opt/nexus-studio}"
bin_dir="${NEXUS_STUDIO_BIN_DIR:-$home_dir/.local/bin}"
data_home="${XDG_DATA_HOME:-$home_dir/.local/share}"

appimage_path="$install_dir/nexus-studio.AppImage"
launcher_path="$bin_dir/nexus-studio"
desktop_path="$data_home/applications/nexus-studio.desktop"
icon_path="$data_home/icons/hicolor/128x128/apps/nexus-studio.png"

usage() {
  cat <<'EOF'
Install or update the latest Nexus Studio AppImage for the current user.

Usage:
  install-appimage.sh [--uninstall | --help]

Optional environment variables:
  NEXUS_STUDIO_INSTALL_DIR  AppImage install directory
  NEXUS_STUDIO_BIN_DIR      Launcher directory
  XDG_DATA_HOME             Desktop entry and icon directory
EOF
}

uninstall() {
  rm -f -- "$launcher_path" "$desktop_path" "$icon_path" "$appimage_path"
  rmdir --ignore-fail-on-non-empty -- "$install_dir" 2>/dev/null || true
  printf 'Nexus Studio removed. User data and saved connections were not touched.\n'
}

case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  --uninstall)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    uninstall
    exit 0
    ;;
  '')
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

for command_name in curl sha256sum install mktemp od tr; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [[ "$(uname -m)" != 'x86_64' ]]; then
  printf 'The latest Linux AppImage is currently available for x86_64 only.\n' >&2
  exit 1
fi

install_arch_dependencies() {
  command -v pacman >/dev/null 2>&1 || return 0

  local required_packages=(
    fuse2
    gtk3
    libayatana-appindicator
    librsvg
    python
    webkit2gtk-4.1
  )
  local missing_packages=()
  mapfile -t missing_packages < <(pacman -T "${required_packages[@]}" 2>/dev/null || true)

  if [[ ${#missing_packages[@]} -eq 0 ]]; then
    printf 'Los paquetes necesarios ya están instalados.\n'
    return 0
  fi

  printf 'El instalador o el AppImage necesita estos paquetes de Arch, que no están instalados:\n'
  printf '  - %s\n' "${missing_packages[@]}"
  printf '\n'

  if [[ ! -r /dev/tty ]]; then
    printf 'No hay una terminal para confirmar. Ejecuta el instalador interactivamente o instala estos paquetes manualmente.\n' >&2
    return 1
  fi

  printf '¿Instalar estas dependencias ahora? [y/N] ' > /dev/tty
  local answer=''
  IFS= read -r answer < /dev/tty || true
  case "$answer" in
    y|Y|yes|YES|Yes|s|S|si|SI|Si|sí|Sí|SÍ)
      ;;
    *)
      printf 'Instalación cancelada; no se instaló el AppImage.\n' >&2
      return 1
      ;;
  esac

  if [[ "$EUID" -eq 0 ]]; then
    pacman -S --needed "${missing_packages[@]}"
  else
    if ! command -v sudo >/dev/null 2>&1; then
      printf 'Se necesita sudo para instalar dependencias de Arch. Instálalas manualmente y vuelve a ejecutar el script.\n' >&2
      return 1
    fi
    sudo pacman -S --needed "${missing_packages[@]}"
  fi
}

install_arch_dependencies

if ! command -v python3 >/dev/null 2>&1; then
  printf 'Python 3 is required to read release metadata. Install it and rerun this script.\n' >&2
  exit 1
fi

for directory in "$install_dir" "$bin_dir" "$data_home"; do
  case "$directory" in
    /*) ;;
    *) printf 'Install paths must be absolute: %s\n' "$directory" >&2; exit 1 ;;
  esac
done

temporary_dir="$(mktemp -d)"
staged_appimage=''
staged_launcher=''
staged_desktop=''
staged_icon=''

cleanup() {
  rm -rf -- "$temporary_dir"
  [[ -z "$staged_appimage" ]] || rm -f -- "$staged_appimage"
  [[ -z "$staged_launcher" ]] || rm -f -- "$staged_launcher"
  [[ -z "$staged_desktop" ]] || rm -f -- "$staged_desktop"
  [[ -z "$staged_icon" ]] || rm -f -- "$staged_icon"
}
trap cleanup EXIT

printf 'Looking up the latest stable release...\n'
curl --fail --location --silent --show-error \
  --header 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$repository/releases/latest" \
  --output "$temporary_dir/release.json"

release_metadata="$(python3 -c '
import json
import re
import sys

repository = "eduardoquea3/nexus-studio"
with open(sys.argv[1], encoding="utf-8") as release_file:
    release = json.load(release_file)

tag = release.get("tag_name", "")
matches = [
    asset for asset in release.get("assets", [])
    if re.fullmatch(r"nexus-studio_.+_amd64\.AppImage", asset.get("name", ""))
]
if not tag or len(matches) != 1:
    raise SystemExit("Could not find exactly one x86_64 AppImage in the latest release")

asset = matches[0]
url = asset.get("browser_download_url", "")
expected_prefix = f"https://github.com/{repository}/releases/download/{tag}/"
digest = asset.get("digest", "")
if not url.startswith(expected_prefix) or not url.endswith("_amd64.AppImage"):
    raise SystemExit("The latest release contains an unexpected AppImage URL")
if not re.fullmatch(r"sha256:[0-9a-fA-F]{64}", digest):
    raise SystemExit("GitHub did not provide a SHA-256 digest for the AppImage")

print(f"{tag}\t{url}\t{digest[7:]}")
' "$temporary_dir/release.json")"

IFS=$'\t' read -r release_tag appimage_url expected_sha256 <<< "$release_metadata"
printf 'Downloading Nexus Studio %s...\n' "$release_tag"
curl --fail --location --silent --show-error \
  "$appimage_url" --output "$temporary_dir/nexus-studio.AppImage"

actual_sha256="$(sha256sum "$temporary_dir/nexus-studio.AppImage")"
actual_sha256="${actual_sha256%% *}"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  printf 'AppImage checksum verification failed.\nExpected: %s\nActual:   %s\n' \
    "$expected_sha256" "$actual_sha256" >&2
  exit 1
fi

appimage_magic="$(od -An -N4 -tx1 "$temporary_dir/nexus-studio.AppImage" | tr -d '[:space:]')"
if [[ "$appimage_magic" != '7f454c46' ]]; then
  printf 'The downloaded file is not a valid Linux AppImage.\n' >&2
  exit 1
fi

curl --fail --location --silent --show-error \
  "https://raw.githubusercontent.com/$repository/$release_tag/src-tauri/icons/128x128.png" \
  --output "$temporary_dir/nexus-studio.png"

mkdir -p -- "$install_dir" "$bin_dir" \
  "$data_home/applications" "$data_home/icons/hicolor/128x128/apps"

staged_appimage="$install_dir/.nexus-studio.AppImage.$$"
install -m 0755 "$temporary_dir/nexus-studio.AppImage" "$staged_appimage"
mv -f -- "$staged_appimage" "$appimage_path"
staged_appimage=''

{
  printf '#!/usr/bin/env bash\nexec '
  printf '%q' "$appimage_path"
  printf ' "$@"\n'
} > "$temporary_dir/nexus-studio-launcher"
staged_launcher="$bin_dir/.nexus-studio.$$"
install -m 0755 "$temporary_dir/nexus-studio-launcher" "$staged_launcher"
mv -f -- "$staged_launcher" "$launcher_path"
staged_launcher=''

desktop_exec="$launcher_path"
desktop_exec="${desktop_exec//\\/\\\\}"
desktop_exec="${desktop_exec//\"/\\\"}"
cat > "$temporary_dir/nexus-studio.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Nexus Studio
Comment=Desktop database manager for developers
Exec="$desktop_exec" %U
TryExec="$desktop_exec"
Icon=nexus-studio
Terminal=false
Categories=Development;Database;
Keywords=database;sql;postgresql;mysql;sqlite;
EOF
staged_desktop="$data_home/applications/.nexus-studio.desktop.$$"
install -m 0644 "$temporary_dir/nexus-studio.desktop" "$staged_desktop"
mv -f -- "$staged_desktop" "$desktop_path"
staged_desktop=''

staged_icon="$data_home/icons/hicolor/128x128/apps/.nexus-studio.png.$$"
install -m 0644 "$temporary_dir/nexus-studio.png" "$staged_icon"
mv -f -- "$staged_icon" "$icon_path"
staged_icon=''

printf 'Installed Nexus Studio %s.\n' "$release_tag"
printf 'Run it with: %s\n' "$launcher_path"
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) printf 'Add %s to PATH to run `nexus-studio` from a terminal.\n' "$bin_dir" ;;
esac
