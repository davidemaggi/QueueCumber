# QueueCumber 1.0.4

- **Routing keys are now one flat list.** Choose **Resource type → Routing keys** to see every distinct key found in the broker's bindings, filterable by search. Default-exchange bindings are hidden: they are implicit per-queue names, not keys you can observe.
- **Capture by routing key.** Tick one or more keys (up to 64) and start a capture. QueueCumber binds one temporary observation queue to every direct or topic exchange that routes those keys. New traffic only; application queues are never consumed or changed. Fanout, headers and default-exchange routes ignore the key, so they are listed as unsupported and skipped. Captures by key appear in the session list and resume with the same selection.
- **RPM package for Fedora and friends.** Linux x64 releases now include an unsigned `.rpm` next to the AppImage, `.deb` and `.tar.gz`.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Built from merged main through GitHub Actions. Unsigned Windows x64, macOS arm64 and Linux x64 packages carry explicit unsigned names and `SHA256SUMS.txt`; macOS uses ad-hoc integrity signing without Developer ID or notarization. Verified Windows signed installer/ZIP variants, when present, come with `SHA256SUMS-signed-windows-x64.txt`.

The maintainer authorized the 1.0.4 release on 2026-10-24.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.3...v1.0.4)
