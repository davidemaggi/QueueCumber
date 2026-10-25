# QueueCumber 1.0.5

- **The cucumber shows up on Linux.** DEB and RPM packages now install the app icon in every standard size from 16 to 512 px, and the window identifies itself with the same name as its desktop entry. KDE, GNOME and friends can match the running window to the launcher instead of showing a generic icon.
- **winget and Chocolatey.** From this release, the signed Windows installer is submitted automatically to winget (`DavideMaggi.QueueCumber`) and Chocolatey (`queuecumber`) after it is installed and checked on a Windows runner. New packages go through registry review first, so `winget install DavideMaggi.QueueCumber` and `choco install queuecumber` work only once each registry approves them.
- A UI test that was too impatient on slow machines now waits long enough. No app behavior changed.

English and Italian labels are included. Configuration and dump schemas are unchanged. Patch releases have no character name.

## Downloads and verification

Built from merged main through GitHub Actions. Unsigned Windows x64, macOS arm64 and Linux x64 packages (AppImage, DEB, RPM, tar.gz) carry explicit unsigned names and `SHA256SUMS.txt`; macOS uses ad-hoc integrity signing without Developer ID or notarization. Verified Windows signed installer/ZIP variants, when present, come with `SHA256SUMS-signed-windows-x64.txt`.

The maintainer authorized the 1.0.5 release on 2026-10-25.

[Full changelog](https://github.com/davidemaggi/QueueCumber/compare/v1.0.4...v1.0.5)
