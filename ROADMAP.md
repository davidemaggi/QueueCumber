# Roadmap

A proposed sequence, not a delivery calendar. The 0.3.0 functionality works locally; cross-platform release validation is still pending. The package version does not mean a release has been published.

## Foundation — complete

- [x] Create and select `development`.
- [x] Replace generic ignore rules with project-focused rules.
- [x] Capture product requirements and AI conventions.
- [x] Draft README and architecture proposal.
- [x] Obtain architecture approval and confirm configurable resource budgets.
- [x] Review the detailed MVP implementation plan before development.

## 0.1.0 — RabbitMQ MVP

- [x] Electron/React shell, English plus an agreed second locale, light/dark/system theme.
- [x] Secure saved connections, protocol/management endpoint tests and TLS validation.
- [x] Discover/search queues, exchanges, streams and bindings through supported management APIs.
- [x] Capture supported routes with owned temporary queues and visible coverage limitations.
- [x] Inspect headers, raw payloads and size-limited formatted JSON.
- [x] Bounded RAM and encrypted disk capture from the first working subscription, with validated configurable resource settings.
- [x] Session cancellation, transient-failure retries and visible capture gaps.
- [x] Encrypted session history restored after restart, with retained range and bounded raw-byte navigation.
- [x] Integration tests proving original queues are never consumed or modified.

Pending: real OS-keystore verification, cloud authentication coverage and Windows/Linux execution.

Exit gate: a usable RabbitMQ vertical slice, measured resource bounds and security checks on all three target operating systems. Publish a tested broker/authentication matrix.

## 0.2.0 — Longer sessions and portable data

- [x] RabbitMQ stream reads from beginning, live end and explicit offset, including reconnect and retained-prefix notices.
- [x] Opt-in tray/background lifecycle and subscription status; explicit Quit stops capture (local macOS verified).
- [ ] Validate Windows tray and Linux desktop fallback behavior on actual desktops.
- [x] Streaming JSONL, folder and ZIP exports with a versioned manifest.
- [x] Password-encrypted configuration transfer and safe import conflict handling.
- [x] Retention controls, disk-full behavior, cancelable exports and recovery tests.

Implementation complete locally; the actual Windows/Linux desktop gate remains open. Kafka is implemented below; next comes 1.0 release hardening. Release validation continues through GitHub Actions and clean-machine checks.

Exit gate: long-session/reconnect tests, wrong-password and tampered-import rejection, tray validation across supported desktop environments.

## 0.3.0 — Kafka, without pretending it's RabbitMQ

- [x] Second provider behind the shared capability interface.
- [x] Topic/partition discovery and chosen per-partition start positions.
- [x] Local inspection offsets; no group joins or commits.
- [x] Tested local TLS/SASL and published [hosted-provider support matrix](docs/KAFKA.md#tested-brokerauthentication-matrix), explicitly separating unverified real accounts.
- [x] Offset-retention gaps, partition changes, cancellation and reconnect tests.

Implemented locally with explicit broker-specific semantics. Real hosted accounts, multi-broker clusters and Windows/Linux execution remain validation gates; no blanket promise of cloud IAM mechanisms. See [Kafka behavior](docs/KAFKA.md).

## 1.0.0 — Ackbar

- [ ] Complete approved RabbitMQ and Kafka inspection scope.
- [ ] Keyboard/screen-reader checks, translation and theme review.
- [ ] IPC, credential protection, capture encryption and import/export security review.
- [ ] Meet documented resource budgets under sustained load.
- [ ] Tested Windows installers/archives, macOS DMG/archives and Linux packages/archives.
- [x] Prepare GitHub Actions builds and draft GitHub Releases with checksums; Windows Azure Artifact Signing configuration.
- [ ] Validate Azure-signed Windows app/installer on a real runner and clean machine.
- [ ] Applicable signing, macOS notarization, checksums and release notes.
- [ ] Homebrew, WinGet and Chocolatey submission/verification, subject to registry requirements.
- [ ] Installation, permissions, capture limitations, retention and troubleshooting docs.
- [ ] Stable configuration/dump compatibility and migration behavior.

Version 1.0 remains for inspection. Owned observation resources are permitted; application publishing, purge, deletion and editing remain outside scope.

## After 1.0 — candidates, not commitments

Additional providers and payload decoders follow real requests. Extension points do not imply an executable plugin marketplace. Broker mutation features require a separate product decision.

## Versioning and maintenance

Follow SemVer 2.0.0. From 1.0, major/minor releases (patch zero) also carry a Star Wars character name: major 1 uses A, major 2 B, and so on. **1.0.0 is Ackbar.** Patch releases have no name; the current 0.x development milestones remain numeric. Store the chosen name as `releaseName` in package metadata for the named release, and remove it when bumping a patch. Tags and asset versions stay numeric SemVer; the app and GitHub Release title display the optional character name. Character authenticity is checked during release review; automated validation enforces the initial, patch rule and Ackbar for 1.0. Agree a continuation after Z before a major beyond 26. Use `0.x.y` while contracts evolve and prerelease suffixes such as `-alpha.1` where appropriate. Announce breaking pre-1.0 changes. From 1.0, incompatible public-contract changes require a major release, compatible features a minor release and compatible fixes a patch.

The public contract includes documented configuration schemas, dump formats and supported user-facing behavior. Version schemas independently and document migrations. Never silently discard connection data during upgrades.

All artifacts intended for distribution are built through GitHub Actions only after a pull request merges into `main`. Development/PR compilation tests do not package release artifacts. GitHub Releases provide installers/ZIP/DMG/TAR downloads before package-manager integrations are ready. Windows signing uses Azure Artifact Signing; provisioning and a real signed build remain pending.

Update status when scope or release expectations change. Mark tasks complete only with implementation and verification evidence.
