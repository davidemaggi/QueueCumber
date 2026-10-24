# QueueCumber 1.0.4

- **Routing keys are now one flat list.** Choose **Resource type → Routing keys** to see every distinct key found in the broker's bindings, filterable by search. Default-exchange bindings are hidden: they are implicit per-queue names, not keys you can observe.
- **Capture by routing key.** Tick one or more keys (up to 64) and start a capture. QueueCumber binds one temporary observation queue to every direct or topic exchange that routes those keys. New traffic only; application queues are never consumed or changed. Fanout, headers and default-exchange routes ignore the key, so they are listed as unsupported and skipped. Captures by key appear in the session list and resume with the same selection.
- **RPM package for Fedora and friends.** Linux x64 releases now include an unsigned `.rpm` next to the AppImage, `.deb` and `.tar.gz`.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Built from merged main through GitHub Actions. Unsigned Windows x64, macOS arm64 and Linux x64 packages carry explicit unsigned names and `SHA256SUMS.txt`; macOS uses ad-hoc integrity signing without Developer ID or notarization. Verified Windows signed installer/ZIP variants, when present, come with `SHA256SUMS-signed-windows-x64.txt`.

Built from merged-main commit `95211cc6cdad87a73a211c1e1840f66ab6496625`. Unsigned run 40114239762 (Windows packaging rerun after a slow-runner test timeout) and Windows signing run 40115085073 (rerun after a timing-flaky UI test) succeeded; merged-main Checks run 40114239559 passed on Windows, macOS and Linux. All ten downloaded package hashes matched their manifests before publication. The downloaded macOS bundle passed integrity and version checks, and the RPM installed with dnf on Fedora and started under Xvfb (amd64 emulation).

The maintainer authorized the 1.0.4 release and publication on 2026-10-24. Detailed clean-machine installation/upgrade/uninstaller acceptance remains separate from automated checks.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.3...v1.0.4)
