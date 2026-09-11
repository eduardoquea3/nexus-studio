---
name: release-workflow
description: "Trigger: commit, push, release, publish version. Validate changes, create a conventional commit, push safely, and publish a tagged GitHub release with confirmations."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Use this skill when the user asks to commit, push, publish, tag, or release the project.

## Hard Rules
- Inspect `git status`, the complete diff, current branch, and recent commits before staging anything.
- Never stage unrelated or pre-existing changes without explicitly reporting them.
- Run the project's relevant validation commands before committing. For this project use `bun test` and `bun run build`.
- Use a Conventional Commit message and never add `Co-Authored-By` or AI attribution.
- Ask for confirmation immediately before `git push` and again before creating a release or tag.
- Never force-push, amend commits, skip hooks, or create a release from a dirty worktree.

## Decision Gates
| Situation | Action |
| --- | --- |
| Dirty worktree contains unrelated changes | Stop and ask which files belong in the commit. |
| Version differs between `package.json` and `src-tauri/tauri.conf.json` | Stop and ask before releasing. |
| No release target is specified | Recommend GitHub release via `gh release create`; ask for version and notes. |
| Validation fails | Do not commit, push, or release. Report the failure. |

## Execution Steps
1. Inspect state and scope the intended files.
2. Run validation, stage only approved files, and create the conventional commit.
3. Show commit hash and remote/branch, then ask before pushing.
4. Confirm the version/tag, ensure the worktree is clean, then ask before `gh release create`.
5. Report commit, push, tag, release URL, and any skipped artifact build.

## Output Contract
Report commands run, validation results, files committed, commit hash, push result, release tag, and release URL. Clearly identify any step not executed.

## References
- `package.json` — project scripts and frontend version.
- `src-tauri/tauri.conf.json` — desktop application version and bundle configuration.
