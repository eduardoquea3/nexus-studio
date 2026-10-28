# AppImage compatibility fix and v0.2.4 release

## Objective
Publish the Linux AppImage compatibility fix in a new `v0.2.4` release, preserving Windows and Linux as the only desktop build targets.

## Problem and rationale
The GitHub Actions AppImage aborted in WebKitGTK with `Could not create default EGL display: EGL_BAD_PARAMETER`. The Linux workflow now strips bundled `libwayland-*.so*` from the AppImage staging directory, matching the workaround in the referenced TabularisDB workflow. The user selected `v0.2.4`, approved the prepared release notes, and explicitly authorized publishing.

## Scope and constraints
- Product changes: `.github/workflows/windows-build.yml`, `package.json`, and `src-tauri/tauri.conf.json`.
- Preserve exactly two matrix targets: Linux and Windows.
- Do not edit `src/components/`.
- Tag/release only after user confirmation; satisfied for v0.2.4.
- Required validations before commits: `bun test` and `bun run build`.

## Tasks
- [x] T1 — Verify and commit the Linux-only AppImage Wayland exclusion as `ci(appimage): exclude bundled Wayland libraries` (`20e7f9d`).
- [x] T2 — Commit the update of both app version declarations to `0.2.4` as `chore(release): prepare v0.2.4` (`0c803f3`).
- [x] T3 — Record initial commit identities and validation evidence in this document; commit it as a Conventional Commit (`6a6fdc4`).
- [x] T4 — Push tag `v0.2.4`; verify workflow and release completion.
- [x] T5 — Commit the post-release evidence update as a Conventional Commit; do not push it without authorization.

## Acceptance criteria
- Workflow matrix contains Linux and Windows only.
- Wayland exclusion runs only on Linux and before `bun run tauri build`.
- `package.json` and `src-tauri/tauri.conf.json` both declare `0.2.4`.
- Required test and build checks pass before commits.
- Release created after explicit user confirmation.

## Progress and verification
- `bun test`: passed (133 tests, 15 files; 0 failures).
- `bun run build`: passed (`tsc` and Vite; Vite reported a >500 kB chunk warning).
- `git diff --check`: passed for the full pending change.
- Commit `20e7f9d` (`ci(appimage): exclude bundled Wayland libraries`) created on `development`.
- Commit `0c803f3` (`chore(release): prepare v0.2.4`) created on `development`.
- Commit `6a6fdc4` (`docs(odd): record AppImage v0.2.4 release evidence`) pushed to `origin/development`.
- Tag `v0.2.4` pushed after explicit user approval.
- GitHub Actions Desktop build run `37693865668`: succeeded — https://github.com/eduardoquea3/nexus-studio/actions/runs/37693865668
- GitHub release: https://github.com/eduardoquea3/nexus-studio/releases/tag/v0.2.4
- Custom release notes read back and verified:
  - Fix Linux AppImage startup on systems with newer Mesa/EGL stacks by excluding bundled Wayland libraries, allowing WebKitGTK to use the host-provided versions.
  - Keep desktop release builds limited to Linux and Windows.
  - Bump the application version to 0.2.4.
- Assets verified: `nexus-studio_0.2.4_amd64.AppImage`, `nexus-studio_0.2.4_x64-setup.exe`, and `nexus-studio_0.2.4_x64_en-US.msi`.
- Post-release evidence commit: created locally after release; not pushed.

## Next step
Release is complete. Push the post-release evidence commit only if the user wants it published to `development`.
