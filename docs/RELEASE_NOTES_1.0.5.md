# QueueCumber 1.0.5

- **The cucumber shows up on Linux.** DEB and RPM packages now install the app icon in every standard size from 16 to 512 px, and the window identifies itself with the same name as its desktop entry. KDE, GNOME and friends can match the running window to the launcher instead of showing a generic icon.
- **winget and Chocolatey.** From this release, the signed Windows installer is submitted automatically to winget (`DavideMaggi.QueueCumber`) and Chocolatey (`queuecumber`) after it is installed and checked on a Windows runner. New packages go through registry review first, so `winget install DavideMaggi.QueueCumber` and `choco install queuecumber` work only once each registry approves them.
- A UI test that was too impatient on slow machines now waits long enough. No app behavior changed.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Built from merged main through GitHub Actions. Unsigned Windows x64, macOS arm64 and Linux x64 packages (AppImage, DEB, RPM, tar.gz) carry explicit unsigned names and `SHA256SUMS.txt`; macOS uses ad-hoc integrity signing without Developer ID or notarization. Verified Windows signed installer/ZIP variants, when present, come with `SHA256SUMS-signed-windows-x64.txt`.

Built from merged-main commit `c92582f1f3bfa02e7abdea791a4231498a6d1f83`. Unsigned run 40188055674 and Windows signing run 40188491321 (rerun after two unit tests exceeded their time limit on the busy signing machine) succeeded; merged-main Checks passed on Windows, macOS and Linux. All ten downloaded package hashes matched their manifests before publication. The downloaded macOS bundle passed integrity and version checks; the RPM installed eight icon sizes on Fedora with a desktop entry matching the window class.

The maintainer authorized the 1.0.5 release and publication on 2026-10-25. Detailed clean-machine installation/upgrade/uninstaller acceptance remains separate from automated checks.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.4...v1.0.5)
