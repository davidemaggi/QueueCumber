# QueueCumber

**A little less queue confusion. A little more cucumber.**

A cross-platform desktop tool for developers who want to see what's flowing through their messaging systems. RabbitMQ and Kafka. Bring your own broker.

> **1.0.0 — Ackbar, prepared for acceptance.** The implementation is ready for the maintainer’s final platform, broker and signing checks. No downloadable release has been published yet. See the [acceptance checklist](docs/ACCEPTANCE.md).

## What you can do

- Save encrypted RabbitMQ and Kafka connection profiles, or use session-only storage when OS protection is unavailable.
- Test RabbitMQ AMQP/management independently; discover Kafka topics/partitions without a management endpoint.
- Read selected Kafka partitions from independent beginning/live/64-bit offsets, with no consumer-group joins or commits.
- Mirror supported queue bindings into a private observation queue and inspect incoming messages.
- Read RabbitMQ streams from the first retained message, live end or a specific offset, with local resume after reconnects.
- Read structured headers, formatted JSON and every retained original byte through bounded chunk navigation.
- Configure global and session capture budgets, disk retention and optional admission-rate limits.
- Switch between English/Italian and light/dark/system themes.
- Opt into background capture on window close; inspect session status and reopen/quit from the tray.
- Export retained messages as JSONL, a folder or ZIP; cancel exports and delete local capture history.
- Move password-encrypted connection profiles between installations, preview conflicts and choose copies, skipping or replacement.

Start with the [field guide](docs/USER_GUIDE.md), [RabbitMQ permission recipe](docs/RABBITMQ.md) or [Kafka guide](docs/KAFKA.md). The [roadmap](ROADMAP.md) separates implemented work from final acceptance gates.

## Inspect the traffic. Leave application queues alone.

For RabbitMQ queue inspection, QueueCumber will copy supported routing bindings onto its own temporary queue. It observes newly routed messages without consuming from the selected application queue. It cannot show messages already waiting there, and not every exchange can be mirrored this way.

This needs permission to create temporary queues and bindings. Version 1.0 offers no publishing, purging or editing of application resources. See the [capture contract](docs/PROJECT_PLAN.md#rabbitmq-capture-contract) for the precise boundaries.

## Local by design

The app connects from your computer; it needs no QueueCumber server. Private connection records use authenticated encryption with an OS-protected key. Captured sensitive content is encrypted in a local SQLite database. If secure OS storage is unavailable, profiles remain in memory and captures use a temporary encrypted session directory.

Connection transfers encrypt the entire file with scrypt and AES-256-GCM. Secrets are excluded by default; include them explicitly or re-enter full endpoints and credentials with **Edit connection** after importing. Capture budgets, appearance and OS keys stay machine-local. Imports never connect automatically.

Message dumps contain **plaintext private data**, including headers and payloads. Choose their destination accordingly. Cancel and Quit clean partial files; forced termination in session-only mode can leave `.queuecumber-export-*` files beside the selected destination. Secure mode uses an encrypted recovery journal to clean interrupted exports on the next launch. See [data formats and recovery](docs/DATA_FORMATS.md).

Prepared source is not a security certification. Desktop tests deliberately use session-only storage; real key-store behavior still needs checks on every target OS.

## Follow along

| Document | What's inside |
| --- | --- |
| [Field guide](docs/USER_GUIDE.md) | Installation, keyboard use, permissions and troubleshooting |
| [Acceptance checklist](docs/ACCEPTANCE.md) | Maintainer tests before public release |
| [Security](SECURITY.md) | Trust boundaries and private vulnerability reporting |
| [Roadmap](ROADMAP.md) | Milestones and release gates |
| [Project proposal](docs/PROJECT_PLAN.md) | Architecture, trade-offs and verification |
| [Product context](PRODUCT.md) | Confirmed requirements and open decisions |
| [Agent conventions](AGENTS.md) | How AI-assisted work is designed and checked |

Development happens on `development`. Releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). From 1.0, major/minor releases also get Star Wars character names: **1.0.0 “Ackbar”**, A for major 1, B for major 2, and so on. Patch releases stick to numbers. All distribution builds run in GitHub Actions only after a pull request merges into `main`; development/PR compilation checks remain separate. GitHub Releases will provide Windows installers/ZIPs, macOS DMGs/ZIPs and Linux packages/TAR archives first, followed by Homebrew, WinGet and Chocolatey. Version 1.0.0 downloads will be unsigned. From 1.0.1, optional self-hosted Windows signing adds separately labeled signed downloads when its runner is available; unsigned releases remain independent. Install commands will appear when those packages actually exist.

## Contributing

For now, the most useful contributions are broker edge cases and reproducible usage scenarios. Share sanitized examples, never real credentials or private messages. Start with the local development commands below.

## License

[MIT](LICENSE), copyright 2026 Davide Maggi.

## Local development

Use Node.js 22.18+ and the pinned pnpm version. Run `pnpm install`, then `pnpm dev`. Check with `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Desktop smoke tests use `pnpm test:e2e` after a build.

Local packaging is for development only. The [release workflow](docs/RELEASING.md) builds artifacts in GitHub Actions only after a pull request merges into `main` and creates a GitHub Release draft. Actual hosted builds and clean-machine checks remain pending. Unsigned packaging needs no signing account; optional Windows self-hosted signing and its queue watchdog are described in the release guide.

## Kafka

Choose Kafka in the connection form, supply bootstrap brokers, verified TLS/custom CA and optional SASL PLAIN or SCRAM credentials. Select explicit partitions and independent starting positions. Offsets stay local as exact decimal strings; keys, repeated binary headers and tombstones survive capture and export. Reads include uncommitted transactional records. See [Kafka behavior and tested support matrix](docs/KAFKA.md) for permissions, retention, reconnects and limitations. Real hosted accounts are not yet certified.

## RabbitMQ permissions and test brokers

Supply an AMQP URL and a separate management base URL. Prefer `amqps://` and HTTPS; plain transport requires explicit consent. A custom PEM CA is supported. Management authentication currently uses the username/password from the AMQP URL. Cloud-specific IAM and client-certificate authentication are outside the tested authentication matrix.

The account needs management API visibility for the vhost and relevant queues/exchanges, configure/read permission for `queuecumber.*` observation queues, and binding permissions for the source exchanges. RabbitMQ binding operations require write permission on the destination queue and read permission on the source exchange. Validate these regex permissions with your administrator; monitoring-only accounts cannot create observation resources.

Stream inspection additionally needs read permission on the selected stream. It reads the stream log directly after checking its type; acknowledgements provide stream flow control and do not delete its messages. No application consumer-group position is written. Classic and quorum application queues always use observation copies.

For disposable integration tests:

```sh
docker compose -p queuecumber-test -f compose.test.yml up -d --wait
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose -p queuecumber-test -f compose.test.yml down
```

This fixture uses synthetic credentials and binds only loopback ports 25672/25673 (RabbitMQ) and 29092/29093/29094 (Kafka plain/TLS/SASL). Kafka startup provisions synthetic SCRAM credentials automatically. The TLS fixtures under `tests/fixtures/tls/` are public test-only keys/certificates; never deploy or trust them outside tests.

## Current limits

Capture cache defaults to 64 MiB, disk quota to 2 GiB, retention to seven days and retained payloads to 16 MiB. The UI preview accepts 256 KiB by default, with a separate 64 KiB per-detail IPC ceiling. Optional message-rate admission drops are counted. Budgets stay finite; a session can narrow the global settings. Four concurrent captures and 100 retained session entries are the current safety limits. Starting a capture at the history limit removes the oldest stopped/failed session and its retained data.

The RAM setting is a cache budget, not a cap on Electron's total RSS. Broker clients may allocate oversized deliveries before the app can omit them. Disk storage reserves headroom for SQLite pages/journaling and may evict before reaching the displayed quota. Saving limits stops active captures and asks for confirmation when effects require it.

Exports read one retained record at a time, with one active export job. The start snapshot fixes the upper record ID; it does not pin records against retention. The final manifest reports records removed during export. ZIP is capped at 10,000 messages to bound archive metadata; JSONL and folder dumps handle larger captures. These are local captures, never a dump of an application's queued backlog.

Stream offsets accept exact JavaScript integers from zero through 9,007,199,254,740,991. A retained-prefix check can clamp an unavailable old position, with a visible notice. Future offsets may wait for more data on RabbitMQ 4.2 and remain marked unverified until a delivery confirms the position. Gaps count interruptions/discontinuities, not an exact number of lost messages.

In secure mode, encrypted session history and retained records can be reopened after restart. Restored sessions stay stopped; interrupted captures show a gap and require an explicit new capture. Retained counts and timestamps show the available range. Closing quits by default. Enable background capture in Settings to keep subscriptions running; use Quit QueueCumber to stop and exit. The tray shows up to 16 session entries, prioritizing active captures, and refreshes independently of the hidden renderer. On Linux or when tray creation fails, closing keeps an accessible minimized window. Desktop tray availability and placement depend on the OS/environment. Reconnects recreate the ephemeral queue and expose gaps rather than promise replay. Broker overflow can produce gaps that cannot be counted precisely.

## Verification status

Local checks cover macOS desktop startup and the full RabbitMQ workflow, with RabbitMQ 4.2 and Apache Kafka 4.2.0 in Docker. Unit/integration tests exercise encryption, tampering, restart recovery, complete raw-byte paging, mixed-size saturation, scoped budgets, routing types, partial setup cleanup, TLS validation, permission denial, pagination and reconnects. See [local validation notes](docs/VALIDATION.md) for measured memory behavior and review outcomes. GitHub Actions is prepared for Windows/macOS/Linux; those remote runs have not been executed here. Optional self-hosted Windows signing, real cloud environments and real OS-keystore behavior across all platforms are still pending.

Public Sans is bundled under the [SIL Open Font License](src/renderer/public/licenses/PublicSans-OFL.txt). Other dependencies keep their own licenses.
