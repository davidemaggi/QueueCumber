# 1.0.1 — optional Windows signing

The maintainer authorized preparing 1.0.1 using their existing Windows action as inspiration. Notify them before any remote execution so they can start the runner. Prepare code and local tests only until runner readiness is confirmed; do not push, merge, dispatch or publish before that checkpoint. This patch has no releaseName.

Use the existing optional workflow, not a second distribution trigger. Always build unsigned packages on GitHub runners following a merged main PR. The independent workflow_run signer uses a repository-visible idle self-hosted Windows X64 runner labeled codesign. Reuse CODESIGN_CERT_SUBJECT (exact certificate CN) and CODESIGN_TIMESTAMP_URL (RFC 3161 endpoint), with SHA-256 and the existing WINDOWS_SIGNING enablement/inventory gates. No private key export or cloud signing integration.

1. Test and correct successful merged-PR provenance: the original workflow reports its PR head branch, so validate the trusted workflow event/path and the artifact's exact main-ancestor commit/version instead. Test draft release target validation without requiring an unpublished Git tag, plus changed/published target rejection. Carry the exact release ID into the signer and recheck before upload.
2. Test and adapt runner labels and electron-builder subject/timestamp configuration. Preserve fail-closed identity validation and timestamp/publisher checks; verify the ZIP carries the same signed executable as win-unpacked. Reuse the original action's conventions without its direct-push/manual triggers, installer technology or package-manager publishing.
3. Bump to 1.0.1, remove releaseName, update README/ROADMAP/releasing and ignored maintainer setup instructions. Run local source/release/PowerShell tests and actionlint, review the integrated change, and commit locally.
4. Stop before remote execution: notify the maintainer to start/register the runner for this repo and configure vars/secrets. After readiness is confirmed, push/PR/check/merge, verify unsigned and optional signed outputs and real Authenticode evidence. Publication remains deliberate; never claim real signing succeeded based on local mocks.

Sources: supplied legacy action; installed electron-builder 26.15.3 signtool options; official electron-builder and GitHub releases documentation. Existing 1.0.0 signed-skip behavior, runner-unavailable behavior and queue watchdog must remain covered.

Review corrections: reject an existing tag that points elsewhere even for an unpublished draft, and upload assets directly to the verified numeric release ID. Regression tests failed before these corrections and passed afterward. The local unit suite passes all 85 tests; real certificate signing and remote execution remain pending the runner-start checkpoint.
