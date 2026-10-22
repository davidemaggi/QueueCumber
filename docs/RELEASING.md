# Building release drafts

Every artifact intended for distribution is built in GitHub Actions. Local build/package commands are for development and debugging. The first distribution channel is GitHub Releases; Homebrew, WinGet and Chocolatey integrations follow later and should reference versioned release assets and checksums.

## Current workflow

`.github/workflows/release.yml` builds distribution artifacts **only after a pull request is merged into `main`**. The `pull_request_target` closed event has explicit merged/base guards; a merely closed PR, an open PR, development push, direct push or tag push cannot start release packaging. This post-merge target context also supports accepted contributions from forks without running an unmerged PR head with signing credentials. The validator checks the event repository, immutable merge SHA, actual checkout and `origin/main` ancestry before installing dependencies or requesting signing access.

All target jobs check out that validated merge SHA. The `v`-prefixed SemVer tag is derived from the merged `package.json`; bump its version before every release merge. An existing tag belonging to another commit fails validation. After all target builds/signing/checks succeed, the draft job creates the corresponding tag/release at the explicit merge SHA; existing releases are never overwritten. Protect `main` and release tags, and require ordinary Checks before merging. Rerunning a failed workflow keeps its original merged commit; no manual dispatch route is provided.

The normal Checks workflow still compiles/tests development and PR code; those are validation builds, not distributable release artifacts. The release workflow never packages an unmerged development commit. Its event definition must be available on the base repository's main/default branch for GitHub to deliver the event. Validate the first actual merge/run before claiming remote release automation works.

| Target | Artifacts | Signing |
| --- | --- | --- |
| Windows x64 | NSIS installer, ZIP | Azure Artifact Signing required |
| macOS arm64 | DMG, ZIP | Developer ID signing and Apple notarization required |
| Linux x64 | AppImage, DEB, tar.gz | No package signature yet |

These are configured build targets, not a certified compatibility matrix. No remote release workflow has been run yet.

Windows uses `electron-builder.windows.mjs`, extending the shared configuration. It requires the account endpoint, account/profile names and exact certificate CN, forces signing, and requests SHA-256 file/timestamp digests. The pinned electron-builder 26 integration still uses the older `azureSignOptions` / `TrustedSigning` names for the renamed Azure service. Keep configuration aligned with the locked builder version; newer builder schemas differ. See [electron-builder v26 signing](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/).

Authentication uses Azure login with GitHub OIDC and an environment-scoped federated identity. The signing job uses the `windows-signing` GitHub environment. Configure restricted deployment branches, reviewers and a profile-scoped signing principal before running it. Microsoft documents [OIDC authentication](https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md) and [profile-scoped signer permissions](https://learn.microsoft.com/en-us/azure/artifact-signing/tutorial-assign-roles).

Account-specific setup instructions are intentionally local and ignored, under `maintainer-local/`. No account identifiers or credentials are committed. Signing configuration errors fail the build instead of producing unsigned Windows release output. A missing Azure setup prevents the Windows job and release draft from completing.

After packaging, Windows verifies valid timestamped signatures on the application executable and installer, including the expected publisher. The ZIP is built from the signed application. Electron-builder signs the embedded NSIS uninstaller during creation; verification of the installed uninstaller remains part of clean-machine Windows testing.

The jobs upload only distributable files as Actions artifacts, retained for seven days. After every build succeeds, the final job downloads artifacts from that run, writes a streamed `SHA256SUMS.txt` manifest and creates a **draft** GitHub Release with generated notes. Prerelease status follows the SemVer prerelease suffix. The workflow neither overwrites an existing release nor publishes a draft, and it performs no package-manager submissions. An existing release makes creation fail; review it instead of replacing its assets automatically.

## Release names

Starting at 1.0, a release with patch zero requires a `releaseName` in `package.json`: a Star Wars character beginning with the major's letter (1 → A, 2 → B, through 26 → Z). **1.0.0 is Ackbar**, including 1.0.0 prerelease candidates. Choose real character names during review; the validator checks the letter and the fixed 1.0 name, not a fictional-universe encyclopedia. Agree the continuation after Z before using a later major.

Patch releases omit `releaseName` entirely. Current 0.x development versions stay unnamed. Examples of title format: `v1.0.0 — Ackbar`, `v1.0.1`. Tags, package versions and artifact filenames continue to use numeric SemVer only. The draft title and application version display include the name where present; signing and update-version comparisons retain the ordinary version.

## Before publishing

1. Confirm the normal Checks workflow and all release-build jobs pass for the merged commit.
2. Verify downloaded checksums and clean-machine install, startup, upgrade and uninstall behavior. Check app and installed-uninstaller signatures on Windows.
3. Complete applicable platform signing/notarization and the roadmap release gates. Require the documented Windows/macOS signing gates; do not publish unsigned 1.0 artifacts.
4. Review generated release notes and assets, then publish the draft deliberately in GitHub.

Azure/Apple provisioning, the first real signed Windows/macOS runs and clean-machine installation checks remain pending. Preparing workflows does not satisfy those gates.

## macOS signing and notarization

The desktop matrix uses the protected `release-desktop` environment. Its macOS step alone receives secrets `MAC_CSC_LINK` (base64 Developer ID Application PKCS#12), `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and variable `APPLE_TEAM_ID`. Restrict environment deployment to main and trusted approval. Linux does not receive these step-scoped secrets. The ignored maintainer setup guide contains the account walkthrough.

`electron-builder.mac.mjs` extends the shared targets, requires those settings, rejects disabled identity discovery and enables forceCodeSigning, hardened runtime and notarization using the installed v26 schema. The job verifies the packaged app with codesign, Gatekeeper and stapler before uploading. No unsigned fallback is provided for 1.0. Both platform jobs must pass before the combined draft is created. A validated configuration does not prove a real Apple submission succeeds. See [electron-builder v26 macOS options](https://www.electron.build/v26/docs/mac/) and [Apple notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

Use [prepared Ackbar notes](RELEASE_NOTES_1.0.md) when reviewing generated notes. Complete [the acceptance checklist](ACCEPTANCE.md) before publication; package-manager manifests must use the actual published assets and hashes after that decision.
