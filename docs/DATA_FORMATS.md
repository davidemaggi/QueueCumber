# Portable connections and captured messages

These are version 1 formats introduced by the 0.2.0 development milestone. App versions use SemVer; file schemas have their own version. Unsupported configuration versions fail without importing anything. Keep a backup before upgrading early-development data; there is no migration from an unreleased prototype format.

## Connection configuration (`.qcc`)

Export and import from Settings. The complete file is encrypted, even when **Include credentials** is off. Passwords require at least 12 JavaScript characters and at most 1,024 UTF-8 bytes. Use a unique, strong password and transfer it separately from the file. QueueCumber does not save it.

The binary layout is:

| Byte range | Value |
| --- | --- |
| 0–7 | ASCII `QCBRCFG` followed by a zero byte |
| 8 | Container version: `1` |
| 9–24 | Random 16-byte scrypt salt |
| 25–36 | Random 12-byte AES-GCM nonce |
| 37–52 | 16-byte authentication tag |
| 53 onward | AES-256-GCM ciphertext |

Derive a 32-byte key with scrypt, `N=131072`, `r=8`, `p=1`. The implementation allows 256 MiB for the KDF and admits only one transfer operation at a time. The first 37 bytes are GCM additional authenticated data. Version 1 fixes these parameters; files cannot request arbitrary KDF costs. Fresh randomness is generated for each export.

Decrypted UTF-8 JSON contains `schemaVersion: 1`, ISO `createdAt`, `includeSecrets` and `profiles`. Profiles follow the validated RabbitMQ connection schema: UUID `id`, `name`, `protocolUrl`, `managementUrl`, `allowInsecure`, optional `caPem`. The whole file is limited to 8 MiB and 100 profiles, with unique IDs; field and endpoint limits apply before import. Unknown schema fields are rejected.

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
