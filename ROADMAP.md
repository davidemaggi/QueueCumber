# Roadmap

**[1.0.2](https://github.com/davidemaggi/QueueCumber/releases/tag/v1.0.2) was published on 2026-10-23**, with verified Windows signed installer/ZIP downloads and unsigned Windows/macOS/Linux packages built through GitHub Actions. All nine downloaded checksums match. Detailed clean-machine/platform/cloud checks remain recorded separately; publication does not imply additional certification.

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

- [x] Complete approved RabbitMQ and Kafka inspection scope.
- [x] Guided RabbitMQ connection setup, explicit capture guidance and a bounded local RabbitMQ/Kafka demo publisher.
- [x] Keyboard message navigation, semantic selection states, locale completeness and light/dark/narrow UI hardening.
- [x] Maintainer-supplied application icon and interface/tray mark, with native Windows/macOS/Linux icon resources and Retina tray export.
- [ ] Manual screen-reader, high-contrast and platform accessibility acceptance.
- [x] Local IPC, credential protection, capture encryption and import/export boundary review and regressions.
- [ ] Actual OS-keystore and maintainer security acceptance.
- [x] Finite cache/disk workloads and eviction/omission measurements.
- [ ] Representative long-running soak and RSS acceptance on release machines.
- [ ] Tested Windows installers/archives, macOS DMG/archives and Linux packages/archives.
- [x] Execute GitHub Actions source checks and unsigned Windows/macOS/Linux packaging; create the first release draft and verify all seven downloaded package checksums.
- [ ] Validate unsigned 1.0.0 downloads on clean machines, including expected OS warnings.
- [x] Unsigned 1.0.0 packaging, explicit asset names, checksum generation and prepared Ackbar release notes.
- [ ] Optional signed artifacts and platform signing/notarization acceptance when those channels are enabled.
- [ ] Homebrew, WinGet and Chocolatey submission/verification, subject to registry requirements.
- [x] Installation, permissions, capture limitations, retention and troubleshooting docs.
- [x] Documented stable configuration/dump policy, legacy database adoption and unknown-version refusal.

The maintainer confirmed manual installation checks and authorized publication on 2026-10-23. The [acceptance record](docs/ACCEPTANCE.md) separates that confirmation and observed build/download results from detailed OS, cloud, keystore and long-session checks that were not independently recorded. Package-manager submissions follow verified release assets and registry acceptance; no package-manager channel is published yet.

Version 1.0 remains for inspection. Owned observation resources are permitted; application publishing, purge, deletion and editing remain outside scope.

## 1.0.1 — inspection improvements and optional signed Windows downloads (published; no character name)

- [x] Always build unsigned variants independently on GitHub-hosted runners.
- [x] Isolated optional signing workflow with idle-runner preflight, queue watchdog, local certificate selection and signature checks.
- [x] Distinct signed asset names/checksums on the same release; no unsigned overwrite or automatic publication.
- [x] Adapt provenance to observed merged-PR metadata and unpublished drafts; bind the exact release ID/target and reject changed sources before upload. Covered by local synthetic-API tests.
- [x] Provision the self-hosted signing runner/settings and verify real signing/upload remotely.
- [ ] Complete the remaining offline/busy/inventory-error and watchdog race acceptance matrix; offline queued retries were cancelled manually.
- [x] Bump to 1.0.1 and remove releaseName.
- [x] Reuse the codesign runner label, subject/RFC3161 settings and SHA-256 signing convention from the supplied action; verify ZIP content matches the signed executable.
- [x] Reuse captures across Start/Stop, retaining history and unchanged stream/Kafka positions.
- [x] Guided host/port setup, preserved edit values, full-name tooltips and a resizable resource pane.
- [x] Resource/message-count filters, distinct routing-key inventory, selected bindings and manual direct/topic routes.
- [x] Newest/oldest-first paging across retained capture history.
- [x] Maintainer confirmed runner startup/configuration and authorized remote signing trials.
- [x] Merge release through PRs, build unsigned packages and verify all seven downloaded checksums.
- [x] Resolve runner account/PATH prerequisites; verify real signatures/uploads and publish with maintainer authorization.
- [ ] Record clean-machine signed installation, upgrade and installed-uninstaller acceptance.

Release 1.0.1 targets 7b8ff2f. Optional signing run 39956622696 attempt 6 passed on WIN_MBA: 97 unit tests, packaging, valid timestamped app/installer signatures, publisher verification, ZIP equality and signed upload. The release has nine packages and two checksum manifests. The maintainer explicitly authorized publication on 2026-10-23; no unrecorded manual installation result is inferred. See [release policy](docs/RELEASING.md).

## 1.0.2 — tray defaults and connection removal (published; no character name)

- [x] Keep running on window close by default for installations without saved desktop preferences; preserve saved choices and disable background close on corrupt preferences.
- [x] Add confirmed saved-connection removal: stop its captures, remove stored credentials and retain readable/exportable history without changing broker resources.
- [x] Verify macOS tray/default close/explicit Quit and EN/IT deletion interactions in light/dark layouts, including an 860px window; verify real RabbitMQ capture removal preserves 52 synthetic messages and no original-queue consumer.
- [x] Run automated Windows/macOS desktop smoke tests and the complete Linux desktop/broker suite through GitHub Actions.
- [ ] Complete manual Windows/Linux tray and desktop-environment acceptance.
- [x] Merge through reviewed PR #10, build via GitHub Actions, verify all nine downloaded package hashes and publish with the maintainer’s 2026-10-23 authorization.

Release 1.0.2 targets `8367103`. Unsigned run 40017079451 and signing run 40017961329 succeeded. All 99 unit tests pass on each platform; merged-main Checks run 40017079283 also passes 33 integration/eight Linux desktop tests and four desktop smoke tests on each of Windows and macOS. Signed Windows assets have valid timestamped app/installer signatures, verified publisher and matching ZIP application content. All nine downloaded package checksums match; the downloaded macOS application passed local session-only smoke checks. The public latest-release API, tag target and anonymous signed-manifest download are verified.

## After 1.0 — candidates, not commitments

Additional providers and payload decoders follow real requests. Extension points do not imply an executable plugin marketplace. Broker mutation features require a separate product decision.

## Versioning and maintenance

Follow SemVer 2.0.0. From 1.0, major/minor releases (patch zero) also carry a Star Wars character name: major 1 uses A, major 2 B, and so on. **1.0.0 is Ackbar.** Patch releases have no name; the current 0.x development milestones remain numeric. Store the chosen name as `releaseName` in package metadata for the named release, and remove it when bumping a patch. Tags and asset versions stay numeric SemVer; the app and GitHub Release title display the optional character name. Character authenticity is checked during release review; automated validation enforces the initial, patch rule and Ackbar for 1.0. Agree a continuation after Z before a major beyond 26. Use `0.x.y` while contracts evolve and prerelease suffixes such as `-alpha.1` where appropriate. Announce breaking pre-1.0 changes. From 1.0, incompatible public-contract changes require a major release, compatible features a minor release and compatible fixes a patch.

The public contract includes documented configuration schemas, dump formats and supported user-facing behavior. Version schemas independently and document migrations. Never silently discard connection data during upgrades.

All artifacts intended for distribution are built through GitHub Actions only after a pull request merges into `main`. Development/PR compilation tests do not package release artifacts. GitHub Releases provide installers/ZIP/DMG/TAR downloads before package-manager integrations are ready. 1.0.0 is unsigned by maintainer decision. From 1.0.1, optional verified Windows signing uses a self-hosted runner; no runner means unsigned output only. Remote unsigned packaging, actual Windows signing and signed upload are verified for 1.0.1; remaining manual platform checks stay explicit.

Update status when scope or release expectations change. Mark tasks complete only with implementation and verification evidence.
