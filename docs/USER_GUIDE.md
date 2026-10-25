# QueueCumber field guide

## Install and start

Download a package for your OS/architecture from [GitHub Releases](https://github.com/davidemaggi/QueueCumber/releases/latest); Node.js, pnpm and Docker are not required for the packaged app. Follow the [installation steps in the README](../README.md#install), including checksum verification. Current packages target Windows x64, macOS arm64 and Linux x64; Intel Macs, Windows ARM and Linux ARM have no release packages. These are built architectures, not a claim that every OS version has been certified; see the acceptance record.

- Windows: 1.0.1 includes signed installer/ZIP downloads, verified for valid timestamped app/installer signatures and the publisher Open Source Developer Davide Maggi. Check signed files against SHA256SUMS-signed-windows-x64.txt; use SHA256SUMS.txt for unsigned downloads. Run the installer or extract the complete ZIP and launch QueueCumber.exe; keep its supporting files together.
- macOS: the current unsigned channel uses ad-hoc signing without Developer ID/notarization. Review the unsigned release status and OS warnings before choosing to run it. Open the DMG and drag QueueCumber to Applications, or extract the ZIP and move the app there. Do not treat an ad-hoc signature as publisher verification or disable Gatekeeper system-wide.
- Linux: use the DEB through your package manager, make the AppImage executable and open it, or extract the whole tar.gz and run its executable. AppImage/FUSE support depends on the distribution. Retain Chromium's sandbox; do not use `--no-sandbox` as a workaround. Linux tray/keyring availability depends on the desktop.

From the next stable release, the signed Windows installer is submitted to winget (`DavideMaggi.QueueCumber`) and Chocolatey (`queuecumber`). New packages wait for registry review, so `winget install DavideMaggi.QueueCumber` and `choco install queuecumber` work only after approval. Homebrew is planned. There is no automatic updater; install updates deliberately.

## First connection

Choose Add connection, select RabbitMQ or Kafka, and supply the endpoints. RabbitMQ defaults to a two-step guided form: enter AMQP and management hosts/ports plus the virtual host, then choose **Next: credentials** and enter username/password. Back preserves the draft. **Connection URL (advanced)** accepts a full AMQP URL instead. Kafka has separate bootstrap brokers and optional SASL credentials.

Use verified TLS for remote brokers. Custom PEM CAs are supported; never turn off certificate validation. Plain transport requires explicit consent. Saving manually selects the connection and loads its resources; it does not start a capture. Test its endpoints using the connection controls. Edit connection loads the saved endpoints, credentials and TLS settings; change only what you need. Passwords remain masked. Imports remain disconnected until explicitly selected.

Secure mode encrypts profiles and retained history with an OS-protected key. Session-only mode keeps profiles in memory and encrypted captures in a temporary directory. It is intentional when no secure backend is available. Check your OS keyring is unlocked before expecting persistence; a corrupt/locked existing vault requires recovery, not deletion.

For RabbitMQ, AMQP and management URLs are separate. The management URL is the base before `/api`; both use the same credentials. Guided setup encodes credentials and the virtual host for you. Standard ports select TLS automatically (5671/15671/443) or plain transport (5672/15672/80). Custom ports default to TLS; use the TLS checkboxes for your broker configuration. Plain transport still requires explicit consent. Protocols are never downgraded after a failed connection. In advanced mode the vhost comes from the AMQP path (`%2F` for `/`). See the [permission recipe](RABBITMQ.md). For Kafka, all bootstrap and metadata-advertised broker addresses must be reachable; see [authentication and permissions](KAFKA.md).

Dot-only virtual host names (`.` and `..`) are unsupported by guided setup because URL parsing normalizes them; the form rejects them instead of selecting the default virtual host.

## Capture and inspect

Search broker resources on the left, select a queue/stream/topic, review its routes or starting positions, then choose **Start capture**. Selecting alone does not subscribe. Start reuses the existing capture for that connection/destination. Stop preserves its messages; Start resumes in the same history. Queue traffic during a stop cannot be recovered and counts as an observation gap. Streams/Kafka continue from saved offsets when the selected starting options are unchanged; explicitly changing those options repositions the same capture and may repeat retained messages.

Hover a truncated resource name to see it in full. Drag the divider beside the resource list, or focus it and use Left/Right/Home/End, to resize that pane. Resource type and message-count filters apply to broker pages; pages with no matches are skipped up to ten at a time. Continue with the next-page button when more source pages remain. Unknown counts are excluded from with/without-message filters; Kafka does not expose queue-style message counts.

Choose **Routing keys** to browse distinct keys from queue/stream bindings in the connection's virtual host. Expand a key to see exchanges and destinations, then select one to inspect. Discovery is bounded to 10,000 bindings/queues and 100 displayed keys per page; a larger response fails visibly instead of silently truncating it. This is a binding inventory, not a list of keys inferred from message bodies. Implicit default-exchange keys are visible but cannot be mirrored.

For a queue, check only the bindings you want to observe. **Add a routing key manually** takes an exchange and key/pattern; direct and topic exchanges are supported, including topic wildcards. It binds only the owned temporary observation queue. The application queue and its bindings remain unchanged. Fanout/headers routes can be selected from existing bindings; manual keys are not meaningful for those exchange types. Selected bindings must still exist when restarting/reconnecting; a missing selection fails visibly.

For ready-made destinations and traffic, follow the README's [local demo](../README.md#try-a-capture-with-local-demo-traffic).

RabbitMQ queue capture copies supported bindings onto a temporary queue: it sees future routed traffic, never the selected queue's existing backlog. Default-exchange and unknown/distribution exchanges cannot be mirrored; accepting partial coverage can miss routes.

Streams offer beginning, live end or numeric offset. Kafka offers independent positions for up to 128 selected partitions, with exact decimal offsets and no group commits. Kafka reads include uncommitted transactional data. Retention and topology can invalidate positions; notices describe clamps and required restarts.

Select a message to see pretty JSON/text or bounded raw bytes. Headers remain structured and data stays inert. In the Messages list, use **Up/Down**, **Home/End** to select the current page's records; **Tab** leaves the list. Older pages use the paging buttons. Payload/header view buttons announce their pressed state. Raw bytes page in 64 KiB chunks. Counts, omissions, gaps and retained ranges are distinct: a capture is not guaranteed lossless.

To remove a saved connection, select it and choose **Delete connection** below **Edit connection**, then confirm. Its active captures stop and its saved credentials are removed. Capture history remains available in the sidebar for inspection and export; restarting requires a saved connection. Broker resources are not changed.

## Budgets and background mode

Settings sets finite cache, disk, retention, payload and optional admission-rate limits. The form describes units and asks for confirmation before eviction/stopping captures; changes can stop active subscriptions. Per-session limits only narrow global budgets. Cache size is not total RSS. Start with defaults and tune to the machine and traffic; no fixed traffic estimate is required.

Closing keeps QueueCumber running by default. Use the tray to reopen or choose Quit to stop captures and exit. Settings can disable background close; existing saved preferences remain respected. On Linux or tray failure, close minimizes to preserve a visible route. Capture does not continue through machine sleep, explicit Quit, process death or OS shutdown. Restored histories open stopped; start a new capture explicitly. Reconnect within a live session resumes local stream/Kafka progress where possible and exposes observation gaps.

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
