# Local validation — QueueCumber

Checked on 2026-10-22 on macOS arm64 with Node 22.18, Electron 45 and a disposable RabbitMQ 4.2 management container. This is local alpha evidence, not a cross-platform release claim.

The original MVP baseline passed 22 unit tests, 13 real-broker integration tests and two native Electron end-to-end tests. Later milestone results appear below. Type checking, ESLint, formatting and the production build passed. The unsigned macOS application bundle started its capture utility successfully. Desktop tests use isolated session-only storage; they do not certify OS-keystore persistence.

## What the tests cover

- Encryption authentication and tamper rejection, encrypted profile persistence and serialized saves.
- Global/session cache and disk budgets, retention expiry, raw-byte round trips and bounded paging.
- Encrypted session catalog recovery without automatic broker reconnection.
- Direct, topic, fanout and headers bindings; originals keep their backlog and have no QueueCumber consumer.
- Independent AMQP/management endpoint tests, denied management access and custom-CA HTTPS validation.
- Pagination when queue/exchange collection lengths differ, partial binding setup cleanup and reconnect with changed bindings.
- UI selection races, payloads containing script text rendered as data, locale/theme changes, limit confirmation, sandbox isolation and a visible utility-process failure.

## Resource measurement

The real-AMQP test publishes 12 messages through two simultaneous observation sessions: 24 deliveries, with repeated payload sizes of 64 B, 1 MiB, 16 MiB and 20 MiB. The fixture allows 32 MiB broker messages. App limits use a 32 MiB cache, 128 MiB disk quota and the default 16 MiB retained-payload maximum.

On the recorded run, each session retained/admitted nine messages and omitted three oversized payloads. Retention evicted six records across the workload. The encrypted database finished at 71,516,160 bytes; the cache stayed within budget. The run took about 2.1 seconds. This small sequential synthetic workload does not establish a sustained throughput rating.

The test-process RSS started at 148,307,968 bytes and peaked at a sampled 374,259,712 bytes; the OS high-water mark was 365,488 KiB. Sampling runs every 5 ms and at delivery checkpoints; the OS metric also catches allocation peaks between samples. This process includes the publisher, two consumers, storage and the test runner, and the high-water mark can include the earlier storage saturation test in the same file. It excludes Electron's other processes and the broker. Client/decryption allocations occur before admission: the cache setting cannot promise a total RSS ceiling. Metrics are generated in the OS temporary directory by `tests/integration/capture-load.test.ts`.

## Independent review outcomes

No Critical findings. All seven Important findings were addressed in one correction pass:

| Finding | Resolution and evidence |
| --- | --- |
| Discovery fails when one collection exhausts earlier | Parse RabbitMQ's `page_out_of_range` error; real 101-queue pagination regression changed from failing to passing. |
| Persisted captures cannot be reopened after restart | Encrypt and restore a bounded session catalog; restart recovery regression changed from failing to passing. |
| Truncated preview hides remaining original bytes | Add validated 64 KiB raw-byte IPC pages and hex/ASCII navigation; complete binary reconstruction and UI paging regressions pass. |
| Late UI responses attach to a different selection | Invalidate pending binding/message/start results on navigation; all three reproduced race regressions changed from failing to passing. |
| Reconnect binding changes are invisible | Display the session's current snapshot, topology-change notice and actual capture restart timestamp; broker reconnect and UI regressions pass. |
| Session expiry misses eviction accounting/cache cleanup | Count expired rows, invalidate cache and show retained counts/range; expiry regression changed from failing to passing. |
| Resource evidence excludes real client allocations | Add the two-session, large/oversized AMQP workload and RSS/high-water measurement above. |

The reviewer also requested partial setup failure coverage; an integration test verifies that a failed later binding removes the already-created observation queue. The final tests verify the fixes; no second independent review was performed.

One Minor UI finding is deferred: narrow desktop windows stack the detail below the message list and have awkward nested scrolling. Light/dark dense capture screens were inspected at 1440 px and the narrower 1000 px layout; the latter needs a focused layout follow-up before release. Taste lint reported no failures; identifier/code monospace and missing-value dashes are intentional exceptions to two stylistic warnings.

## Release gates still open

Windows/Linux execution, real OS-keystore checks on all targets, hosted-provider authentication, signed installers and remote CI results remain unverified. Kafka remains in its roadmap milestone. No release has been published.

## Release automation preparation

A later local check on the same date adds six release-tool tests (28 unit tests total). They cover required Azure settings and endpoint restrictions, SemVer matching, real temporary Git tag ancestry/version checks, deterministic checksums, and signature-verifier failure handling with a mocked PowerShell certificate provider. The mock does not validate a real Authenticode signature or Azure authentication.

The merged Windows signing configuration passes the schema validator of the installed electron-builder 26.15.3, preserving the shared targets and requiring code signing. Both Actions workflows pass actionlint 1.7.7. Lint, type checking, formatting and the production build pass. No release tags, Azure resources, remote workflow runs or GitHub Releases were created. The first real Azure-signed Windows build and the configured macOS/Linux distributable formats still need runner and clean-machine verification. See [release workflow notes](RELEASING.md).

Independent review of the release workflow found one Important blocker: DEB packaging lacked a maintainer email. The maintainer supplied `me@davidemaggi.dev`; package metadata now includes it and the public repository URL. The installed builder's DEB metadata check passes after the fix. No Critical or additional Minor findings were established. This metadata check does not replace an actual Linux package build/install.


## Background desktop capture

The next local slice adds opt-in background close, localized native tray session status, versioned desktop preferences and explicit Quit cleanup. Close-to-background defaults to false. On Linux or when tray creation fails, the close action minimizes instead of hiding the only window, retaining an accessible route. A created Linux tray does not prove that the desktop has a visible tray host.

Local verification: 34 unit tests, four native Electron tests, type checking, lint and production build. A real RabbitMQ message is captured after the window closes into background; the original queue still has zero QueueCumber consumers. Quit with an active capture removes the observation consumers. Native tests cover reopen, preference/language persistence, default close and explicit Quit. Unit tests cover minimized fallbacks, bounded localized menu entries, independent status polling, utility failure and one-shot shutdown. Settings were inspected in light/dark themes and the narrower desktop layout. Windows and actual Linux tray behavior remain unverified here; their native background smoke test is included in CI. Machine sleep, OS forced termination and service recovery are not promises of uninterrupted capture.

Independent lifecycle review found one Important settings race: changing language during a pending background preference save could restore a stale close behavior. A delayed-save regression first failed, then passed after disabling language changes while settings operations are busy. No Critical or additional confirmed lifecycle/shutdown findings.

Narrow-layout screenshot review also exposed clipped Italian navigation labels; allowing the navigation row to wrap keeps both actions visible. Existing narrow message-pane scrolling remains the separate deferred UI issue documented above.

## Complete 0.2.0 functionality

The full local milestone passes **50 unit tests, 21 integration tests and six native Electron tests**. Type checking, ESLint, formatting, production build and actionlint 1.7.7 pass. CI now includes encrypted connection transfer on Windows/macOS as well as the Linux full suite; these remote runs remain unexecuted here. Version `0.2.0` is development metadata, with no tag, push or published release implied.

Additional coverage:

- Complete encrypted connection-container round trips with fixed scrypt/AES-GCM, fresh randomness, default secret exclusion, wrong password, tampering, unsupported version and size/endpoint rejection.
- Atomic batch import, conflict modes, serialized concurrent saves, stale-preview rejection and single-use tokens. Native export/import/copy and editing imported credentials without loading stored secrets into the form.
- JSONL/folder/ZIP raw-byte and binary/big-integer header fidelity, generated filenames and provenance. Immediate and mid-job cancellation in all three formats, overlapping-job rejection, missing destination and injected ENOSPC during an actual staged write, preserving existing files and cleaning partial output.
- Retention/deletion during export with explicit missing-record counts and no snapshot pinning. Authenticated encrypted recovery-journal cleanup, destination preservation and corrupt-journal refusal.
- A forced Node child-process kill after committed encrypted SQLite records and an uncommitted transaction: reopening preserves committed records, rolls back the incomplete transaction and exposes no synthetic plaintext in database files. This tests process crash recovery, not sudden power loss or OS-keystore integration.
- RabbitMQ 4.2 stream first/live/exact positions, independent replay proving the log remains intact, forged classic-queue resource refusal, reconnect without duplicate local offsets, deletion failure and retained-prefix clamping. Numeric future offsets remain visibly unverified while waiting for data.
- Native stream positioning, all three exports and deleting local history while retaining the broker stream. Settings/import conflict preview inspected in light/dark themes and at 1000 px in Italian; stream/export inspection in the light theme. Existing dense capture screens also cover dark/narrow layouts. Narrow panes remain scrollable with the previously documented layout follow-up.

The retained-prefix test initially exposed a fixture issue: a single coalesced publish batch could remain one oversized log segment. It now confirms small batches to force segment rolls before asserting retention. The actual prefix probe reads at most one message without acknowledging it, then closes the channel. A future offset is not declared exact before the broker delivers it.

### Export resource measurement

`tests/integration/export-load.test.ts` stores 1,024 synthetic random payloads of 65,536 bytes (64 MiB total), then exports each format sequentially with a 16 MiB cache. Each output contains all 1,024 records, zero retention misses, and a largest payload working record of 65,536 bytes. It verifies the storage cache remains within its configured budget. JSONL uses chunked base64; folder/ZIP use raw bytes.

One recorded run on this machine:

| Format | Duration | Output bytes | Baseline / peak sampled RSS |
| --- | --- | --- | --- |
| JSONL | 220 ms | 89,773,831 | 195,067,904 / 209,403,904 |
| Folder | 354 ms | 67,380,690 logical bytes | 209,518,592 / 209,829,888 |
| ZIP | 1,286 ms | 67,605,176 | 212,516,864 / 224,395,264 |

The OS-temp `queuecumber-export-metrics.json` contains each run's full timings, sampled RSS and OS high-water marks. Samples occur every 5 ms; the process includes storage and the test runner, and later formats inherit earlier allocations. ZIP metadata is additionally capped at 10,000 messages. This finite sequential workload demonstrates streaming behavior; it does not establish a universal throughput or total-RSS guarantee. The broker/client allocation measurement above remains a separate capture workload.

Persistent mode cleans interrupted plaintext exports through its encrypted journal on restart. Session-only mode cannot retain a recoverable key/path after forced termination; partial files can remain beside the chosen destination, as documented in [data formats](DATA_FORMATS.md). Normal cancellation and Quit clean them in either mode. Sleep/resume, real platform tray visibility and power-loss durability remain outside the local proof.

### Final independent review

One fresh-context reviewer inspected the complete 0.2.0 implementation, connected callers, formats and regressions. It found no Critical issues and one preview discrepancy: two incoming profiles sharing a name were not marked as conflicting with each other, although Skip/Replace subsequently merged them. This was treated as a required correctness fix because the preview must disclose possible discarded/replaced profiles. A regression first failed on the missing warning, then passed for preview and copy/skip/replace results after tracking earlier incoming names. The full suite was rerun after the fix; no second review was commissioned.

The review also checked and set aside four suspected problems: prefetch(1) bounds the stream's pending delivery; management validation guards consumer setup without per-message HTTP calls; cancellation at final rename has an ordinary completion boundary; and forced-crash session-only partials are an explicit recovery limitation. Platform/keystore/cloud/release validation remains a separate external gate, not an assumed success. The narrow-pane scrolling follow-up from the MVP review remains deferred; no new UI redesign was included.
