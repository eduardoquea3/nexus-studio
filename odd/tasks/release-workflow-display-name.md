Objective: Rename the GitHub Actions workflow file to release.yml (and nothing else in its workflow content), then retry the existing v0.4.0 workflow.
Branch: chore/release-workflow-display-name | Delivery strategy: feature-branch-chain | Checks: structural workflow validation, native assessment if RDD requires it, then one GitHub Actions dispatch and result inspection.
Engram mirror: pending; the Engram search endpoint returned HTTP 404.

## Specs
1. S1 — Rename only the workflow filename to `release.yml`, as clarified: “Pero yo me refería cambiar el nombre del archivo, que pase de Windows build. jaml a release nada más release. jaml.” Preserve the original YAML display name, triggers, build matrix, and release logic.
2. S2 — Retry the existing v0.4.0 workflow once, as requested: “intenta hacer la release de nuevo a ver si ahora sí pasa todo.” Verify both platform build jobs, the release job, and the resulting v0.4.0 assets.

## Tasks
- T1 — S1 — Rename `.github/workflows/windows-build.yml` to `.github/workflows/release.yml` without changing workflow content; route: parent inline; status: in_progress; commit: `7056627` superseded, corrected rename commit pending.
- T2 — S2 — Dispatch the workflow once for v0.4.0 from the changed branch and inspect the complete result; route: parent; status: pending; commit: pending.

## Log
- L1 — “Ok, ahora esto primero cambia el nombre a ese workflow de Windows Build a release e intenta hacer la release de nuevo a ver si ahora sí pasa todo.”
- L2 — 2026-11-27: Current checkout is `996e9cd` on `development`; tag `v0.4.0` points to `16ef2b6`. The failed tag-triggered run `46038867316` predates the lockfile fix. A later manual run `46042996372` on `996e9cd` succeeded for Windows, Linux, and the release job, uploading three assets to the existing draft `v0.4.0` release. Use this same tag for the requested retry; the draft's status is not changed by the existing workflow.
- L3 — The `release-workflow` skill required by `AGENTS.md` was not present in the effective skill list or searched configured skill roots; use the smallest safe fallback. Engram search failed with HTTP 404, so the mirror is pending and no memory save was attempted.
- L4 — Use an isolated feature branch for the workflow-label change. Do not retarget the existing tag or change the draft/published state as part of this workflow-name-and-retry request.
- L5 — T1 structural verification: the diff changes only `name: Desktop build` to `name: Release`; `git diff --check` passed. Independent verifier marked S1 met and confirmed all workflow triggers/jobs/steps/release behavior are unchanged. `actionlint` is unavailable.
- L6 — T1 work-unit commit: `7056627` (`ci: rename desktop workflow to Release`). The commit tool reports 72,302 authored changed lines across 24 commits versus `origin/main`; do not create a PR from this feature branch. The requested workflow run is the delivery target.
- L7 — Native ASSESS classified the prior committed candidate high risk and `reviewDue: true` (item 5). `gentle_review_run` returned `consent-required` with `lineage_created: false`; no native review authority was created, and no push or workflow dispatch occurred.
- L8 — User correction, verbatim: “Pero yo me refería cambiar el nombre del archivo, que pase de Windows build. jaml a release nada más release. jaml.” S1 now means rename `.github/workflows/windows-build.yml` to `.github/workflows/release.yml` only; restore the YAML display name to its original value. Reopen T1; T2 remains pending behind T1.
- L9 — The uncreated consent request applied to the superseded display-name candidate and will not be answered or reused. After the corrected rename is committed, reassess and obtain any fresh native consent before delivery. No push or workflow dispatch has occurred.
- L10 — Corrected independent verification compared the feature branch against base `996e9cd0a7de2a841efb6deb94eed08ab247caee`: 100%-similarity rename only from `.github/workflows/windows-build.yml` to `.github/workflows/release.yml`, with no YAML content delta. The earlier HEAD-relative name reversal restores the original base value. `git diff --check` passed; `actionlint` is unavailable; no workflow was dispatched.
