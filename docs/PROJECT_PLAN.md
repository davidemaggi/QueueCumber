# QueueCumber project proposal

Status: **architecture and MVP implementation plan approved on 2026-10-22; 1.0.0 Ackbar hardening authorized for continuous execution; external acceptance delegated to the maintainer after implementation; publication gates remain pending**.

Date: 2026-10-22. Requirements live in [PRODUCT.md](../PRODUCT.md). The maintainer confirmed RabbitMQ temporary-queue capture. The architecture and staged scope below were approved. Resource settings are configurable: no representative user traffic estimate is required.

## Outcome and first slice

Build a local Windows/macOS/Linux desktop inspector for developers. Start with RabbitMQ, then add long-session workflows and Kafka before the proposed 1.0 release. Inspection permits owned observation resources, but excludes application-resource administration.

The first slice is: securely save a connection → test endpoints → discover a queue → inspect supported bindings → create a temporary observation queue → capture bounded local data → inspect a message → stop and clean up.

No remote QueueCumber backend, broker administration UI, executable plugin loader or cloud account provisioning is proposed.

## Stack recommendation

| Approach | Benefits | Costs | Recommendation |
| --- | --- | --- | --- |
| Electron + React + TypeScript, local Node service | Matches maintainer preference; shared language; desktop/tray APIs and Node broker clients | Chromium footprint, privileged renderer boundary and packaging validation | Start here |
| Tauri + React with Rust | Smaller runtime distribution | Second language and extra broker integration work | Revisit if measured Electron footprint fails an agreed budget |
| Electron + React with a Go sidecar | Independent broker runtime and Go client ecosystem | Extra binary, lifecycle, IPC and packaging | Use only if a measured runtime/client limitation requires it |

Proposed tooling: strict TypeScript, React/Vite, pnpm with a committed lockfile, electron-builder for packaging. Choose compatible maintained versions during approved scaffolding. No local HTTP server is needed for app operations.

## Runtime boundaries

1. **Renderer:** localized UI, virtualized lists, bounded previews. No Node integration, credentials, direct files or broker sockets. Use context isolation, sandboxing, restrictive CSP and trusted local UI content.
2. **Preload:** small typed IPC API. Validate payload schemas, sender identity, operation scope and sizes at privileged boundaries. No generic filesystem, shell or arbitrary IPC API.
3. **Desktop main:** window/tray lifecycle, secure key access, dialogs and service supervision. Closing the window can leave subscriptions active; explicit Quit stops sessions and flushes storage.
4. **Local utility process:** connections, session state, capture persistence and streaming exports. Keep broker/disk work off the UI thread, with bounded queues and visible worker failure/restart behavior.

Start with focused folders in one repository, not a package per abstraction. A provider exposes discovery, capabilities, testing, subscription/cancellation and error classification. Preserve native identifiers and broker-specific resource terms. RabbitMQ establishes the interface; Kafka validates it. No runtime third-party plugin system.

## RabbitMQ capture contract

### Discovery

Configure protocol and management endpoints independently, including vhost, TLS/CA and supported credentials. Enumeration requires an accessible management API and sufficient permissions; AMQP alone cannot list queues and bindings. Report protocol and management connectivity separately.

Test specific self-hosted/hosted endpoints rather than claiming universal cloud support. Enable certificate validation by default. Any insecure transport exception must be explicit and visible; never silently bypass certificate failures.

### Selecting an application queue

- Read its inbound bindings from the management API. Routing keys are exchange-scoped binding patterns, not independent resources.
- Create a uniquely owned, non-durable, exclusive temporary queue with cleanup behavior. Copy supported bindings, including source exchange, key and arguments. Do not clone application queue policies or dead-letter configuration.
- Start the visible capture after all bindings are established. Setup is not atomic and can miss traffic; show the actual start and coverage.
- Never consume, acknowledge, redeclare, purge, delete or reconfigure the application queue. Clean up only resources owned by this session.
- Proposed: acknowledge deliveries on the **owned observation queue** after committing the encrypted local batch. Bound outstanding deliveries through prefetch and batching. These acknowledgements do not touch the application queue.

This sees future routed traffic, not backlog or necessarily identical contents: queue-level TTL, priorities, dead-lettering and other policies can differ. It adds load and topology. Binding another queue can change whether traffic is considered routed, including alternate-exchange/mandatory-return behavior; this is not a zero-side-effect wire tap.

Initially support direct, topic, fanout and headers exchanges only after integration testing. Preserve all binding arguments. The implicit default-exchange route cannot be copied. Distribution-based exchanges (random/hash), plugins and unknown routing semantics remain unsupported until individually validated: adding bindings can change where application messages go. Explain partial coverage before starting rather than implying complete observation.

Use a binding snapshot for each MVP session, not silent live topology following. Revalidate on reconnect and report changes. A user refresh can restart with a new snapshot. Permissions must permit creating/reading the owned queue and creating bindings to source exchanges; ship a tested least-privilege recipe for supported brokers. Ordinary monitoring-only credentials will not be sufficient.

### Streams and Kafka

RabbitMQ streams are a distinct subscription capability. Offer first available, new messages from now and explicit offset. Distinguish live end from the last stored chunk. If using AMQP stream reads, acknowledgements provide credit without deleting history. Store inspection progress locally rather than modifying application consumer offsets.

Kafka uses explicit partition assignments and local positions without commits to application consumer groups. Offsets are partition-scoped. Retention can remove a requested position: report the gap and actual starting point.

### Reconnects

Expose connecting, capturing, reconnecting, paused, stopped and failed states. Retry transient network failures with capped exponential backoff and jitter. Authentication, permission and invalid-configuration failures require action rather than endless retries. Cancellation prevents future retries.

A lost ephemeral queue requires a new owned queue and validated bindings. Report the unrecoverable observation gap; do not promise replay. Streams resume from local positions where available and may redeliver. Preserve offsets/delivery identity without assuming RabbitMQ message IDs are unique. Include sleep/wake and worker crashes in recovery tests.

## Bounded capture and storage

Proposed storage: a SQLite index with authenticated-encrypted sensitive metadata/payload blobs and OS-protected keys. Keep resource names, connection details and headers out of plaintext indexes, journals and logs. Validate the bundled Node/SQLite integration in the first slice; add a maintained binding only if needed.

Write retained messages to encrypted disk batches and keep a bounded recent cache in RAM. Limit bytes and counts globally and per session. Page older messages and cap IPC batches, pending writes and UI update rates. Preserve raw bytes and typed headers. Cap JSON parsing and previews; oversized input cannot allocate unchecked buffers. A hard limit may require rejecting/truncating capture with an explicit marker rather than claiming full retention.

Expose validated resource settings with conservative defaults: global capture-cache bytes, disk quota, retention age, maximum retained payload size and optional per-session capture-rate limits. Per-session limits may narrow, but never bypass, global budgets. Keep finite safety bounds for in-flight work, previews and IPC. Allow restoring defaults and explain units and limit behavior. No user traffic estimate is required; validate defaults against diverse synthetic workloads.

Cache budgets are not a hard cap on total process RSS: Electron, broker clients and protocol buffers have their own overhead. Measure total RSS separately. Rate limiting is a capture admission policy, not a claim that publishers slow down: report skipped observations, and apply flow control only where the protocol and client permit it. A payload limit may be checked only after a broker client allocates the delivery; test that constraint and avoid promising allocation-free rejection.

Lowering a quota must show eviction/stop effects before applying it. Reject invalid, unsafe or internally inconsistent settings; do not allow an unlimited RAM/disk setting. Changes that require resubscribing must say so. User-controlled values and proposed starting defaults are detailed in [the MVP implementation plan](superpowers/plans/2026-10-22-rabbitmq-mvp.md).

Proposed retention: finite disk quota and oldest eligible capture eviction with a visible retained range. On disk-full/write failure, stop or mark the affected capture and stop acknowledging newly received observations. Never replace disk storage with unbounded RAM. Coordinate retention with bounded export snapshots; exports must not pin unlimited disk.

Bound the owned broker queue too. Validate an overflow policy that avoids rejecting application publications, and show potential broker overflow and local gaps. Capture is not guaranteed lossless during overload/outages. Test crash recovery without plaintext temporary files. Deletion means logical cleanup, not guaranteed forensic erasure on SSDs.

## Secure storage and configuration transfer

Encrypt full private connection records, not only passwords, under a random vault key protected by the OS keystore. On Linux, reject insecure storage fallbacks such as `basic_text`; offer session-only operation if secure persistence is unavailable. OS protection is not isolation from every same-user process or a compromised account.

Keep decrypted credentials in privileged processes only while needed. Redact URI userinfo, tokens and sensitive fields from errors/logs. Include imported private keys/certificates in the threat model and avoid telemetry containing private data.

Use a versioned authenticated configuration container. Proposed default: exclude secrets unless explicitly included, require a password for secret-bearing exports, and allow encrypting the complete configuration. Use a standard password KDF such as scrypt with fresh salt and bounded parameters, then AES-256-GCM with a fresh nonce. Authenticate format/version metadata. Bound sizes and KDF costs before allocation/decryption; reject tampering, wrong passwords and unsupported versions. Preview conflicts and import atomically. Never save the export password or invent cryptography.

Message dumps are separate from configuration transfer. Show when a dump is plaintext; protected dumps need an authenticated encrypted container rather than assuming an ordinary ZIP is encrypted.

## Message viewing and dumps

Show properties/headers in a table, preserving typed and binary values. Offer raw content plus recognized formatting, starting with JSON/text and safe binary representation. Content types are hints. Escape rendered content; disable message-driven execution and navigation.

Export **locally retained captures**, not application queue backlog. Selecting a resource can start a new capture or export existing retained data; distinguish the two. Proposed formats:

- JSONL for streaming/scripts, with lossless payload encoding.
- Folder with versioned manifest, metadata and raw payloads.
- ZIP with the same folder layout.

Include provenance, timestamps, offsets where available, scope, retained range and known gaps. Generate safe filenames rather than using untrusted broker/message paths. Stream to disk; support cancellation and cleanup. Preserve existing destinations on failure. Never assemble large dumps in RAM.

## Interface and desktop lifecycle

Proposed workflow: connection/resource navigation, searchable message list, selected-message detail and resizable panels. This is a functional outline, not a final visual design.

Use Taste for initial app-screen creation, then Impeccable to review/refine rendered results. PRODUCT is initialized. Establish visual direction during the approved UI stage, honoring cucumber-inspired branding and an explicitly temporary logo if needed. App screens are code-first under Impeccable. No landing/showcase workflow preference has been chosen or stored.

Localize from the first screen with English fallback; propose Italian as the second locale, pending confirmation. Provide light/dark/system themes. Proposed accessibility target: WCAG 2.2 AA where applicable, plus desktop keyboard/menu conventions. Check focus, accessible names, contrast, non-color status and reduced motion.

Make close-to-tray explicit and configurable. Tray menus show session state and provide Open/Quit. When a desktop has no usable tray, preserve an accessible window/application route and explain the fallback. No claim that capture continues during machine sleep or after Quit.

## Delivery and verification

| Stage | Work | Evidence |
| --- | --- | --- |
| 1. Review | Resolve open product decisions and approve scope | Maintainer approval before product code/dependencies |
| 2. Secure slice | Desktop boundary, saved connection, real discovery/capture | Original queues untouched; direct/topic/fanout/headers tests; TLS/permission failures |
| 3. MVP | Viewer, bounded encrypted storage, localization/themes, reconnect | Sustained-load/payload measurements, IPC/content checks, visible gaps |
| 4. Long sessions | Streams, tray, dumps, protected transfer | Tamper/wrong-password/size tests; disk-full/cancellation; sleep and platform tray checks |
| 5. Kafka | Second adapter and per-partition inspection | No application-group commits; retention-gap/authentication tests |
| 6. Release | Packaging, signing, docs and registry submissions | Clean-machine installs/upgrades, schema migrations and checksums |

Test real disposable brokers with a baseline application consumer. Cover overlapping routing patterns, header arguments, partial setup failure, binding changes, restart and supported/unsupported exchanges. Use synthetic data only. Add Kafka fixtures and Windows/macOS/Linux CI as their scope arrives. Test behavior at boundaries rather than implementation details.

Packaging decision (confirmed 2026-10-22): build every distribution artifact through GitHub Actions only after a pull request merges into `main`, and distribute through GitHub Releases first. Use Windows installer/ZIP, macOS DMG/ZIP and Linux AppImage/DEB/TAR after target validation. The maintainer superseded mandatory signing: 1.0.0 ships unsigned; from 1.0.1, available self-hosted Windows signing adds verified signed variants without blocking unsigned downloads. Homebrew, WinGet and Chocolatey follow when their configurations are ready. See [release workflow](RELEASING.md). Determine supported CPU architectures from actual builds/tests. Package publication, signing and notarization require maintainer-owned accounts and registry compliance; prepare reviewable artifacts before requesting final publication authorization.

## Decision record and remaining work

1. Approved: Electron/React/TypeScript with local Node utility process and the staged scope above.
2. Approved as part of the proposal: protocol acknowledgements on owned queues and stream flow control; application queues remain untouched.
3. Italian is the first additional locale under the approved proposal; English remains the default.
4. Confirmed: user-configurable resource settings with conservative defaults. No traffic estimate is available or required. Validate defaults with synthetic workloads.
5. Hosted-service/authentication and OS/CPU compatibility remain test-driven. Begin with ordinary endpoints and TLS credentials; cloud-specific IAM requires explicit support work.

The [detailed MVP implementation plan](superpowers/plans/2026-10-22-rabbitmq-mvp.md) was approved with native execution and its review corrections are implemented. The maintainer subsequently authorized continuous execution of the complete [0.2.0 implementation plan](superpowers/plans/2026-10-22-portable-captures.md). The complete [0.3.0 Kafka plan](superpowers/plans/2026-10-22-kafka.md) was also authorized for continuous inline execution, with release packaging restricted to merged main pull requests. See [validation](VALIDATION.md) for evidence and outstanding platform/release gates, and [data formats](DATA_FORMATS.md) for the implemented transfer/dump contracts.

## Primary references

- [RabbitMQ exchanges](https://www.rabbitmq.com/docs/exchanges): routing/default-exchange constraints.
- [RabbitMQ queues](https://www.rabbitmq.com/docs/queues): temporary/exclusive queue lifecycle.
- [RabbitMQ acknowledgements](https://www.rabbitmq.com/docs/confirms): delivery acknowledgements and flow control.
- [RabbitMQ streams](https://www.rabbitmq.com/docs/streams): stream positions/consumption.
- [RabbitMQ management](https://www.rabbitmq.com/docs/management): API and permission requirements.
- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security): renderer/IPC boundaries.
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): OS protection and caveats.
- [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html): version/public-contract policy.

The maintainer authorized the complete [Ackbar hardening plan](superpowers/plans/2026-10-22-ackbar.md), with final external checks to follow implementation. This does not authorize publishing, tagging or merging main.

The [optional-signing plan](superpowers/plans/2026-10-22-optional-signing.md) supersedes the earlier mandatory Azure/Apple release gating. This changes distribution policy, not broker/data scope.
