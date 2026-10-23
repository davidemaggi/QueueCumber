# QueueCumber 1.0.2

- Closing the window keeps QueueCumber running in the background by default for installations without saved desktop preferences. Reopen from the tray; use **Quit QueueCumber** to stop captures and exit. Linux and unavailable-tray environments retain an accessible minimized window.
- Existing saved close preferences remain respected. To enable background mode on an existing installation, select **Settings → Background capture → Keep running when the window closes**. Unreadable or corrupt desktop preferences still disable background close and show a warning.
- Select a saved connection and choose **Delete connection** below **Edit connection**. Confirmation explains that active captures stop and saved credentials are removed, while capture history remains available for inspection and export. Other connections and broker resources are unchanged.
- Deleted connections cannot restart captures. Retained Kafka history preserves its provider context; failed captures preserve their failure status when a profile is removed.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Windows x64 includes signed installer and ZIP downloads, verified on WIN_MBA with valid timestamped Authenticode signatures and publisher `Open Source Developer Davide Maggi`. The ZIP carries the same verified application executable. Verify these downloads with `SHA256SUMS-signed-windows-x64.txt`.

Unsigned Windows x64, macOS arm64 and Linux x64 packages remain available with explicit unsigned names and `SHA256SUMS.txt`. macOS uses ad-hoc integrity signing without Developer ID or notarization. All nine downloaded package hashes matched their manifests before publication.

Built from merged-main commit `8367103c10d24ca2b147d4cd592f48e99fff828d` through GitHub Actions. Checks passed 99 unit tests on each platform, 33 broker integration tests and eight desktop tests on Linux, plus four desktop tests on each of Windows and macOS. The downloaded macOS application also passed local integrity, version, service, tray-close/reopen, connection-deletion and explicit-Quit checks with session-only synthetic data. Windows signing passed the same 99 unit tests before packaging.

The maintainer authorized the complete 1.0.2 release and publication on 2026-10-23. Detailed clean-machine installation/upgrade/uninstaller acceptance remains separate from automated checks.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.1...v1.0.2)
