# Local validation — QueueCumber

## First release draft — 2026-10-23

[Release build 39917615830](https://github.com/davidemaggi/QueueCumber/actions/runs/39917615830) succeeded for merge commit `a785bcbf0585392292d2d894805c82e81a790382`. The [1.0.0 Ackbar draft](https://github.com/davidemaggi/QueueCumber/releases) contains seven unsigned packages plus SHA256SUMS.txt: Windows x64 NSIS/ZIP, macOS arm64 DMG/ZIP and Linux x64 AppImage/DEB/tar.gz. All seven downloaded files passed `shasum -a 256 -c SHA256SUMS.txt`. The macOS ZIP passed codesign deep/strict verification after extraction. This is ad-hoc integrity, not Developer ID/notarization or publisher trust.

The actual downloaded macOS application (version 1.0.0) launched its packaged utility service, replayed the local RabbitMQ stream, rendered JSON and stopped capture. This used isolated session-only data on the development Mac, not a clean installation or an OS-keystore persistence test. Hosted source Checks passed on Windows/macOS/Linux before every corrective merge. The optional signer was skipped for unsigned 1.0.0. Public publication and the manual acceptance checklist remain pending.

GitHub's draft reserves tagName v1.0.0 and targets the exact merge SHA; the Git ref does not exist until publication. Also, the observed merged-PR workflow_run metadata uses the PR head branch. Both observations are recorded as required 1.0.1 signer follow-up work; do not enable that unverified path yet.

## Guided connections and local demo — 2026-10-23

The new two-step RabbitMQ form and advanced URL mode were checked on macOS arm64 with pnpm 12.15.0. The unit suite passed 83 tests. All 32 real-broker integration tests passed against the local RabbitMQ/Kafka 4.2 fixtures, including reusable demo topology, future queue observation, RabbitMQ stream replay and both Kafka partitions. Type checking, ESLint, formatting, build and dependency audit passed; the audit reported no known vulnerabilities in this snapshot.

All eight native Electron tests passed. Native verification covers saving separate credentials, automatic selection/discovery, stream positioning and capture of seeded JSON. Actual light English, dark Italian and 1000 px narrow form screenshots were inspected. Stored credentials remain absent from the edit form. An independent final review found one virtual-host normalization bug: guided input `.` or `..` could silently target `/`. A new test reproduced it, then passed after explicit rejection; the full unit suite remained green. No other actionable review findings were reported.

The demo publisher is a developer-only fixture with fixed loopback targets and synthetic credentials, outside the shipped app. Queue/log retention is bounded. These checks do not certify OS-backed persistence, clean-machine installation, cloud environments or Windows/Linux desktop behavior; the acceptance checklist remains the record for those checks.

The first hosted Windows run exposed missing Git line-ending attributes: checkout converted source to CRLF and Prettier rejected 103 files. The repository now specifies LF for automatically detected text files, preserving binary assets. Hosted verification on the corrected commit is recorded through the release PR checks.

A subsequent Windows PR job exceeded the 15-second test timeout during the 200-write encrypted SQLite eviction workload; the parallel push job passed it. This test exercises FULL-synchronous disk writes rather than a throughput guarantee. Its timeout is now scoped to 60 seconds, with all encryption, cache, disk and eviction assertions unchanged; the rest of the suite retains its existing timeout.

The first release PR passed hosted Checks on Windows, macOS and Linux and merged as `08675f4`. The first distribution run was cancelled before creating a release/tag after verification of the downloaded macOS ZIP failed: electron-builder skipped ad-hoc signing because the trigger was a merged PR. The corrected workflow enables the configured ad-hoc identity for the validated macOS merge build and adds a mandatory codesign integrity check before artifact upload. Do not use artifacts from the cancelled run.

The next macOS build correctly entered signing but rejected the workflow's empty `CSC_LINK` as a directory rather than a certificate file. Certificate-link variables were removed from the unsigned workflow; the explicit ad-hoc identity and disabled identity discovery remain. The failed run created no release/tag.

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

## Complete 0.3.0 functionality

The Kafka milestone adds a second provider to the existing encrypted history, bounded storage, exports and desktop lifecycle. Local verification runs on macOS arm64 with Node 22.18.0, Electron 45, RabbitMQ 4.2 and Apache Kafka 4.2.0 in disposable loopback-only containers. The final full run passes **62 unit tests, 30 integration tests and seven native Electron tests**. Type checking, ESLint, formatting, development production compilation and actionlint 1.7.7 pass. The following evidence supersedes the earlier note that Kafka is pending; hosted and platform gates remain open.

Coverage includes:

- Kafka profile validation, full-width decimal offsets, unique bounded partition selections, legacy RabbitMQ profiles and encrypted mixed-provider configuration round trips. RabbitMQ-only exports retain container 1 and omit the new provider discriminator, preserving the original strict 0.2 wire format; Kafka/mixed exports use container 2.
- Real topic/partition discovery and beginning/live/specific positions, with unchanged broker group listings. The implementation calls direct metadata/ListOffsets/Fetch methods; it does not subscribe, join groups or commit offsets.
- Verified custom-CA TLS and actual record reads using no SASL, PLAIN, SCRAM-SHA-256 and SCRAM-SHA-512. Wrong CA/password rejection, socket loss/reconnect, initial-connection cancellation, topic deletion, retained-prefix/future clamping and added-partition notices.
- Compressed values, binary keys, repeated binary headers, null tombstones versus empty values and exported provenance. Both producer CreateTime and broker LogAppendTime are tested. Focused driver tests cover compacted tails, topic recreation, shrinking log ends, offsets beyond JavaScript's safe-number range and storage failure.
- A native Electron Kafka workflow creates a connection, selects different partition starts, captures five expected records, inspects JSON and exports JSONL. Light/dark and 1000 px Italian screens were inspected alongside the existing RabbitMQ, stream, import/export and background/Quit regressions. These tests use isolated session-only storage, not the real OS keystore.
- Release validation uses temporary Git repositories and synthetic merged-PR events to check merge SHA, main ancestry, event/base guards and existing tag conflicts. Distribution is restricted to a merged PR into main; no distribution build, push, tag, Azure resource, remote Action or GitHub Release was created locally.
- Release-name rules cover Ackbar for 1.0.0, major-letter initials, missing/unsafe names and unnamed patches. Current 0.x milestones stay numeric. Real Star Wars character selection remains a release-review responsibility; automated checks enforce syntax and initial rather than a character database.

### Capture measurement and fixture diagnosis

A recorded synthetic Kafka workload captures 128 messages of 256 KiB (32 MiB total) using a 1 MiB cache and 8 MiB disk budget. One run took 4,587 ms, with sampled RSS from 122,486,784 to 199,802,880 bytes, a 195,120 KiB OS high-water mark, zero final cache bytes, 5,050,368 retained disk bytes and 109 evictions. The test samples every 5 ms and includes its publisher, storage and test runner; it excludes Electron and the broker. Results vary between runs. The OS-temp `queuecumber-kafka-metrics.json` records the latest run.

This proves finite retention for that workload, not a universal throughput or RSS ceiling. Fetch requests target one partition sequentially with 1 MiB budgets; a broker can return an oversized first batch and the client allocates/decompresses before admission. Up to 128 selected partitions and 100 ms idle waits trade throughput for bounded application work. READ_UNCOMMITTED intentionally includes transactional records that may later abort. See [Kafka semantics and tested matrix](KAFKA.md).

An intermittent native fixture failure initially returned eight records where five were expected. Repeated diagnostics showed an end offset of six on one partition before the app started: the fixture publisher had retried a produce batch. Test publishers now use idempotence and assert broker end offsets before launching Electron. Three consecutive focused native runs passed after that fixture correction; diagnostic logs were removed.

### Final independent review and corrections

One fresh-context reviewer inspected the complete change and connected callers, including the original v1 format, client internals and release workflow. It found no Critical issues, two Important issues and two Minor issues. All four were fixed in one correction pass:

1. RabbitMQ-only exports included an unknown provider field rejected by 0.2. A strict legacy-schema regression failed first, then passed for exports with and without credentials after stripping the discriminator only from v1 serialization.
2. LogAppendTime used producer deltas. A focused batch regression failed first; the fix selects the batch maximum timestamp when the append-time bit is set. A real LogAppendTime topic verifies the retained timestamp falls within the broker publish interval.
3. Reopening an active topic through the resource list displayed a fabricated all-partition/live selection. This was treated as a required functional fix because it misrepresented capture coverage. A failing UI regression now verifies the actual subset and original start offsets are restored.
4. A topic/queue filter persisted across providers and hid the other provider's resources. This was treated as required navigation correctness. A failing UI regression now passes in both directions; connection and history selection reset the filter.

The reviewer set aside documented sequential-fetch/allocation tradeoffs, intentional uncommitted/control-batch semantics, synthetic fixture mutations and already-merged fork release context. No second review was commissioned. The inherited narrow-pane nested scrolling follow-up remains deferred. Real cloud accounts, multi-broker clusters, Windows/Linux execution, real platform keystores, signing/notarization, clean-machine installs and remote Actions execution remain external gates before 1.0.

## 1.0.0 Ackbar — prepared for maintainer acceptance

The maintainer authorized complete local 1.0 hardening and will perform the external acceptance checks after implementation. Package metadata is now `1.0.0` with `releaseName: Ackbar`; no tag, merge, push, distribution build or publication is implied. **Final local checks pass: 72 unit tests, 31 real-broker integration tests and seven native Electron tests**, plus type checking, ESLint, formatting, production compilation and actionlint 1.7.7. The final review correction changes only renderer selection; unit/native checks were rerun after it, with no broker behavior changed after the 31-test integration pass. This status does not certify Windows/Linux, real OS keys, cloud providers or signed installers. [ACCEPTANCE.md](ACCEPTANCE.md) is the explicit handoff.

### Local security and compatibility work

- Browser permission requests/checks and device permissions are denied before renderer content loads. New windows, navigation and webview attachment are blocked. Unit tests verify those callbacks; native Electron verifies denied notification permission and a blocked window.open, alongside existing sandbox/context isolation/no-Node/narrow-bridge checks.
- IPC regressions exercise untrusted windows/frames, malformed inputs, the 16-operation concurrency bound and generic error messages. Vault, capture encryption, typed-byte export, authenticated import, settings, corruption and forced-crash regressions remain in the full suite. This is a local code-boundary review, not a penetration-test certification.
- SQLite schema marker 1 adopts supported unversioned history without changing encrypted records. A regression reopens retained bytes; an unknown marker is rejected before schema writes and a byte-for-byte file comparison confirms no mutation. Portable containers 1/2, dump schema 1 and machine-local serialization retain their documented boundaries; future runtime/schema migrations require their own compatibility proof.
- A real RabbitMQ 4.2 restricted account with the management tag and owned-only configure/write can discover and capture an approved application route. The same account cannot redeclare the application queue or publish to its exchange; the original queue has zero QueueCumber consumers. The independent fixture administrator publishes/cleans only synthetic resources. The [permission recipe](RABBITMQ.md) explains namespace and hosted-policy limits. AMQPS on a real TLS broker still needs acceptance; the HTTPS management fixture does not establish that handshake.

### Interface evidence

The virtualized message page now exposes a named listbox, finite options, selected state and current-page positions. Up/Down and Home/End select and scroll beyond the first rendered viewport without transferring focus to recycled rows; Tab leaves the list. Unit and native checks exercise this. Payload/header buttons announce pressed state, navigation is localized, and both shipped locale dictionaries have matching nonempty keys. Alpha branding is removed; the version displays Ackbar.

A token contrast regression initially failed at a 2.69:1 light input-border ratio. Darkening that border fixes the 3:1 boundary requirement; primary/secondary/accent text pairs meet 4.5:1 across the shipped ground/surface/raised colors. This arithmetic does not replace manual rendered contrast/high-contrast/assistive-technology checks. Native screenshots were inspected in light/dark themes, empty/service-failed states, dense RabbitMQ/Kafka capture and a 1000 px Italian layout. Narrow inspection now scrolls its capture column as a whole, with separate finite message/raw-byte viewports; all controls and detail can be reached. The former nested messages-workspace clipping is addressed. Small windows require scrolling between setup, list and detail; manual screen-reader/scaling acceptance remains open.

Initial native verification exposed stale test expectations after the role change: a message locator still requested a button, and End incorrectly expected all 52 captured records rather than the current 30-record page. The locators/page assertion were corrected, preserving broker and paging semantics.

### Signing, dependencies and final review

macOS distribution now requires Developer ID credentials, hardened runtime and Apple notarization through the installed electron-builder 26.15.3 schema. Missing credentials or disabled identity discovery fail configuration; Actions then requires codesign, Gatekeeper and stapled-ticket checks before upload. Windows retains required Azure Artifact Signing. Both use only the accepted main-merge SHA; no unsigned macOS 1.0 fallback is generated. Private Apple/Azure setup guides remain ignored. A local schema/config test is not a real signing run.

The production advisory audit returned zero findings. The full development/build audit found **one moderate advisory** in optional `electron-builder → @electron/get → global-agent → roarr → sprintf-js 1.1.3`: [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), involving unbounded format precision and availability. The audit's suggested patched range names 1.1.4, but the registry had no such published version at this check; the attempted resolution failed without changing package metadata or the lockfile. This dependency is build-only, not imported by the app. No vulnerability suppression, speculative major override or vendored patch was added. Track the upstream fix and review this remaining advisory before publication. CI's full audit fails on high/critical findings and continues to report the moderate one; production and full-audit results are deliberately distinguished. An audit snapshot is not proof that future advisories will stay empty.

One fresh-context final reviewer inspected the changes and connected IPC/vault/storage/broker/UI/release callers. It found one required P2 correctness issue: selecting message B highlighted B while leaving message A's detail visible during a delayed or failed read. A delayed/rejected-read regression first failed, then passed after clearing the previous detail synchronously while retaining response-token guards. The full unit/native verification follows that fix; no second review was requested. No additional confirmed code blockers or Minor findings were reported. External signing/install/OS/cloud/manual accessibility/soak/package-manager checks and the build-only advisory remain explicit acceptance items, not claimed successes.

## Superseding release policy: unsigned 1.0.0 and optional signing from 1.0.1

The maintainer replaced mandatory Azure/Apple release gates with unsigned 1.0.0 and optional self-hosted Windows signing from 1.0.1. This section supersedes the signing-policy statements in the historical Ackbar notes above; it does not change their broker/security evidence. Package metadata remains 1.0.0 Ackbar. The future 1.0.1 patch must omit releaseName.

The merged-main release workflow always packages explicitly named unsigned Windows/macOS/Linux variants on hosted runners and creates the existing manual-publication draft. macOS uses ad-hoc signing without Developer ID/notarization. A separate workflow_run follow-up validates release context/package/main ancestry/tag identity and probes repository runner inventory before scheduling Windows signing. Missing/disabled credentials, no idle matching runner, offline/busy state or inventory API failure skip the optional path. Its dedicated certificate-store signing config still requires valid timestamped app/installer signatures and exact publisher before attaching distinct signed files and their separate checksum manifest; unsigned assets are never clobbered. The Azure/Apple-specific builder configs were removed.

Local checks: **76 unit tests**, types, ESLint, formatting, git diff checks and actionlint 1.7.7 pass. Both new builder configs pass the installed electron-builder 26.15.3 schema validator. Tests cover context/version/name guards including 1.0.0 skip, actual release-context file generation and disabled-follow-up CLI invocation in temporary Git repos, runner labels/idle/offline/busy/error/pagination cases, certificate settings, distinct names and queue watchdog timing. No application/broker behavior changed, so broker/native suites were not repeated for this release-only change. No distributables, signing credentials, GitHub runners, remote Actions or release assets were provisioned or run locally.

One independent read-only review found one required P2: the watchdog could cancel a signer that started during its last polling interval, or an active signer hidden by API errors. Two regressions first failed; a final deadline query now preserves observed active/completed signers and cancels only an observed waiting signer. If that query fails or state is unknown, it reports failure without cancelling a possibly active job. This can leave an optional job queued and needs maintainer attention, while unsigned output remains available. Status checks are not atomic reservations; a concurrent start/cancel race remains possible. The full 76-test suite passed after the correction; no second review. No other confirmed findings or deferred Minor code issues were reported.

Actual runner inventory permissions, workflow event payloads/scheduling/cancellation, local certificate/hardware provider access, timestamping, signed release attachment and platform packaging remain remote/clean-machine acceptance gates. Optional attachment is not atomic across files; an upload failure may leave a subset of already-verified signed assets. Inspect the draft before publishing. The known moderate build-only advisory remains recorded above.

## pnpm 12 development-start repair

The maintainer chose to retain the local package-manager update to pnpm 12.15.0. Corepack 0.33.0 and its cached package-manager metadata still selected `bin/pnpm.cjs`, which pnpm 12 does not ship. Corepack was updated locally to 0.34.6 (compatible with the installed Node 22.18), the stale pnpm12 cache was preserved under an OS-temp backup, and the exact package.json-pinned version/hash was reinstalled with its correct `bin/pnpm.mjs` entry. No integrity checks were disabled, and Node was not upgraded.

Verified pnpm version 12.15.0, frozen installation, types, ESLint and all 76 unit tests. pnpm12 added its package-manager dependency document to the lockfile; application dependency resolutions were unchanged. Development mode compiles main/preload and starts the renderer server on localhost:5173 plus Electron using `env -u ELECTRON_RUN_AS_NODE pnpm dev` in this agent environment, which exports that Node-only Electron flag. The development process is left running for the maintainer. The README documents Corepack/cache repair and the flag; no app runtime behavior changed. Broker/native/distribution suites were not rerun for this tooling repair, and pnpm12 remote CI/packaging remains unverified.
