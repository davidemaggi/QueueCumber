# QueueCumber field guide

## Install and start

Before a published GitHub Release exists, run the source with the README's development commands. Do not trust an install command that points to a package that does not exist yet.

Once available, download the asset matching your OS/architecture from this repository's GitHub Releases and verify it against the same release's SHA256SUMS.txt. Planned first targets are Windows x64 (NSIS installer or ZIP), macOS arm64 (DMG or ZIP) and Linux x64 (AppImage, DEB or tar.gz). These are build targets; actual platform certification lives in the acceptance record. Intel Macs, Windows ARM and Linux ARM have no prepared distribution target.

- Windows: choose the explicitly labeled unsigned 1.0.0 download, or a verified signed variant when available from 1.0.1. Record expected OS warnings on unsigned builds; verify Authenticode/publisher on signed variants. Run the installer or extract the complete ZIP; keep its supporting files together.
- macOS: the current unsigned channel uses ad-hoc signing without Developer ID/notarization. Review the unsigned release status and OS warnings before choosing to run it. Open the DMG and drag QueueCumber to Applications, or extract the ZIP and move the app there. Do not treat an ad-hoc signature as publisher verification or disable Gatekeeper system-wide.
- Linux: use the DEB through your package manager, make the AppImage executable and open it, or extract the whole tar.gz and run its executable. AppImage/FUSE support depends on the distribution. Retain Chromium's sandbox; do not use `--no-sandbox` as a workaround. Linux tray/keyring availability depends on the desktop.

Homebrew, WinGet and Chocolatey will follow verified release assets and registry acceptance. No automatic updater or automatic package-manager enrollment is implemented; install updates deliberately.

## First connection

Choose Add connection, select RabbitMQ or Kafka, and supply the endpoints. Use verified TLS for remote brokers. Custom PEM CAs are supported; never turn off certificate validation. Plain transport requires explicit consent. Save, select the connection, then test it. Stored secrets are not prefilled when editing: re-enter the complete settings.

Secure mode encrypts profiles and retained history with an OS-protected key. Session-only mode keeps profiles in memory and encrypted captures in a temporary directory. It is intentional when no secure backend is available. Check your OS keyring is unlocked before expecting persistence; a corrupt/locked existing vault requires recovery, not deletion.

For RabbitMQ, AMQP and management URLs are separate. The management URL is the base before `/api`; use the AMQP user's credentials for both. The vhost comes from the AMQP path (`%2F` for `/`). See the [permission recipe](RABBITMQ.md). For Kafka, all bootstrap and metadata-advertised broker addresses must be reachable; see [authentication and permissions](KAFKA.md).

## Capture and inspect

Search broker resources, select a queue/stream/topic and review the capture scope. RabbitMQ queue capture copies supported bindings onto a temporary queue: it sees future routed traffic, never the selected queue's existing backlog. Default-exchange and unknown/distribution exchanges cannot be mirrored; accepting partial coverage can miss routes.

Streams offer beginning, live end or numeric offset. Kafka offers independent positions for up to 128 selected partitions, with exact decimal offsets and no group commits. Kafka reads include uncommitted transactional data. Retention and topology can invalidate positions; notices describe clamps and required restarts.

Select a message to see pretty JSON/text or bounded raw bytes. Headers remain structured and data stays inert. In the Messages list, use **Up/Down**, **Home/End** to select the current page's records; **Tab** leaves the list. Older pages use the paging buttons. Payload/header view buttons announce their pressed state. Raw bytes page in 64 KiB chunks. Counts, omissions, gaps and retained ranges are distinct: a capture is not guaranteed lossless.

## Budgets and background mode

Settings sets finite cache, disk, retention, payload and optional admission-rate limits. The form describes units and asks for confirmation before eviction/stopping captures; changes can stop active subscriptions. Per-session limits only narrow global budgets. Cache size is not total RSS. Start with defaults and tune to the machine and traffic; no fixed traffic estimate is required.

Closing quits by default. Enable background close in Settings to continue capture, then use the tray to reopen or Quit. On Linux or tray failure, close minimizes to preserve a visible route. Capture does not continue through machine sleep, explicit Quit, process death or OS shutdown. Restored histories open stopped; start a new capture explicitly. Reconnect within a live session resumes local stream/Kafka progress where possible and exposes observation gaps.

## Move profiles and save messages

Settings exports/imports `.qcc` password-encrypted configuration. Use a strong password of at least 12 characters and share it separately. Secrets are excluded by default. Inspect the conflict preview: copy, skip and replace have different effects. Machine-local limits, themes and OS keys are not transferred.

Dump locally retained data as JSONL, folder or ZIP. Dumps contain plaintext headers and payloads; ordinary ZIP is not encryption. Retention can remove records during export; read its final manifest. Cancel or Quit removes partial output normally. Session-only forced termination can leave `.queuecumber-export-*` partials beside the destination. Read [data formats](DATA_FORMATS.md) before building scripts around exports.

## Troubleshooting

| Symptom | Check / action |
| --- | --- |
| Connection fails | Reachable endpoints, vhost, TLS hostname/CA, credentials and broker permissions. RabbitMQ needs both AMQP and management; Kafka needs advertised hosts reachable too. |
| Connected, no resources | Correct vhost/topic ACLs and search/filter. Discovery is bounded; very large metadata sets can be rejected. |
| Capture has no messages | Future traffic versus backlog, bindings/partial coverage, start position and publisher routing. Check omissions/gaps and failure status. |
| Failed rather than reconnecting | Authentication/authorization, deleted/recreated topic, unsupported route or storage failure need action. Correct the cause and start a new capture. |
| Local service unavailable | Restart QueueCumber; interrupted captures may have gaps. Keep a sanitized reproduction for a bug report. |
| Session-only storage | Unlock/install a supported OS keyring. Linux basic_text is deliberately refused. Do not delete encrypted data to fix key access. |
| Cannot unlock saved data | Use the original OS account/keychain and complete backup. Reinstalling cannot recreate a lost key. Do not overwrite/delete the originals; recovery may require the original machine. |
| Disk/cache limit reached | Eviction/omission is expected. Increase within allowed limits or export earlier. A disk write error stops capture; free space before restarting. |
| Import rejected | Correct password, intact supported `.qcc` file, current app and size limits. Failed imports leave profiles unchanged. |
| Signed app will not open | Check the asset’s signed/unsigned label, checksum and supported architecture; verify publisher signatures only on the signed channel. Report the exact OS/error; do not bypass OS protections. |

Before upgrading, Quit and back up the complete app user-data directory through a trusted OS backup. OS-protected keys are not portable backups: export `.qcc` separately for another machine. Portable captures are dumps, not a history-import format. Uninstall behavior and data locations must be confirmed on the acceptance machines; Electron normally uses `%APPDATA%/QueueCumber` on Windows, `~/Library/Application Support/QueueCumber` on macOS and `$XDG_CONFIG_HOME/QueueCumber` (or `~/.config/QueueCumber`) on Linux. Actual name/path comes from the running build's userData location. Do not remove it while the app is running.
