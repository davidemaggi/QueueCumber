# QueueCumber

<!-- impeccable:product-schema 1 -->

## Platform

web

Web technology inside a Windows/macOS/Linux desktop application, rather than a hosted website or an OS-adaptive native UI.

## Stack

The maintainer prefers Electron and React and welcomes alternatives. Backend choices are delegated. Electron, React and TypeScript with a local Node utility service were approved on 2026-10-22. Architecture is recorded in [the project plan](docs/PROJECT_PLAN.md).

## Users

Developers connecting to messaging infrastructure to find relevant destinations, inspect traffic and save captures on their own computer.

## Product Purpose

Make messaging systems easier to inspect with saved connections, searchable resources, live subscriptions, readable message details and local exports. Support long-running captures without unbounded memory growth.

## Positioning

A local desktop inspector with a common workflow across brokers and explicit handling of their different semantics. RabbitMQ was the MVP provider; Kafka joins the inspection workflow in the 0.3.0 development milestone. Additional providers must be possible without rebuilding the UI for each one. These are goals, not claims of implemented or unique functionality.

## Operating Context

- Connect to self-hosted and cloud-hosted broker endpoints; save and independently test multiple connection profiles. Deleting a saved profile stops its active captures and removes saved credentials while preserving capture history; broker resources remain unchanged.
- Browse and search queues, streams, exchanges and routing bindings where applicable.
- Selecting a resource shows its routes/starting positions; an explicit Start capture action starts an ephemeral inspection session.
- Offer guided RabbitMQ setup with separate hosts/ports, TLS settings, virtual host and credentials, alongside advanced connection URLs. Editing preserves saved values. Provide disposable local demo destinations and synthetic traffic for trying capture.
- For a RabbitMQ queue, inspect its bindings and create an owned temporary queue bound to the same exchanges, keys and binding arguments. Capture newly routed copies without consuming the original queue's backlog.
- Reuse capture history across Start/Stop; browse distinct binding routing keys and select individual bindings or enter a direct/topic route manually. Resource panes support full-name tooltips, resizing and kind/message-count filters; captured messages support either arrival order.
- Choose beginning, live end or a specific offset when stream positioning is supported.
- Inspect structured headers and recognized formatted content, beginning with JSON; preserve original message bytes.
- Keep running after closing the window by default, respecting existing saved preferences and offering a configurable opt-out; explicit Quit stops capture. Continue subscriptions after closing the window, with session status available through the system tray where supported.
- Export captures locally, including folders and ZIP files. Transfer configuration between installations, supporting password protection.
- Retry disconnected sessions and make connection state visible.

## Capabilities and Constraints

- Version 1.0 is for inspection: no application publishing, purge, deletion or editing.
- The maintainer explicitly permits owned temporary observation queues and bindings, an exception to literal broker-wide read-only access.
- Binding-based capture sees future routed traffic, not the selected queue's history. Unsupported routes must be explained honestly.
- Protocol acknowledgements on owned queues and stream flow control are permitted; never acknowledge application-queue deliveries.
- Bound memory and offload older messages to disk. Provide configurable RAM-cache, disk, retention, payload-size and capture-rate settings with conservative defaults and finite global safety budgets. No expected traffic estimate is required.
- Protect private connection details with secure storage and support password-protected configuration transfer.
- Localize the UI with English as the default. Italian is the first additional language under the approved proposal.
- Support light and dark themes. Repository documentation is English, with a friendly developer voice.
- Build all distribution artifacts through GitHub Actions and distribute them through GitHub Releases first (installers and archives), followed by package-manager channels. The maintainer approved unsigned 1.0.0 downloads. From 1.0.1, verified Windows-signed variants use an available self-hosted runner alongside the always-built unsigned downloads; missing signing capacity must not block unsigned output.
- Follow Semantic Versioning. Target GitHub installers/archives and package managers including Homebrew, WinGet and Chocolatey; availability depends on completed releases and registry acceptance.
- Numerical defaults and limits must be validated with diverse synthetic workloads; broker/authentication compatibility and supported OS/CPU combinations need testing before public promises.

## Brand Commitments

The name is **QueueCumber**. The voice is practical, friendly and lightly playful: a developer's tool made by a developer. Avoid grand claims and forced jokes, especially in errors and security flows. The maintainer supplied a square application icon and transparent mark, kept as SVG sources in `resources/branding/`. Use the icon for application packages and the mark for the interface and tray; preserve their cucumber greens and orange detail.

## Evidence on Hand

The initial repository contains an MIT license and installed AI skills. The maintainer supplied the requirements, artwork and temporary-queue capture contract. RabbitMQ and Kafka inspection through prepared 1.0.0 Ackbar source and synthetic test screenshots now exist. The maintainer confirmed manual installation checks and authorized publication with the supplied artwork on 2026-10-23. The supplied artwork was included in merged-main Actions build 39928358358; unsigned 1.0.0 Ackbar was published on 2026-10-23 after downloaded checksum and packaged macOS checks. No published benchmark or customer proof exists. Use synthetic messages in demonstrations and label them accordingly.

## Product Principles

1. Protect application resources and explain inspection side effects.
2. Keep captures responsive and bounded across long sessions.
3. Preserve original messages while making them easier to understand.
4. Keep private data under the user's control.
5. Share workflows without hiding broker semantics.
