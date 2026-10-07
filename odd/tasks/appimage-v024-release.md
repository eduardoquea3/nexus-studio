# AppImage compatibility fix and v0.2.4 release

## Objective
Publish the Linux AppImage compatibility fix in a new `v0.2.4` release, preserving Windows and Linux as the only desktop build targets.

## Problem and rationale
The GitHub Actions AppImage aborts in WebKitGTK with `Could not create default EGL display: EGL_BAD_PARAMETER`. The Linux workflow strips bundled `libwayland-*.so*` from the AppImage staging directory, matching the workaround in the referenced TabularisDB workflow. The user selected `v0.2.4` and custom release notes; exact notes text is still pending.

## Scope and constraints
- Product changes: `.github/workflows/windows-build.yml`, `package.json`, and `src-tauri/tauri.conf.json`.
- Preserve exactly two matrix targets: Linux and Windows.
- Do not edit `src/components/`.
- Do not push, tag, or publish until the user confirms after reviewing commit identities; custom release notes are still required.
- Required validations before commits: `bun test` and `bun run build`.

## Tasks
- [x] T1 — Verify and commit the Linux-only AppImage Wayland exclusion as `ci(appimage): exclude bundled Wayland libraries` (`20e7f9d`).
- [x] T2 — Commit the update of both app version declarations to `0.2.4` as `chore(release): prepare v0.2.4` (`0c803f3`).
- [x] T3 — Record verified commit identities and validation evidence in this document; commit it as a Conventional Commit.
- [ ] T4 — After user provides exact custom notes and confirms remote publishing, push commits/tag and create the GitHub release; report the resulting release URL.

## Acceptance criteria
- Workflow matrix contains Linux and Windows only.
- Wayland exclusion runs only on Linux and before `bun run tauri build`.
- `package.json` and `src-tauri/tauri.conf.json` both declare `0.2.4`.
- Required test and build checks pass before commits.
- No push, tag, or release occurs without fresh explicit user confirmation.

## Progress and verification
- `bun test`: passed (133 tests, 15 files; 0 failures).
- `bun run build`: passed (`tsc` and Vite; Vite reported a >500 kB chunk warning).
- `git diff --check`: passed for the full pending change.
- Commit `20e7f9d` (`ci(appimage): exclude bundled Wayland libraries`) created on `development`.
- Commit `0c803f3` (`chore(release): prepare v0.2.4`) created on `development`.
- Exact custom release notes: pending user text.
- Remote push, tag, and release: pending explicit confirmation.

## Next step
Request exact custom release notes and fresh user confirmation before pushing commits or tagging `v0.2.4`.
