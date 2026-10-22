# Building release drafts

Every artifact intended for distribution is built in GitHub Actions. Local build/package commands are for development and debugging. The first distribution channel is GitHub Releases; Homebrew, WinGet and Chocolatey integrations follow later and should reference versioned release assets and checksums.

## Current workflow

`.github/workflows/release.yml` runs manually from `development` or `main`. Supply an existing `v`-prefixed SemVer tag. The tagged commit must be reachable from `development`, and its `package.json` version must match the tag. All jobs build the resolved commit; the draft job checks that the remote tag still points to that commit. Protect release tags against modification.

| Target | Artifacts | Signing |
| --- | --- | --- |
| Windows x64 | NSIS installer, ZIP | Azure Artifact Signing required |
| macOS arm64 | DMG, ZIP | Currently unsigned and unnotarized |
| Linux x64 | AppImage, DEB, tar.gz | No package signature yet |

These are configured build targets, not a certified compatibility matrix. No remote release workflow has been run yet.

Windows uses `electron-builder.windows.mjs`, extending the shared configuration. It requires the account endpoint, account/profile names and exact certificate CN, forces signing, and requests SHA-256 file/timestamp digests. The pinned electron-builder 26 integration still uses the older `azureSignOptions` / `TrustedSigning` names for the renamed Azure service. Keep configuration aligned with the locked builder version; newer builder schemas differ. See [electron-builder v26 signing](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/).

Authentication uses Azure login with GitHub OIDC and an environment-scoped federated identity. The signing job uses the `windows-signing` GitHub environment. Configure restricted deployment branches, reviewers and a profile-scoped signing principal before running it. Microsoft documents [OIDC authentication](https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md) and [profile-scoped signer permissions](https://learn.microsoft.com/en-us/azure/artifact-signing/tutorial-assign-roles).

Account-specific setup instructions are intentionally local and ignored, under `maintainer-local/`. No Azure account identifiers or credentials are committed. Signing configuration errors fail the build instead of producing unsigned Windows release output. A missing Azure setup prevents the Windows job and release draft from completing.

After packaging, Windows verifies valid timestamped signatures on the application executable and installer, including the expected publisher. The ZIP is built from the signed application. Electron-builder signs the embedded NSIS uninstaller during creation; verification of the installed uninstaller remains part of clean-machine Windows testing.

The jobs upload only distributable files as Actions artifacts, retained for seven days. After every build succeeds, the final job downloads artifacts from that run, writes a streamed `SHA256SUMS.txt` manifest and creates a **draft** GitHub Release with generated notes. Prerelease status follows the SemVer prerelease suffix. The workflow neither overwrites an existing release nor publishes a draft, and it performs no package-manager submissions. An existing release makes creation fail; review it instead of replacing its assets automatically.

## Before publishing

1. Confirm the normal Checks workflow and all release-build jobs pass for the tagged commit.
2. Verify downloaded checksums and clean-machine install, startup, upgrade and uninstall behavior. Check app and installed-uninstaller signatures on Windows.
3. Complete applicable platform signing/notarization and the roadmap release gates. Explicitly describe unsigned early-testing builds.
4. Review generated release notes and assets, then publish the draft deliberately in GitHub.

Azure provisioning, the first real signed Windows run, Windows/Linux installation checks and macOS signing/notarization remain pending. Preparing workflows does not satisfy those gates.
