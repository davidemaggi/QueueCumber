# Building release drafts

All distribution artifacts are built through GitHub Actions after a reviewed pull request merges into main. Ordinary development/PR checks do not package releases. GitHub Releases is the first download channel; package-manager submissions follow verified assets. Source metadata alone does not publish a release.

## Always-available unsigned path

`.github/workflows/release.yml` accepts only a merged `pull_request_target.closed` event into main. It validates repository, exact merge SHA, checkout, main ancestry, SemVer/name and tag conflicts before packaging. Direct pushes, tag pushes, open/unmerged PRs and manual dispatch cannot trigger distribution. Every package uses the validated SHA.

GitHub-hosted runners build Windows x64 NSIS/ZIP, macOS arm64 DMG/ZIP and Linux x64 AppImage/DEB/tar.gz through `electron-builder.unsigned.mjs`. Filenames explicitly include `unsigned`; these jobs need no signing environment, Azure account or Apple secret. macOS arm64 uses an ad-hoc signature, without a trusted Developer ID identity or notarization. Do not describe these artifacts as publisher-signed.

The validated macOS packaging step explicitly enables electron-builder signing for the merged-PR event so it applies the configured ad-hoc identity (`-`), then verifies bundle integrity before uploading. Without this setting electron-builder skips signing for the PR event and leaves a renamed Electron bundle with an invalid resource seal. This does not enable a trusted signing identity or require any certificate secret.

Leave certificate-link variables unset in this unsigned workflow. An empty `CSC_LINK` is treated as a certificate file path by electron-builder, rather than as a disabled certificate. Actions secrets are not injected into the environment unless explicitly referenced; this workflow references none.

After all unsigned targets succeed, the workflow creates a **draft** release targeting the merge SHA, reserving the intended version tag with unsigned assets and `SHA256SUMS.txt`. The Git tag itself is created when the draft is published; before publication, verify the draft target SHA instead of expecting a tag ref. Existing releases/assets are never overwritten. The workflow also saves a small release-context artifact (commit/tag/version), retained seven days, for the optional follow-up. Keep main/tags protected and normal Checks required. The workflow must exist on the default branch for its trigger to work.

The maintainer has explicitly authorized **1.0.0 Ackbar as unsigned**. Signing begins with the planned **1.0.1**, which has no release name under the patch naming rule. Do not bump the package until preparing that release's code. The first draft build succeeded on all three hosted targets; all seven downloaded checksums passed and the packaged macOS app passed a local session-only capture smoke test. Clean-machine installation still needs acceptance.

## Optional signed Windows path, from 1.0.1

`.github/workflows/release-signed.yml` follows a successful Build release draft run through `workflow_run`; it has no manual/push/PR-head distribution trigger. Its hosted preflight validates the original workflow path/event/repository/main branch, validates the context against package metadata/main ancestry and the release tag's exact commit, then checks availability. It never sends an unmerged PR head to the signing machine.

Enable with repository variable `WINDOWS_SIGNING_ENABLED=true`. Add repository secret `SIGNING_RUNNER_READ_TOKEN`: a fine-grained GitHub token limited to this repository with **Administration: read**, used only on the hosted preflight to list repository self-hosted runners. The ordinary workflow token cannot generally list them. Missing token, inventory errors, missing/offline/busy runners, disabled signing or version 1.0.0 mean no signed job. This implementation expects a repository-visible runner with labels `self-hosted`, `Windows`, `X64`, `queuecumber-signing`; organization-only inventory and custom label selection are not implemented. See [GitHub runner inventory permissions](https://docs.github.com/en/rest/actions/self-hosted-runners).

The dedicated runner needs Node/pnpm tooling access, PowerShell 7, GitHub CLI, Windows signing tools and a code-signing certificate/private key accessible to its service account through the Windows certificate store. Set repository variables:

| Variable | Meaning |
| --- | --- |
| `WINDOWS_SIGNING_CERTIFICATE_SHA1` | Exact 40-hex certificate thumbprint, used to select the certificate; signatures use SHA-256 |
| `WINDOWS_SIGNING_PUBLISHER` | Exact signer certificate Common Name, checked after signing |

The config `electron-builder.self-hosted.mjs` forces signing through the selected local certificate and gives assets distinct `signed` filenames. No Azure login, Azure account variables, exported private key or PFX password is used by this workflow. A hardware-backed key can work when its installed provider exposes the certificate to SignTool; validate that provider/PIN/service-account behavior on the actual machine. A different signing backend requires an explicit integration rather than assuming any HSM works.

Application/installer signatures must be valid, timestamped and match the publisher. Only then are Windows signed installer/ZIP plus `SHA256SUMS-signed-windows-x64.txt` attached to the **same existing release**, without clobbering unsigned files or publishing the draft. The tag is checked again before attachment. A signing error leaves unsigned output intact; a failed upload can leave a subset of already-verified signed files, which the maintainer must inspect before publication. macOS trusted signing/notarization and Linux package signing are outside this optional Windows path.

The first unsigned hosted run exposed two follow-up requirements before enabling the future signer: workflow_run metadata reports the PR head branch (development), and unpublished drafts have no Git tag ref yet. The current strict preflight must be adapted and reverified for these observed semantics before 1.0.1; it is not production-validated. Version 1.0.0 intentionally skips signing.

Availability is a snapshot, not a reservation. A hosted watchdog allows two minutes for the signer job to start, then rechecks and cancels only this isolated optional workflow if it is still observed queued (including approval/runner-disappearance delays). If the jobs API remains unavailable or the state is unknown, the watchdog fails visibly without cancelling a potentially active signer; the optional job may then remain queued and needs maintainer attention. Availability/status checks are not atomic reservations, so a start concurrent with cancellation remains possible. Signing itself has a 30-minute execution timeout. The original unsigned release workflow has already finished and is never cancelled by this watchdog. The optional cancellation can appear as a cancelled Actions run; it does not retract the release's unsigned assets. See [GitHub workflow cancellation](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run).

Use a dedicated, preferably ephemeral self-hosted runner restricted to trusted release work. Clean checkout happens before each run; keep key material outside the workspace. Do not route arbitrary pull-request code to that machine. Inventory authorization does not grant signing-key access. Runner setup and real signing remain maintainer checks; no account provisioning or remote execution has been performed.

## Version names and publication

Tags and filenames stay numeric SemVer. Major/minor releases with patch zero use `releaseName`: Star Wars characters with A for major 1, B for major 2, through Z. **1.0.0 is Ackbar**; patch releases such as 1.0.1 omit the field. Automated validation enforces the letter/Ackbar/absence rules; character authenticity remains reviewable content.

Review downloaded checksums, install/upgrade/uninstall behavior, actual supported architectures and signing status. Verify the signed app and installed uninstaller when signed variants exist. Unsigned artifacts must remain clearly labeled; expected OS warnings are not evidence of a valid publisher signature. Do not disable system-wide security protections to pass acceptance. Use [prepared notes](RELEASE_NOTES_1.0.md) and [acceptance checklist](ACCEPTANCE.md), then publish the draft deliberately. Neither workflow automatically publishes or submits package-manager manifests.
