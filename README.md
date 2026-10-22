# QueueCumber

**A little less queue confusion. A little more cucumber.**

A cross-platform desktop tool for developers who want to see what's flowing through their messaging systems. RabbitMQ first. Kafka next. Bring your own broker.

> **Early development.** The architecture and MVP plan are approved. The RabbitMQ inspection workflow runs locally; no downloadable release exists yet.

## Working in the alpha

- Save encrypted RabbitMQ connection profiles, or use session-only storage when OS protection is unavailable.
- Test AMQP and management independently; browse and search queues, streams and exchanges.
- Mirror supported queue bindings into a private observation queue and inspect incoming messages.
- Read structured headers, formatted JSON and every retained original byte through bounded chunk navigation.
- Configure global and session capture budgets, disk retention and optional admission-rate limits.
- Switch between English/Italian and light/dark/system themes.

The [roadmap](ROADMAP.md) tracks the rest: stream consumption, tray mode, dumps, password-protected configuration transfer, Kafka and packaged releases are future milestones.

## Inspect the traffic. Leave application queues alone.

For RabbitMQ queue inspection, QueueCumber will copy supported routing bindings onto its own temporary queue. It observes newly routed messages without consuming from the selected application queue. It cannot show messages already waiting there, and not every exchange can be mirrored this way.

This needs permission to create temporary queues and bindings. Version 1.0 will offer no publishing, purging or editing of application resources. See the [capture contract](docs/PROJECT_PLAN.md#rabbitmq-capture-contract) for the precise boundaries.

## Local by design

The proposed app connects from your computer; it needs no QueueCumber server. Private connection records use authenticated encryption with an OS-protected key. Captured sensitive content is encrypted in a local SQLite database. If secure OS storage is unavailable, profiles remain in memory and captures use a temporary encrypted session directory. Password-protected configuration exports are planned for 0.2.

This is early software, not a security certification. The desktop tests deliberately use session-only storage; real key-store behavior still needs checks on every target OS. Message dumps are not implemented yet.

## Follow along

| Document | What's inside |
| --- | --- |
| [Roadmap](ROADMAP.md) | Milestones and release gates |
| [Project proposal](docs/PROJECT_PLAN.md) | Architecture, trade-offs and verification |
| [Product context](PRODUCT.md) | Confirmed requirements and open decisions |
| [Agent conventions](AGENTS.md) | How AI-assisted work is designed and checked |

Development happens on `development`. Releases will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Planned distribution includes GitHub installers and archives, followed by Homebrew, WinGet and Chocolatey. Install commands will appear when those packages actually exist.

## Contributing

For now, the most useful contributions are broker edge cases and reproducible usage scenarios. Share sanitized examples, never real credentials or private messages. Start with the local development commands below.

## License

[MIT](LICENSE), copyright 2026 Davide Maggi.

## Local development

Use Node.js 22.18+ and the pinned pnpm version. Run `pnpm install`, then `pnpm dev`. Check with `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Desktop smoke tests use `pnpm test:e2e` after a build.

## RabbitMQ permissions and test broker

Supply an AMQP URL and a separate management base URL. Prefer `amqps://` and HTTPS; plain transport requires explicit consent. A custom PEM CA is supported. Management authentication currently uses the username/password from the AMQP URL. Cloud-specific IAM and client-certificate authentication are outside this alpha's tested matrix.

The account needs management API visibility for the vhost and relevant queues/exchanges, configure/read permission for `queuecumber.*` observation queues, and binding permissions for the source exchanges. RabbitMQ binding operations require write permission on the destination queue and read permission on the source exchange. Validate these regex permissions with your administrator; monitoring-only accounts cannot create observation resources.

For disposable integration tests:

```sh
docker compose -p queuecumber-test -f compose.test.yml up -d --wait
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose -p queuecumber-test -f compose.test.yml down
```

This fixture uses synthetic credentials and binds only loopback ports 25672/25673. The TLS fixtures under `tests/fixtures/tls/` are public test-only keys/certificates; never deploy or trust them outside tests.

## Current limits

Capture cache defaults to 64 MiB, disk quota to 2 GiB, retention to seven days and retained payloads to 16 MiB. The UI preview accepts 256 KiB by default, with a separate 64 KiB per-detail IPC ceiling. Optional message-rate admission drops are counted. Budgets stay finite; a session can narrow the global settings. Four concurrent captures and 100 retained session entries are the current safety limits. Starting a capture at the history limit removes the oldest stopped/failed session and its retained data.

The RAM setting is a cache budget, not a cap on Electron's total RSS. Broker clients may allocate oversized deliveries before the app can omit them. Disk storage reserves headroom for SQLite pages/journaling and may evict before reaching the displayed quota. Saving limits stops active captures and asks for confirmation when effects require it.

In secure mode, encrypted session history and retained records can be reopened after restart. Restored sessions stay stopped; interrupted captures show a gap and require an explicit new capture. Retained counts and timestamps show the available range. Closing the window stops the alpha; tray mode is a later milestone. Reconnects recreate the ephemeral queue and expose gaps rather than promise replay. Broker overflow can produce gaps that cannot be counted precisely.

## Verification status

Local checks cover macOS desktop startup and the full RabbitMQ workflow, with RabbitMQ 4.2 in Docker. Unit/integration tests exercise encryption, tampering, restart recovery, complete raw-byte paging, mixed-size saturation, scoped budgets, routing types, partial setup cleanup, TLS validation, permission denial, pagination and reconnects. See [local validation notes](docs/VALIDATION.md) for measured memory behavior and review outcomes. GitHub Actions is prepared for Windows/macOS/Linux; those remote runs have not been executed here. Installer signing, real cloud environments and real OS-keystore behavior across all platforms are still pending.

Public Sans is bundled under the [SIL Open Font License](src/renderer/public/licenses/PublicSans-OFL.txt). Other dependencies keep their own licenses.
