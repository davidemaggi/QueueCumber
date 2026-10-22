# QueueCumber

**A little less queue confusion. A little more cucumber.**

A cross-platform desktop tool for developers who want to see what's flowing through their messaging systems. RabbitMQ first. Kafka next. Bring your own broker.

> **Early development.** The architecture and MVP plan are approved. A local desktop scaffold is being implemented; no downloadable release exists yet.

## What's on the menu?

- Save and test connections to self-hosted and cloud-hosted brokers.
- Find queues, streams and routing bindings without hunting through server consoles.
- Watch new messages, inspect headers and pretty-print JSON while keeping the original payload available.
- Keep recent captures handy in memory and older data on disk, with configurable limits for both.
- Export captures as JSON Lines, a folder or a ZIP.
- Keep subscriptions running in the tray while the main window is closed.
- Move configuration between computers with password-protected exports.
- Pick a light or dark theme and a localized interface. English is the default.

These are planned capabilities, not shipped features. See the [roadmap](ROADMAP.md) for the proposed sequence.

## Inspect the traffic. Leave application queues alone.

For RabbitMQ queue inspection, QueueCumber will copy supported routing bindings onto its own temporary queue. It observes newly routed messages without consuming from the selected application queue. It cannot show messages already waiting there, and not every exchange can be mirrored this way.

This needs permission to create temporary queues and bindings. Version 1.0 will offer no publishing, purging or editing of application resources. See the [capture contract](docs/PROJECT_PLAN.md#rabbitmq-capture-contract) for the precise boundaries.

## Local by design

The proposed app connects from your computer; it needs no QueueCumber server. Private connection records will be encrypted with OS-backed key protection. Captured sensitive data will have bounded encrypted local storage. Secret-bearing configuration exports will require a password.

Security behavior still needs implementation and testing. Exported message dumps can contain private data; their contents and protection must be clear before saving.

## Follow along

| Document | What's inside |
| --- | --- |
| [Roadmap](ROADMAP.md) | Milestones and release gates |
| [Project proposal](docs/PROJECT_PLAN.md) | Architecture, trade-offs and verification |
| [Product context](PRODUCT.md) | Confirmed requirements and open decisions |
| [Agent conventions](AGENTS.md) | How AI-assisted work is designed and checked |

Development happens on `development`. Releases will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Planned distribution includes GitHub installers and archives, followed by Homebrew, WinGet and Chocolatey. Install commands will appear when those packages actually exist.

## Contributing

For now, the most useful contributions are proposal feedback, broker edge cases and reproducible usage scenarios. Share sanitized examples, never real credentials or private messages. Development commands will be documented when the scaffold exists.

## License

[MIT](LICENSE), copyright 2026 Davide Maggi.

## Local development

Use Node.js 22.18+ and the pinned pnpm version. Run `pnpm install`, then `pnpm dev`. Check with `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Desktop smoke tests use `pnpm test:e2e` after a build.
