# QueueCumber 1.0.0 — Ackbar

Prepared release notes for maintainer review. No public release is implied by this document.

A little less queue confusion. Ackbar brings RabbitMQ and Kafka inspection to one local desktop app.

- Encrypted connection profiles, independent endpoint tests and password-protected configuration transfer.
- RabbitMQ observation queues that mirror supported routes without consuming application queues, plus stream positioning.
- Kafka topic/partition discovery and independent 64-bit local offsets, with TLS/SASL support and no consumer-group commits.
- Bounded encrypted captures, visible gaps/omissions/retention, structured headers and original bytes alongside JSON previews.
- Streaming JSONL/folder/ZIP exports, cancel/recovery behavior and retained-history controls.
- Opt-in background capture/tray status, English/Italian, light/dark/system themes and keyboard message navigation.

## Downloads and validation

Planned first targets: Windows x64 installer/ZIP, macOS arm64 DMG/ZIP, Linux x64 AppImage/DEB/tar.gz. All artifacts come from the merged-main GitHub Actions run. The maintainer approved unsigned 1.0.0 downloads; names explicitly say unsigned. macOS uses ad-hoc signing, without Developer ID/notarization. Windows-signed variants are planned from 1.0.1 when a self-hosted signing runner is available. Validate downloaded SHA256SUMS.txt; unsigned builds have no verified publisher signature.

The maintainer must replace this paragraph with the actual tested OS/broker matrix and accepted gate results from [ACCEPTANCE.md](ACCEPTANCE.md) before publishing. Package-manager channels follow registry verification; there is no automatic updater.

## Read before capture

Queue observation sees future routed traffic, not application backlog, and adds broker load/topology. Some exchange semantics cannot be mirrored. Kafka uses READ_UNCOMMITTED; offsets are local and partition-scoped. Reconnect/retention can leave gaps. Captures and cache budgets are finite; total process RSS also includes clients/Electron. Restarts restore stopped history rather than restarting subscriptions.

Dumps are plaintext, including ordinary ZIP files. Session-only forced termination may leave partial dumps beside the chosen destination. Real hosted IAM/OAuth/mutual-TLS mechanisms are not implemented. See the [guide](USER_GUIDE.md), [Kafka semantics](KAFKA.md), [RabbitMQ permissions](RABBITMQ.md) and [security policy](../SECURITY.md).

## Compatibility

No data rewrite is required from 0.3. Existing encrypted profiles/history use the same key protection and record format. Legacy SQLite databases gain schema marker 1; future unknown database versions are refused. Configuration containers 1 (RabbitMQ) and 2 (Kafka/mixed), dump schema 1 and desktop preferences 1 remain supported. Back up early-development data before upgrading; downgrade into 0.x is unsupported. See [stable contracts](DATA_FORMATS.md#stable-1x-compatibility-policy).
