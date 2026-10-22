# Roadmap

A proposed sequence, not a delivery calendar. No application milestone is complete yet.

## Foundation — in progress

- [x] Create and select `development`.
- [x] Replace generic ignore rules with project-focused rules.
- [x] Capture product requirements and AI conventions.
- [x] Draft README and architecture proposal.
- [x] Obtain architecture approval and confirm configurable resource budgets.
- [ ] Review the detailed MVP implementation plan before development.

## 0.1.0 — RabbitMQ MVP

- [ ] Electron/React shell, English plus an agreed second locale, light/dark/system theme.
- [ ] Secure saved connections, protocol/management endpoint tests and TLS validation.
- [ ] Discover/search queues, exchanges, streams and bindings through supported management APIs.
- [ ] Capture supported routes with owned temporary queues and visible coverage limitations.
- [ ] Inspect headers, raw payloads and size-limited formatted JSON.
- [ ] Bounded RAM and encrypted disk capture from the first working subscription, with validated configurable resource settings.
- [ ] Session cancellation, transient-failure retries and visible capture gaps.
- [ ] Integration tests proving original queues are never consumed or modified.

Exit gate: a usable RabbitMQ vertical slice, measured resource bounds and security checks on all three target operating systems. Publish a tested broker/authentication matrix.

## 0.2.0 — Longer sessions and portable data

- [ ] RabbitMQ stream reads from beginning, live end and explicit offset.
- [ ] Tray lifecycle and subscription status where supported; explicit Quit stops capture.
- [ ] Streaming JSONL, folder and ZIP exports with a versioned manifest.
- [ ] Password-encrypted configuration transfer and safe import conflict handling.
- [ ] Retention controls, disk-full behavior, cancelable exports and recovery tests.

Exit gate: long-session/reconnect tests, wrong-password and tampered-import rejection, tray validation across supported desktop environments.

## 0.3.0 — Kafka, without pretending it's RabbitMQ

- [ ] Second provider behind the shared capability interface.
- [ ] Topic/partition discovery and chosen per-partition start positions.
- [ ] Local inspection offsets; no commits to application consumer groups.
- [ ] Tested TLS/SASL and hosted-provider support matrix.
- [ ] Offset-retention gaps, partition changes and reconnect tests.

Exit gate: shared inspection workflows with explicit broker-specific semantics. No blanket promise of every cloud IAM mechanism.

## 1.0.0 — A release you can rely on

- [ ] Complete approved RabbitMQ and Kafka inspection scope.
- [ ] Keyboard/screen-reader checks, translation and theme review.
- [ ] IPC, credential protection, capture encryption and import/export security review.
- [ ] Meet documented resource budgets under sustained load.
- [ ] Tested Windows installers/archives, macOS DMG/archives and Linux packages/archives.
- [ ] Applicable signing, macOS notarization, checksums and release notes.
- [ ] Homebrew, WinGet and Chocolatey submission/verification, subject to registry requirements.
- [ ] Installation, permissions, capture limitations, retention and troubleshooting docs.
- [ ] Stable configuration/dump compatibility and migration behavior.

Version 1.0 remains for inspection. Owned observation resources are permitted; application publishing, purge, deletion and editing remain outside scope.

## After 1.0 — candidates, not commitments

Additional providers and payload decoders follow real requests. Extension points do not imply an executable plugin marketplace. Broker mutation features require a separate product decision.

## Versioning and maintenance

Follow SemVer 2.0.0. Use `0.x.y` while contracts evolve and prerelease suffixes such as `-alpha.1` where appropriate. Announce breaking pre-1.0 changes. From 1.0, incompatible public-contract changes require a major release, compatible features a minor release and compatible fixes a patch.

The public contract includes documented configuration schemas, dump formats and supported user-facing behavior. Version schemas independently and document migrations. Never silently discard connection data during upgrades.

Update status when scope or release expectations change. Mark tasks complete only with implementation and verification evidence.
