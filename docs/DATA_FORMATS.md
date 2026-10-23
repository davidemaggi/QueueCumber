# Portable connections and captured messages

Dump schema 1 and connection container 1 were introduced in 0.2.0. Connection container 2 adds Kafka in 0.3.0; schema 1 dumps gain optional Kafka provenance. App versions use SemVer; file schemas have their own version. Unsupported configuration versions fail without importing anything. Keep a backup before upgrading early-development data; there is no migration from an unreleased prototype format.

## Connection configuration (`.qcc`)

Export and import from Settings. The complete file is encrypted, even when **Include credentials** is off. Passwords require at least 12 JavaScript characters and at most 1,024 UTF-8 bytes. Use a unique, strong password and transfer it separately from the file. QueueCumber does not save it.

The binary layout is:

| Byte range | Value |
| --- | --- |
| 0–7 | ASCII `QCBRCFG` followed by a zero byte |
| 8 | Container version: `1` (RabbitMQ) or `2` (mixed providers) |
| 9–24 | Random 16-byte scrypt salt |
| 25–36 | Random 12-byte AES-GCM nonce |
| 37–52 | 16-byte authentication tag |
| 53 onward | AES-256-GCM ciphertext |

Derive a 32-byte key with scrypt, `N=131072`, `r=8`, `p=1`. The implementation allows 256 MiB for the KDF and admits only one transfer operation at a time. The first 37 bytes are GCM additional authenticated data. Both versions fix these parameters; files cannot request arbitrary KDF costs. Fresh randomness is generated for each export.

Decrypted UTF-8 JSON contains `schemaVersion` matching the container byte (1 or 2), ISO `createdAt`, `includeSecrets` and `profiles`. Profiles follow the validated RabbitMQ connection schema: UUID `id`, `name`, `protocolUrl`, `managementUrl`, `allowInsecure`, optional `caPem`. The whole file is limited to 8 MiB and 100 profiles, with unique IDs; field and endpoint limits apply before import. Unknown schema fields are rejected.

Container 1 remains the output for RabbitMQ-only exports and is still readable by 0.2.0. Any Kafka profile selects container/schema 2, whose profiles discriminate with `provider: "kafka"` or optional `provider: "rabbitmq"`. Kafka profiles contain UUID `id`, `name`, `brokers` (1–20 validated host:port addresses), `tls`, `allowInsecure`, optional `caPem`, and optional strict `sasl` (`mechanism`, `username`, `password`). SASL mechanisms are PLAIN, SCRAM-SHA-256 or SCRAM-SHA-512. Secret-free exports remove Kafka SASL and custom CAs. Other encryption/KDF/file limits are unchanged. Older apps reject v2 before decrypting; keep backups before downgrading a vault containing Kafka profiles. No connections are silently discarded for compatibility.

Without secrets, export removes AMQP user/password, all AMQP URL query parameters and custom CA material. Management URLs cannot contain userinfo, queries or fragments in the connection schema. Names, hosts and vhosts remain private data and are still encrypted. Use **Edit connection** to supply complete endpoints, credentials and a CA again. The edit form never reloads saved secrets into the renderer.

Import shows names and conflicts before applying. Conflicts match the first existing profile with the same ID or name. **Keep both** gives imported profiles fresh IDs and unique names. **Skip** retains existing conflicts. **Replace** overwrites matching profiles while keeping their existing IDs. Processing follows file order, so earlier imported profiles participate in later name conflicts. The complete merged batch must validate and fit the limits before one atomic vault write. A changed connection list invalidates the preview; reopen the file. Previews expire after five minutes and tokens work once. Cancel discards the staged batch. Imports never connect automatically.

Capture limits, desktop preferences, OS keys and message history are excluded. In session-only mode, imported profiles last only until Quit. Temporary key/password byte buffers are cleared where practical; JavaScript strings and garbage-collected objects cannot promise secure erasure. No password recovery is provided.

## Message dumps

Dumps are **plaintext**, including ZIP. They export only locally retained records from one capture, never the original application queue backlog. One export runs at a time. The capture can continue, but new records beyond the starting upper ID are excluded. Records remain subject to retention and deletion during export; nothing pins the database or grows an export snapshot in memory.

| Format | Layout |
| --- | --- |
| JSONL | Initial manifest line, message lines with `payloadBase64`, final `type: "complete"` manifest line |
| Folder | `message-ID.bin` raw bytes, `message-ID.json` metadata, final `manifest.json` |
| ZIP | Same layout as folder, streamed ZIP64 archive |

IDs are local database record IDs, not broker delivery tags. Generated filenames never use routing keys or resource names. Folder exports create a generated child directory under the chosen parent. Files are staged beside the destination; successful completion renames them into place. Existing file destinations are preserved on failure/cancellation. A completed export may replace an existing file only after the native save dialog selects it. File/directory creation requests owner-only permissions; actual Windows access control follows the destination directory's ACL.

Each manifest has `schemaVersion: 1`, creation time, a starting session/provenance snapshot, retained `snapshot` (ID range, count, time range), `retentionPolicy` and `plaintext: true`. The final manifest adds `completedAt`, `recordsWritten` and `missingRecords`. Session metadata includes resource/vhost, connection ID, bindings or stream position, admission omissions and known capture gaps as observed at export start. `missingRecords` counts snapshot records removed before being written; it is separate from prior omissions or broker gaps. An interrupted JSONL file without a final complete line is incomplete. Folder/ZIP consumers should require the final manifest.

Message metadata includes `type: "message"`, `schemaVersion: 1`, local ID, capture/session ID, capture timestamp in epoch milliseconds, routing key, exchange, optional content type and stream offset, original byte size, optional omission reason, headers and SHA-256 of the retained payload. Oversized deliveries can retain an omission record with an empty payload: inspect `originalBytes` and `omission` instead of interpreting that as an original empty message. JSONL base64 decodes to the same bytes as `.bin` files. Payloads are never reformatted for export.

The root `headers` is a map. Each value preserves its type using these rules:

| Value | JSON encoding |
| --- | --- |
| Null, string, boolean, finite ordinary number | Native JSON value |
| Bytes | `{"type":"bytes","base64":"..."}` |
| Big integer | `{"type":"bigint","value":"decimal"}` |
| Undefined | `{"type":"undefined"}` |
| NaN, infinities, negative zero | `{"type":"number","value":"NaN\|Infinity\|-Infinity\|-0"}` (one value) |
| Date | `{"type":"date","value":"epoch milliseconds"}`; `NaN` represents an invalid date |
| Array | `{"type":"array","value":[encoded values]}` |
| Nested object | `{"type":"object","value":{"key":"encoded value"}}` |

Nested objects are always tagged, so a broker object shaped like a type tag is unambiguous. Nesting beyond 64 levels fails the export cleanly rather than silently losing data. Root properties are AMQP message properties; custom AMQP headers live inside their `headers` value.

The exporter reads one decrypted record at a time. JSONL base64 chunks use 48 KiB source slices; ZIP streams 64 KiB slices with backpressure. Headers and metadata remain bounded by capture admission limits. ZIP has a 10,000-message limit to bound its central-directory metadata; use JSONL or a folder for larger captures. Progress bytes count logical uncompressed output, so they are not a ZIP's compressed file size. The RAM cache setting does not cap total process RSS.

## Cancellation and recovery

Cancel stops the current job and removes its `.queuecumber-export-*` staging file/directory. Quit waits for export cancellation and broker cleanup. Existing completed exports stay untouched when a local capture is deleted. Export read/write failures, including disk full, fail the job and attempt staging cleanup. A cleanup failure is shown and blocks another export until interrupted-export recovery is resolved.

With OS-protected persistent storage, an authenticated encrypted journal records only the pending staging/destination paths. On restart, cleanup removes the validated staging path, never the destination. Corrupt, inaccessible or undecryptable journals require manual investigation of the chosen directory; they fail closed. After manually removing partial files, remove `export.pending` from QueueCumber's application data directory while the app is closed, then restart. Keep the completed destination if it exists.

In **session-only mode**, no recoverable path or encryption key is persisted. Normal cancel/Quit still cleans staging, but forced termination can leave plaintext `.queuecumber-export-*` files in the chosen directory. Remove them manually. Recovery is cleanup, not resumable export. Power-loss durability is not guaranteed by a successful rename; keep important dumps in your normal backup workflow.

## RabbitMQ stream positions

Beginning means the first message still retained by the broker. Live end requests `next`, receiving new messages only. Specific offsets accept safe integers in `0..9007199254740991`; larger AMQP integer offsets are refused to avoid silent precision loss.

On reconnect, the next requested offset follows the last locally processed delivery, including intentional admission drops. Duplicate offsets are skipped. A bounded first-retained-message probe detects positions removed from the prefix, and clamping/discontinuities remain visible. The probe holds at most one unacknowledged delivery for up to one second and closes its channel. Broker/version behavior can still change the actual position. On RabbitMQ 4.2 a future offset can wait; the UI marks it unverified until a delivery confirms it. Gap counters describe interruptions or discontinuities, not exact lost-message counts.

Stream reads check the actual queue type through management before consuming and again before acknowledging deliveries. Stream acknowledgements provide non-destructive flow control. QueueCumber writes no consumer-group offsets, creates no replacement stream and never falls back to consuming a classic/quorum application queue.

## Kafka provenance in dump schema 1

Kafka records add optional `kafka: {topic, partition, offset, timestamp, tombstone, transactional}`. Offsets and broker timestamps are decimal strings, preserving signed 64-bit values without JavaScript rounding; the usual record `timestamp` remains local epoch milliseconds. Kafka timestamps preserve producer `CreateTime` or broker `LogAppendTime`, according to the batch timestamp type. Original Kafka values become the payload bytes. A null value produces empty retained bytes with `tombstone: true`, distinct from an empty non-null value. `headers.key` contains the binary/null record key. `headers.kafkaHeaders` contains ordered `{key,value}` byte/null pairs, so duplicate names are preserved by the typed-header rules above. Dump consumers should tolerate optional provenance fields while continuing to require supported schema versions. See [Kafka semantics](KAFKA.md), including READ_UNCOMMITTED and per-partition ordering.

## Stable 1.x compatibility policy

QueueCumber 1.0 reads configuration containers 1 (RabbitMQ-only) and 2 (Kafka/mixed), dump schema 1, desktop preferences schema 1, settings schema 1 and encrypted session-catalog schema 1. Dump support describes writing/reading by external tools; importing a dump into local history is not implemented. RabbitMQ-only exports omit the provider discriminator to preserve the strict 0.2 container-1 wire schema.

During 1.x, supported portable configuration containers stay readable and dump changes stay additive/optional. Readers must ignore unknown optional dump fields, preserve typed values, and reject unsupported major schemas instead of guessing. A breaking documented contract change needs a new schema and application major version, with a migration procedure; schema numbers do not track app versions. Never silently discard imported profiles.

The SQLite index now uses `PRAGMA user_version=1`. Existing unversioned 0.3 databases are adopted after the same additive index/usage initialization, preserving encrypted records and keys; unknown versions are rejected before schema writes. This marker is not a new portable file format. Local history uses Node V8 serialization inside authenticated encrypted records and is machine-local, not a cross-runtime interchange contract. Upgrades must preserve supported data or provide an explicit migration; future runtime upgrades require compatibility tests. Export portable data before moving machines. Downgrading to 0.x after adopting 1.0 is unsupported.

Before upgrading, Quit and back up the entire user-data directory with its OS-account/keychain context. A copied encrypted database alone cannot recover a lost OS-protected key. Use password-encrypted `.qcc` for portable profiles and dumps for portable messages. Tests cover legacy database adoption, strict v1 profiles, v2 mixed round trips, tamper/wrong-password rejection and future-database refusal without changing bytes. Real packaged upgrades and OS-keystore recovery remain acceptance checks.
