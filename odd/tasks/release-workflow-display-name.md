Objective: Rename the GitHub Actions workflow display name to Release and retry the existing v0.4.0 workflow from the corrected development tip.
Branch: chore/release-workflow-display-name | Delivery strategy: feature-branch-chain | Checks: structural workflow validation, native assessment if RDD requires it, then one GitHub Actions dispatch and result inspection.
Engram mirror: pending; the Engram search endpoint returned HTTP 404.

## Specs
1. S1 — Set the displayed workflow name to `Release`, as requested: “cambia el nombre a ese workflow de Windows Build a release”. Keep the workflow filename, triggers, build matrix, and release logic unchanged.
2. S2 — Retry the existing v0.4.0 workflow once, as requested: “intenta hacer la release de nuevo a ver si ahora sí pasa todo.” Verify both platform build jobs, the release job, and the resulting v0.4.0 assets.

## Tasks
- T1 — S1 — Change only the workflow YAML `name:` to `Release`; route: parent inline; status: in_progress; commit: pending.
- T2 — S2 — Dispatch the workflow once for v0.4.0 from the changed branch and inspect the complete result; route: parent; status: pending; commit: pending.

## Log
- L1 — “Ok, ahora esto primero cambia el nombre a ese workflow de Windows Build a release e intenta hacer la release de nuevo a ver si ahora sí pasa todo.”
- L2 — 2026-11-27: Current checkout is `996e9cd` on `development`; tag `v0.4.0` points to `16ef2b6`. The failed tag-triggered run `46038867316` predates the lockfile fix. A later manual run `46042996372` on `996e9cd` succeeded for Windows, Linux, and the release job, uploading three assets to the existing draft `v0.4.0` release. Use this same tag for the requested retry; the draft's status is not changed by the existing workflow.
- L3 — The `release-workflow` skill required by `AGENTS.md` was not present in the effective skill list or searched configured skill roots; use the smallest safe fallback. Engram search failed with HTTP 404, so the mirror is pending and no memory save was attempted.
- L4 — Use an isolated feature branch for the workflow-label change. Do not retarget the existing tag or change the draft/published state as part of this workflow-name-and-retry request.
- L5 — T1 structural verification: the diff changes only `name: Desktop build` to `name: Release`; `git diff --check` passed. Independent verifier marked S1 met and confirmed all workflow triggers/jobs/steps/release behavior are unchanged. `actionlint` is unavailable.
