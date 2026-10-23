# QueueCumber 1.0.1

A few less prickly inspection workflows, plus optional Windows signing.

- Start and Stop reuse the same capture history. Unchanged stream/Kafka selections continue from saved positions; explicitly changed starting options reposition that history.
- RabbitMQ guided setup takes host and port, with TLS controls and separate credentials. Editing loads the saved values instead of starting with an empty form.
- Resource names have full-name tooltips. Resize the resource pane with its divider or keyboard, and filter by resource type and known message count.
- Browse distinct routing keys with exchange/destination context. Select individual queue bindings or add direct/topic routes to the temporary observation queue.
- Page retained messages newest or oldest first without loading the whole capture into memory.
- Unsigned downloads remain independent of signing availability. Optional Windows signed installer/ZIP assets use the self-hosted certificate store and separate checksums, after signature and timestamp verification.

Queue captures still see future routed traffic, not application backlog. The implicit default-exchange route cannot be mirrored. Manual direct/topic routes do not change application queues or bindings. Message dumps remain plaintext; configuration transfers remain encrypted.

## Downloads and verification

Windows x64 has signed installer and ZIP downloads, verified on the signing runner with valid Authenticode signatures, timestamps and publisher `Open Source Developer Davide Maggi`. The ZIP contains the same verified application executable. Verify these two downloads with `SHA256SUMS-signed-windows-x64.txt`.

Unsigned Windows x64, macOS arm64 and Linux x64 packages remain available; verify them with `SHA256SUMS.txt`. macOS uses ad-hoc integrity signing without Developer ID or notarization. All nine downloaded package hashes matched their manifests before publication.

Built from merged-main commit `7b8ff2fc153d3a491b33fb43c04f5152f6da9d8e` through GitHub Actions. The maintainer authorized publication on 2026-10-23. Detailed clean-machine installation/upgrade/uninstaller checks remain unrecorded; automated signature verification is not a claim that those checks were performed.

Patch releases have no character name. No trap this time—just fewer clicks.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.0...v1.0.1)
