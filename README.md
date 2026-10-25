<div align="center">

<img src="resources/branding/icon.svg" width="128" height="128" alt="QueueCumber application icon" />

# QueueCumber

**A little less queue confusion. A little more cucumber.**

See what's flowing through RabbitMQ and Kafka, without juggling terminals or borrowing an application's consumer.

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/davidemaggi/QueueCumber?label=release)](https://github.com/davidemaggi/QueueCumber/releases/latest)
[![Checks](https://github.com/davidemaggi/QueueCumber/actions/workflows/ci.yml/badge.svg?branch=development)](https://github.com/davidemaggi/QueueCumber/actions/workflows/ci.yml)

</div>

---

> 🥒 **QueueCumber 1.0.5 is out.** [Grab a download](https://github.com/davidemaggi/QueueCumber/releases/latest), [read what changed](docs/RELEASE_NOTES_1.0.5.md), or [tell me what breaks](https://github.com/davidemaggi/QueueCumber/issues). Signed Windows installer and ZIP downloads are available.

## Why

The producer says it sent the event. The consumer says it never arrived. Somewhere there's a routing key, a payload and probably a very long afternoon.

QueueCumber gives you a desktop window into that traffic:

- **Bring your own broker.** Save RabbitMQ and Kafka connections, test them, and browse queues, streams, topics and routing keys. Guided RabbitMQ setup asks for hosts, ports and credentials; full connection URLs work too.
- **Pick what to watch.** Mirror selected RabbitMQ bindings into a temporary observation queue, add a direct/topic route manually, or read a stream or Kafka partition from the beginning, live end or an explicit offset.
- **Make messages readable.** Structured headers, pretty JSON, original bytes and newest/oldest-first history. Stop and restart a capture without creating another copy.
- **Keep long sessions manageable.** Bounded memory cache, encrypted disk history, configurable retention and optional rate limits. Closing the window keeps captures running by default; use Quit to exit.
- **Take it with you.** Export retained messages as JSONL, a folder or ZIP. Move connection profiles between installations with password-encrypted imports and exports.
- **Make yourself at home.** English or Italian, light or dark, with keyboard navigation and a resizable resource list.

## Install

Download a package from [GitHub Releases](https://github.com/davidemaggi/QueueCumber/releases/latest). **You don't need Node.js, pnpm or Docker to run the packaged app.**

| System | Recommended 1.0.5 download | How to install |
| --- | --- | --- |
| Windows x64 | [Signed installer](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-win-x64-signed-setup.exe) | Run the installer, then open QueueCumber. |
| macOS, Apple silicon | [DMG](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-mac-arm64-unsigned.dmg) | Open the DMG and drag QueueCumber into Applications. |
| Debian / Ubuntu, x64 | [DEB](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-linux-amd64-unsigned.deb) | Install with your package manager; see below. |
| Fedora / RHEL / openSUSE, x64 | [RPM](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-linux-x86_64-unsigned.rpm) | Install with your package manager; see below. |
| Other Linux desktops, x64 | [AppImage](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-linux-x86_64-unsigned.AppImage) | Make it executable, then run it; see below. |

Prefer an archive? Releases also include a [signed Windows ZIP](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-win-x64-signed.zip), [macOS ZIP](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-mac-arm64-unsigned.zip) and [Linux tar.gz](https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.5/QueueCumber-1.0.5-linux-x64-unsigned.tar.gz). Extract the whole archive and keep its supporting files together. On Windows, launch `QueueCumber.exe`; on macOS, move `QueueCumber.app` into Applications.

Unsigned Windows packages are available separately. Intel Macs, Windows ARM and Linux ARM don't have release packages yet. Homebrew is planned. Updates are manual for now.

### winget and Chocolatey

Stable releases submit the signed Windows installer to winget and Chocolatey automatically. 1.0.5 is the first submission: a [winget-pkgs pull request](https://github.com/microsoft/winget-pkgs/pull/461371) and a Chocolatey package in moderation. New packages go through a review that can take a few days, so these commands work only once each registry has approved QueueCumber. Until then, use the downloads above.

```powershell
winget install DavideMaggi.QueueCumber
choco install queuecumber
```

### Windows signatures

Choose the files containing **`-signed`**. Their application and installer signatures were verified with a timestamp and publisher **Open Source Developer Davide Maggi**; the ZIP contains the same verified application executable. Unsigned variants are explicitly named `-unsigned`.

Windows may still show a reputation warning for a signed app. Check the file's **Properties → Digital Signatures** and [verify the download](#check-your-download) before deciding to run it. Signing isn't a promise that SmartScreen will stay quiet.

### Opening the app on macOS

The macOS build has an ad-hoc integrity signature, but no Apple Developer ID or notarization. If macOS blocks it because the developer can't be verified, first check the download and its source. If you choose to open it, try launching it once, then use **System Settings → Privacy & Security → Open Anyway** and confirm. See [Apple's instructions](https://support.apple.com/en-us/102445).

### Linux packages

Run these commands from the directory containing your download.

Debian / Ubuntu:

```sh
sudo apt install ./QueueCumber-1.0.5-linux-amd64-unsigned.deb
```

Fedora / RHEL (use `sudo zypper install` on openSUSE):

```sh
sudo dnf install ./QueueCumber-1.0.5-linux-x86_64-unsigned.rpm
```

AppImage:

```sh
chmod +x QueueCumber-1.0.5-linux-x86_64-unsigned.AppImage
./QueueCumber-1.0.5-linux-x86_64-unsigned.AppImage
```

AppImage needs a compatible desktop and FUSE support. If that isn't available, use the DEB, RPM or tar.gz:

```sh
tar -xzf QueueCumber-1.0.5-linux-x64-unsigned.tar.gz
./QueueCumber-1.0.5-linux-x64-unsigned/queuecumber
```

Runtime libraries, tray support, keyrings and Chromium sandbox requirements depend on your distribution. See the [field guide](docs/USER_GUIDE.md) for troubleshooting; keep the sandbox enabled.

### Check your download

Each release includes two SHA-256 manifests: **`SHA256SUMS-signed-windows-x64.txt`** for the signed Windows files, and **`SHA256SUMS.txt`** for all unsigned files. Download the appropriate manifest alongside your package.

On Windows, hash the downloaded file and compare the value with its exact filename in the signed manifest:

```powershell
Get-FileHash .\QueueCumber-1.0.5-win-x64-signed-setup.exe -Algorithm SHA256
Get-Content .\SHA256SUMS-signed-windows-x64.txt
```

On macOS, compare the DMG's hash with its line in `SHA256SUMS.txt`:

```sh
shasum -a 256 QueueCumber-1.0.5-mac-arm64-unsigned.dmg
cat SHA256SUMS.txt
```

On Linux, check the unsigned packages you've downloaded:

```sh
sha256sum --check --ignore-missing SHA256SUMS.txt
```

Stop if a hash differs. Checksums detect a mismatched download; they don't replace publisher-signature verification.

## Your first capture

1. Open **Add connection**, choose RabbitMQ or Kafka, and enter your broker details. For RabbitMQ, supply both AMQP and management hosts/ports, the virtual host, then username and password. Use TLS for remote brokers.
2. Save and test the connection. Search the resource list or filter by type and known message count.
3. Select a destination. For a queue, review the bindings to mirror; for a stream or Kafka topic, choose starting positions and partitions where applicable. Click **Start capture**.
4. Select a message to inspect its headers and body. **Stop** keeps the history; **Start** reuses it. Closing the window keeps it running by default; use **Quit QueueCumber** to exit. Existing saved close preferences remain respected.

RabbitMQ queue inspection sees **newly routed messages**, not messages already waiting in the application queue. It creates its own temporary queue and bindings, which requires broker permissions. The implicit default-exchange route can't be mirrored. Streams read their logs; Kafka reads partitions without joining a consumer group or committing offsets. QueueCumber 1.x offers no publishing, purging or editing of application resources.

The [RabbitMQ permission recipe](docs/RABBITMQ.md), [Kafka guide](docs/KAFKA.md) and [field guide](docs/USER_GUIDE.md) cover authentication, reconnects and the less cucumber-shaped edge cases.

### No broker handy? Try demo traffic

For this optional source-checkout demo, you need the [development setup](#build-it-yourself) and Docker. Run this in a separate terminal:

```sh
pnpm demo
```

It starts disposable local RabbitMQ/Kafka brokers, creates sample destinations and publishes synthetic JSON once per second. Add a RabbitMQ connection with these values:

| Field | Demo value |
| --- | --- |
| AMQP host / port | `127.0.0.1` / `25672` |
| Management host / port | `127.0.0.1` / `25673` |
| Virtual host | `/` |
| Username / password | `cucumber` / `local-test-only` |

Turn off both TLS checkboxes and allow unencrypted transport for this loopback fixture. Choose **Next: credentials**, save, select the **demo.events** stream, choose **Beginning (first retained message)** and start capture.

For a queue, select **demo.orders**, keep the `demo.routes` → `orders.*` binding checked and start capture while the publisher runs. **demo.audit** receives every key from that exchange. Kafka's two-partition **demo.events** topic is available at `localhost:29092`, with TLS off, explicit plain-transport consent and no SASL.

Ctrl+C stops the publisher. `pnpm demo:seed` adds five sample events; `pnpm demo:stop` stops the disposable brokers, also used by integration tests.

## Your data stays local

QueueCumber connects from your computer and needs no QueueCumber server. Private profiles and captured content are encrypted at rest with an OS-protected key. If secure OS storage isn't available, session-only mode keeps profiles in memory and uses a temporary encrypted capture directory.

Connection transfers use password-based scrypt and AES-256-GCM encryption. Secrets are excluded by default; include them explicitly or fill them in after import. Imports don't connect automatically. Use configuration export when moving machines: copying an OS-bound vault isn't a portable backup.

Message dumps are **plaintext**, including headers and payloads. Choose their destination accordingly. A forced exit in session-only mode can leave partial plaintext exports; see [data formats and recovery](docs/DATA_FORMATS.md). Report security issues privately to [me@davidemaggi.dev](mailto:me@davidemaggi.dev); see [SECURITY.md](SECURITY.md).

## Limits worth knowing

Defaults are a 64 MiB cache, 2 GiB disk quota, seven-day retention and 16 MiB retained payloads. Configure these budgets and optional rate limits in Settings. The cache budget isn't a cap on Electron's total memory usage; oversized broker deliveries may allocate memory before omission.

There can be four concurrent captures and 100 retained histories. Starting another history at that limit removes the oldest stopped/failed one. ZIP exports are capped at 10,000 messages; JSONL and folder exports support larger captures. Retention can remove records during export, and observation interruptions can leave gaps. See the [field guide](docs/USER_GUIDE.md) and [validation record](docs/VALIDATION.md) for the details.

## Build it yourself

Use Node.js **22.18+** and the pinned **pnpm 12.15.0**. With Node 22.18, Corepack **0.34.6** supports this pnpm entry point:

```sh
git clone https://github.com/davidemaggi/QueueCumber.git
cd QueueCumber
git switch development
npm install --global corepack@0.34.6
corepack enable pnpm
corepack install
pnpm install --frozen-lockfile
pnpm dev
```

If Corepack reports a missing `bin/pnpm.cjs`, update Corepack, run `corepack cache clean` and `corepack install`, then retry. This refreshes downloaded package managers. Keep `ELECTRON_RUN_AS_NODE` unset when launching the desktop app; some IDEs export it.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For broker integration and desktop tests, start the synthetic fixtures first:

```sh
docker compose -p queuecumber-test -f compose.test.yml up -d --wait
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose -p queuecumber-test -f compose.test.yml down
```

Fixtures bind loopback ports only and contain public test-only credentials and certificates. Never deploy them as real infrastructure.

All distribution builds run through GitHub Actions after a PR merges into `main`. Hosted runners build unsigned packages; an available self-hosted runner adds verified signed Windows variants. See [release tooling](docs/RELEASING.md). Source checks and package hashes are verified; detailed clean-machine, cloud-provider and OS-keystore results remain explicit in [acceptance](docs/ACCEPTANCE.md) and [validation](docs/VALIDATION.md).

## Contributing and what's next

Broker edge cases, reproducible bugs and useful ideas are welcome. Open an [issue](https://github.com/davidemaggi/QueueCumber/issues) with sanitized examples, branch off `development`, and keep the relevant checks green. Leave real credentials and private messages out of reports.

Homebrew, the winget/Chocolatey review status and remaining platform acceptance are tracked in the [roadmap](ROADMAP.md). Product decisions live in [PRODUCT.md](PRODUCT.md), architecture in the [project plan](docs/PROJECT_PLAN.md), and AI workflow conventions in [AGENTS.md](AGENTS.md).

## Versions

[SemVer](https://semver.org/), with Star Wars character names for major/minor releases: major 1 uses A, major 2 uses B, and so on. **1.0.0 is Ackbar.** Patch releases such as 1.0.5 don't get a character name.

## License

[MIT](LICENSE), copyright 2026 Davide Maggi. Public Sans is bundled under the [SIL Open Font License](src/renderer/public/licenses/PublicSans-OFL.txt); other dependencies retain their own licenses.

---

<div align="center">

_A fresh look at your queues._ 🥒

</div>
