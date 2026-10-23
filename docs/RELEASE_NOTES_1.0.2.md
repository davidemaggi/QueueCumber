# QueueCumber 1.0.2

- Closing the window keeps QueueCumber running in the background by default for installations without saved desktop preferences. Reopen from the tray; use **Quit QueueCumber** to stop captures and exit. Linux and unavailable-tray environments retain an accessible minimized window.
- Existing saved close preferences remain respected. To enable background mode on an existing installation, select **Settings → Background capture → Keep running when the window closes**. Unreadable or corrupt desktop preferences still disable background close and show a warning.
- Select a saved connection and choose **Delete connection** below **Edit connection**. Confirmation explains that active captures stop and saved credentials are removed, while capture history remains available for inspection and export. Other connections and broker resources are unchanged.
- Deleted connections cannot restart captures. Retained Kafka history preserves its provider context; failed captures preserve their failure status when a profile is removed.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Release preparation uses GitHub Actions builds from the exact merged-main commit. Unsigned Windows x64, macOS arm64 and Linux x64 assets have explicit unsigned names and `SHA256SUMS.txt`. macOS uses ad-hoc integrity signing without Developer ID or notarization. A separate optional self-hosted workflow may attach verified signed Windows installer/ZIP assets with `SHA256SUMS-signed-windows-x64.txt`.

Local verification before release preparation: 99 unit tests and four native Electron tests on macOS, including default background close, reopen, explicit Quit, opt-out, English/Italian deletion, light/dark layouts and a real RabbitMQ capture retaining 52 synthetic messages after profile deletion. Detailed clean-machine installation/upgrade/uninstaller acceptance remains separate from automated checks.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.1...v1.0.2)
