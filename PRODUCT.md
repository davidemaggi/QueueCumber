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

- Connect to self-hosted and cloud-hosted broker endpoints; save and independently test multiple connection profiles.
- Browse and search queues, streams, exchanges and routing bindings where applicable.
- Selecting a resource starts an ephemeral inspection session.
- For a RabbitMQ queue, inspect its bindings and create an owned temporary queue bound to the same exchanges, keys and binding arguments. Capture newly routed copies without consuming the original queue's backlog.
- Choose beginning, live end or a specific offset when stream positioning is supported.
- Inspect structured headers and recognized formatted content, beginning with JSON; preserve original message bytes.
- Continue subscriptions after closing the window, with session status available through the system tray where supported.
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
- Build all distribution artifacts through GitHub Actions and distribute them through GitHub Releases first (installers and archives), followed by package-manager channels. Windows executables use the maintainer’s Azure Artifact Signing account.
- Follow Semantic Versioning. Target GitHub installers/archives and package managers including Homebrew, WinGet and Chocolatey; availability depends on completed releases and registry acceptance.
- Numerical defaults and limits must be validated with diverse synthetic workloads; broker/authentication compatibility and supported OS/CPU combinations need testing before public promises.

## Brand Commitments

The name is **QueueCumber**. The voice is practical, friendly and lightly playful: a developer's tool made by a developer. Avoid grand claims and forced jokes, especially in errors and security flows. The future logo and color family draw from a cucumber. No finished logo exists; an explicitly temporary mark is acceptable.

## Evidence on Hand

The initial repository contains an MIT license and installed AI skills. The maintainer supplied the requirements and confirmed temporary-queue capture. RabbitMQ and Kafka inspection through prepared 1.0.0 Ackbar source and synthetic test screenshots now exist; the maintainer will perform final platform/cloud/signing acceptance. No release, published benchmark, customer proof or finished logo exists yet. Use synthetic messages in demonstrations and label them accordingly.

## Product Principles

1. Protect application resources and explain inspection side effects.
2. Keep captures responsive and bounded across long sessions.
3. Preserve original messages while making them easier to understand.
4. Keep private data under the user's control.
5. Share workflows without hiding broker semantics.
