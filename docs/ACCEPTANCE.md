# Release acceptance checklist

Release **[1.0.1](https://github.com/davidemaggi/QueueCumber/releases/tag/v1.0.1)** was published on 2026-10-23 with explicit maintainer authorization. Its merged source, hosted checks, seven unsigned packages and two Windows signed packages are verified in VALIDATION.md. Windows app/installer signatures are valid, timestamped and publisher-matched; ZIP equality and all nine downloaded checksums passed. Detailed clean-machine install/upgrade/installed-uninstaller results remain unrecorded. The historical checklist below records 1.0.0 acceptance and outstanding broader checks; it does not silently mark them passed for 1.0.1.

Published release: **[1.0.0 — Ackbar](https://github.com/davidemaggi/QueueCumber/releases/tag/v1.0.0)**, 2026-10-23. The maintainer confirmed manual installation acceptance; detailed unchecked entries remain unrecorded validation, rather than automatic claims of platform certification. Local implementation verification is in [VALIDATION.md](VALIDATION.md); checking code does not establish installer, hardware, keystore or cloud compatibility.

On 2026-10-23 the maintainer confirmed the manual installation checks were complete and explicitly authorized publication, then requested the supplied icon/mark be included first. No exact OS-version matrix was supplied; do not infer additional platform/cloud certification from that confirmation. Rebuild the artwork update through merged-main Actions and recheck its packages before publishing; no further publication approval is required.

Record each test's OS/version/architecture, app commit/artifact hash, broker/provider version, result and sanitized evidence. Mark failures explicitly. Do not paste secrets, connection strings or private messages. Keep private account/signing instructions in ignored `maintainer-local/`.

## Before merging the release PR

- [x] Review normal Checks on the exact proposed source; ensure no private data or unrelated skills were accidentally included.
- [x] Confirm the maintainer-approved unsigned 1.0.0 scope; no Azure/Apple signing credentials are required.
- [ ] For future 1.0.1+ signed Windows variants, configure the repository-visible self-hosted runner and settings described in RELEASING.md. Verify offline/busy/missing/inventory-error cases leave unsigned output unaffected, and runner disappearance cancels only the optional workflow observed queued. Check the jobs-API outage path: uncertainty must not cancel a potentially active signer; monitor any queued optional job manually.
- [ ] Ensure this workflow exists on the default branch, protect main and version tags, and confirm the PR merge event is the only distribution trigger. The release workflow builds the immutable merge SHA, not a moving branch.
- [ ] Review 1.0.0 Ackbar release notes, this supported-target policy and documented limits. Preserve a complete pre-upgrade backup. Package metadata alone does not publish a release.

## After merge: Actions and downloaded artifacts

- [x] All release jobs succeed for artwork merge SHA bdc7063386baf58b052ad0ea1ad6798882911569 (run 39928358358). Unsigned builds must succeed without signing settings. Optional signing failures must never create falsely signed assets or block unsigned downloads.
- [x] Draft target is the merge SHA; title is `v1.0.0 — Ackbar`; correct versions/architectures appear in asset names and the tested macOS app metadata.
- [x] After publication, confirm the Git tag resolves to that merge SHA. Public v1.0.0 resolves to bdc7063386baf58b052ad0ea1ad6798882911569.
- [x] Verify every downloaded asset against SHA256SUMS.txt (all seven final packages passed). Confirm the release includes expected installer/archive variants and no test broker secrets or local maintainer files.
- [ ] Windows x64: install NSIS and extract ZIP on a clean supported system. Record unsigned status for the unsigned build; when signed variants exist, verify app, installed uninstaller and installer Authenticode status/publisher; capture in the packaged utility process. Test upgrade, uninstall and retained-user-data policy.
- [ ] macOS arm64: record the unsigned/ad-hoc build and expected Gatekeeper behavior; verify Developer ID/notarization only if a future trusted macOS-signed channel is implemented on a clean supported Mac, including launch while offline. Test Applications installation, packaged capture, upgrade and uninstall/data policy.
- [ ] Linux x64: test DEB, AppImage and tar.gz on the supported distributions/desktops you intend to list. Check runtime libraries, sandbox, FUSE where needed, upgrade/uninstall and paths. Do not disable Chromium sandboxing to pass.
- [ ] Record exact supported OS versions and architectures in release notes. Do not advertise untested architectures/platform versions.

## Keys, data and content

- [ ] On each OS, save private synthetic profiles in secure mode, Quit/restart and reopen encrypted retained history. Confirm no secrets/plaintext payloads in app data/logs; inspect OS-key storage and directory/file permissions.
- [ ] Linux: locked/missing keyring and basic_text fallback do not silently enable insecure persistence. Session-only mode is visible; no profiles survive a fresh session.
- [ ] Lock keychain / deny access / corrupt synthetic vault copy: fail closed without overwriting the original. Restore the complete backup on the original machine/account.
- [ ] Upgrade a copy of 0.3 profiles, settings, desktop preferences and RabbitMQ/Kafka history. Byte fidelity remains intact; histories are stopped. Test original v1 and mixed v2 configuration transfer. Wrong password/tampering leaves saved profiles unchanged.
- [ ] Test huge/binary/invalid-UTF8/JSON/HTML-like content and repeated headers; nothing executes or navigates. Confirm previews/chunks stay bounded and raw exports preserve bytes.
- [ ] Verify cancellation, missing/writable destinations, disk full, retention during export and restart cleanup. Forced session-only crash plaintext-partial limitations must match the guide.
- [ ] Recheck the known moderate build-only `sprintf-js` advisory GHSA-hp3w-g68c-fv3c and upstream patch availability; see VALIDATION.md. No known production advisory was reported by the local snapshot.
- [ ] Review the threat model in SECURITY.md, dependency/security advisories, IPC boundary and shipped license notices before approving public release.

## Real brokers and long sessions

- [ ] RabbitMQ self-hosted and intended hosted endpoint: AMQPS + HTTPS, correct/wrong hostname/CA/password, scoped management/AMQP permissions, direct/topic/fanout/headers and partial-route warnings. Original classic/quorum application queue has no QueueCumber consumer and application messages remain intact.
- [ ] RabbitMQ stream: beginning/live/specific positions, retention, reconnect, log intact after ACK credit, app consumer offsets untouched. Reject classic queues forged as streams.
- [ ] Kafka intended versions and multi-broker cluster: advertised hosts, leaders changing, TLS/SASL mechanism, correct/wrong credentials and ACL denial. No new group or committed offsets; inspect broker audit logs where available.
- [ ] Kafka retention/compaction/topic recreation/new partitions and CreateTime/LogAppendTime metadata behave as documented; transactional records follow READ_UNCOMMITTED.
- [ ] Run a representative sustained session (at least one hour; longer if your intended use requires it) with multiple captures, traffic bursts, oversized messages, bounded cache/disk, rate omissions and retention. Record throughput, peak RSS, disk growth and UI responsiveness; cache is not total RSS.
- [ ] Disconnect/restart brokers, lose networking, sleep/wake the machine and kill the utility/app in a disposable run. Confirm visible failures/gaps, bounded retries, stopped restored histories and no promise of capture during sleep/process death.

## Desktop and accessibility

- [ ] English/Italian in light/dark/system themes: empty, loading, offline, permission error, active/reconnecting/failed/stopped, dense lists, long names and large counters.
- [ ] Keyboard only: Add/Edit connection, form errors/cancel, resource search/selection, partition controls, start/stop, message arrows/Home/End, payload/header/raw paging, settings, import preview and export cancellation. Tab leaves the message list; focus remains visible.
- [ ] VoiceOver on macOS, NVDA on Windows and a Linux screen reader: names, landmarks, selected/pressed states, list positions and error/status announcements. Automated DOM/keyboard checks do not substitute for assistive-technology use.
- [ ] Supported minimum window size, 1000 px narrow layout, display scaling/high contrast and reduced motion. Reach every control and payload without clipped content. Inspect contrast in rendered target environments.
- [ ] Background close opt-in/default Quit, tray sessions, reopen and explicit Quit on real Windows/macOS desktops. On Linux/no tray host, minimize retains an accessible route. Confirm no capture or owned queue remains after explicit Quit.

## Publication and package managers

- [x] Resolve failed gates or explicitly adjust/document supported scope before publishing. Maintainer acceptance and publication authorization were confirmed on 2026-10-23; no exact OS-version/cloud certification was added. The maintainer explicitly permits unsigned 1.0.0; lack of optional signed variants is not a blocking gate. Review the draft manually; publishing is a separate maintainer action.
- [x] Publish the approved GitHub Release, then verify public download links/checksums from a fresh client (anonymous manifest and release API checks passed).
- [ ] Prepare Homebrew cask using the actual published DMG URL/hash/version and verified architecture. Test install/uninstall/audit before submitting.
- [x] Prepare WinGet manifest using actual signed installer URL/hash, installer type/scope and publisher; validate/install before submission. Automated in `package-managers.yml`; dry run against v1.0.4.
- [ ] Prepare Chocolatey package using actual published installer URL/hash and silent arguments verified against the built NSIS installer. Install/uninstall are automated in `package-managers.yml` (dry run against v1.0.4); upgrade remains untested.
- [ ] Add package-manager instructions to README only after acceptance by that registry. No fabricated URLs, hashes or install commands.

Passing these gates is the maintainer's release decision. The maintainer made that decision explicitly for 1.0.0; future releases require their own acceptance decision, rather than inference from a code commit.
