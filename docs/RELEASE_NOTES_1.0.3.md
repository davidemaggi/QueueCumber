# QueueCumber 1.0.3

- A small hidden extra for the curious. No hints here: QueueCumber is a serious operational tool, and anyone who finds it will be firmly reminded of that.
- It lives entirely in the window, makes no broker calls and stores nothing. Animation is skipped when the system asks for reduced motion.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Built from merged main through GitHub Actions. Unsigned Windows x64, macOS arm64 and Linux x64 packages carry explicit unsigned names and `SHA256SUMS.txt`; macOS uses ad-hoc integrity signing without Developer ID or notarization. Verified Windows signed installer/ZIP variants, when present, come with `SHA256SUMS-signed-windows-x64.txt`.

Built from merged-main commit `e81acc17ee8261735b307cf67c5fb60764c4774a`. Unsigned run 40083719672 and Windows signing run 40084084334 succeeded; merged-main Checks run 40083719998 passed on Windows, macOS and Linux. All nine downloaded package hashes matched their manifests before publication, and the downloaded macOS bundle passed integrity and version checks.

The maintainer authorized the 1.0.3 release and publication on 2026-10-24. Detailed clean-machine installation/upgrade/uninstaller acceptance remains separate from automated checks.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.2...v1.0.3)
