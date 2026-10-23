# QueueCumber

**A little less queue confusion. A little more cucumber.**

A cross-platform desktop tool for developers who want to see what's flowing through their messaging systems. RabbitMQ and Kafka. Bring your own broker.

> **1.0.0 — Ackbar: release draft ready.** [Review the draft and downloads](https://github.com/davidemaggi/QueueCumber/releases). GitHub Actions built all seven unsigned packages; their downloaded checksums pass. The packaged macOS app passed a local capture smoke test. Public publication awaits the maintainer’s [acceptance checks](docs/ACCEPTANCE.md).

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

## Try a capture with local demo traffic

After installing dependencies, start Docker and run this in a separate terminal:

```sh
pnpm demo
```

It starts the local test brokers, creates sample destinations and publishes synthetic JSON once per second. No real account needed. Add a RabbitMQ connection using the default **Guided setup**:

| Field | Demo value |
| --- | --- |
| AMQP endpoint | `amqp://127.0.0.1:25672` |
| Management URL | `http://127.0.0.1:25673` |
| Virtual host | `/` |
| Username | `cucumber` |
| Password | `local-test-only` |

Allow unencrypted transport for this loopback fixture, choose **Next: credentials**, enter the username/password and save. The saved connection is selected automatically. Search for **demo.events**, select the stream, choose **Beginning (first retained message)** and **Start capture**. Click a message to inspect its headers and JSON.

To try a queue instead, select **demo.orders**, review the `demo.routes` → `orders.*` binding, accept **Capture supported routes only** and start capture. Keep the publisher running: queue observation sees new traffic, not the queue's backlog. `demo.audit` receives all `demo.routes` keys; the publisher alternates `orders.created` and `orders.updated`.

Kafka is available at `localhost:29092`, with TLS off, explicit unencrypted-transport consent and no SASL. Select the two-partition **demo.events** topic and choose each partition's beginning to replay samples.

Ctrl+C stops the publisher but leaves the brokers running. `pnpm demo:seed` adds five sample events without continuing live traffic. `pnpm demo:stop` stops the `queuecumber-test` Compose project, which is also used by integration tests. Demo queues and logs have finite retention; this is disposable local data.

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

Use Node.js 22.18+ and the pinned **pnpm 12.15.0**. If using Corepack with Node 22.18, Corepack 0.34.6 supports this pnpm entry point (newer Corepack releases can require newer Node versions):

```sh
npm install --global corepack@0.34.6
corepack enable pnpm
corepack install
pnpm install --frozen-lockfile
pnpm dev
```

If Corepack reports a missing `bin/pnpm.cjs`, update Corepack and refresh its downloaded package-manager cache with `corepack cache clean`, then `corepack install`; the old cache can retain the obsolete entry point. Cache cleanup requires package managers to be downloaded again. Keep `ELECTRON_RUN_AS_NODE` unset when launching the desktop app. On macOS/Linux, use `unset ELECTRON_RUN_AS_NODE` if your IDE exports it; on PowerShell, use `Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue`.

Check with `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Desktop smoke tests use `pnpm test:e2e` after a build.

Local packaging is for development only. The [release workflow](docs/RELEASING.md) builds artifacts in GitHub Actions only after a pull request merges into `main` and creates a GitHub Release draft. Hosted unsigned builds succeeded for all three targets; clean-machine acceptance remains pending. Unsigned packaging needs no signing account; optional Windows self-hosted signing and its queue watchdog are described in the release guide.

## Kafka

Choose Kafka in the connection form, supply bootstrap brokers, verified TLS/custom CA and optional SASL PLAIN or SCRAM credentials. Select explicit partitions and independent starting positions. Offsets stay local as exact decimal strings; keys, repeated binary headers and tombstones survive capture and export. Reads include uncommitted transactional records. See [Kafka behavior and tested support matrix](docs/KAFKA.md) for permissions, retention, reconnects and limitations. Real hosted accounts are not yet certified.

## RabbitMQ permissions and test brokers

Guided setup accepts an AMQP endpoint, separate management base URL and virtual host, then asks for username/password. **Connection URL (advanced)** still accepts a full AMQP URL. Prefer `amqps://` and HTTPS; plain transport requires explicit consent. A custom PEM CA is supported. Management authentication uses the same username/password as AMQP. Cloud-specific IAM and client-certificate authentication are outside the tested authentication matrix.

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

Local checks cover macOS desktop startup and the full RabbitMQ workflow, with RabbitMQ 4.2 and Apache Kafka 4.2.0 in Docker. Unit/integration tests exercise encryption, tampering, restart recovery, complete raw-byte paging, mixed-size saturation, scoped budgets, routing types, partial setup cleanup, TLS validation, permission denial, pagination and reconnects. See [local validation notes](docs/VALIDATION.md) for measured memory behavior and review outcomes. Hosted Windows/macOS/Linux source checks and unsigned packaging passed for the first draft; all seven downloaded packages match their checksums. The packaged macOS archive also passed a local session-only capture smoke test. Optional self-hosted Windows signing, real cloud environments and real OS-keystore behavior across all platforms are still pending.

Public Sans is bundled under the [SIL Open Font License](src/renderer/public/licenses/PublicSans-OFL.txt). Other dependencies keep their own licenses.
