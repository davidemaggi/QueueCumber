# Local validation — RabbitMQ alpha

Checked on 2026-10-22 on macOS arm64 with Node 22.18, Electron 45 and a disposable RabbitMQ 4.2 management container. This is local alpha evidence, not a cross-platform release claim.

The suite passes 22 unit tests, 13 real-broker integration tests and two native Electron end-to-end tests. Type checking, ESLint, formatting and the production build pass. The unsigned macOS application bundle starts its capture utility successfully. The desktop tests use isolated session-only storage; they do not certify OS-keystore persistence.

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

Windows/Linux execution, real OS-keystore checks on all targets, hosted-provider authentication, signed installers and remote CI results remain unverified. Stream consumption, tray mode, dumps, password-encrypted configuration transfer and Kafka stay in their roadmap milestones. No release has been published.
