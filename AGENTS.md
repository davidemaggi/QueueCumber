# Working on QueueCumber

Read [PRODUCT.md](PRODUCT.md) for confirmed product truth and [ROADMAP.md](ROADMAP.md) for scope. Before architecture or implementation work, read [the proposal](docs/PROJECT_PLAN.md), including its approval status. Keep proposals distinct from approved decisions.

Architecture was approved on 2026-10-22. The MVP implementation plan at `docs/superpowers/plans/2026-10-22-rabbitmq-mvp.md` was also approved; native execution is authorized. Documentation and repository preparation are authorized.

## Workflow

- Version shared skill sources, launchers, `skills-lock.json` and portable hooks. Ignore downloaded platform binaries and local runtime output; keep `AGENTS.md` tracked. Review hook changes as executable code.

- Work on `development`; base isolated feature branches on it when needed. Preserve unrelated changes. Never push, publish or tag a release without authorization.
- When the maintainer authorizes a whole milestone, execute its full scope continuously, including verification, review and documentation; report the integrated result instead of stopping between blocks.
- Build every distribution/release artifact through GitHub Actions, only after a pull request merges into `main`; publish through GitHub Releases. Keep ordinary development/PR compilation checks separate from release packaging. Local packaging is for development only. For packaging, signing or release work, read [docs/RELEASING.md](docs/RELEASING.md). Release 1.0.0 is unsigned. From 1.0.1, always build unsigned variants on GitHub runners and optionally add verified Windows-signed variants from an available self-hosted runner; unsigned output must not wait for signing. See RELEASING for preflight/watchdog and runner credentials. Maintainer setup notes belong in ignored `maintainer-local/`.
- Keep README instructions accurate for what runs. Update ROADMAP when status/scope changes and PRODUCT when confirmed requirements change.
- Write documentation, identifiers and comments in English; follow the user's language in conversation. Use a friendly developer voice and restrained humor. Keep errors and security instructions plain.
- Follow ROADMAP's SemVer/schema and Star Wars release-name policy (1.0.0 Ackbar; A for major 1, B for major 2; patch releases unnamed). Never invent releases, screenshots, benchmarks, install commands or compatibility claims.
- Prefer small working vertical slices and focused modules. Put provider-specific behavior behind explicit capabilities rather than scattered UI conditions.

## Package managers

- Stable releases go to **winget** (`DavideMaggi.QueueCumber`), **Chocolatey** (`queuecumber`), **Homebrew** (cask `queuecumber` in the shared tap `davidemaggi/homebrew-tap`), **Cloudsmith** (apt and dnf, `davidemaggi/dm-queuecumber`, package `queuecumber`) and the **AUR** (`queuecumber-bin`, built and tested but not pushed while `aur.enabled` is false). Nothing is rebuilt: every channel uses files already on the release. Pre-releases are never submitted.
- `publish-packages.yml` runs when the maintainer publishes a release and calls the reusable `package-managers.yml` with a `channels` list: `homebrew,aur,cloudsmith` for every stable tag, plus `winget,chocolatey` only when the release carries the verified signed installer and `SHA256SUMS-signed-windows-x64.txt`. No signed installer means no Windows submission.
- Names, publisher, URLs, descriptions (en-US, it-IT), tags, the 256 px icon and each channel's settings live in `packaging/package-managers.json`. Built-in modules only: `scripts/package-managers.mjs` writes the winget manifests (schema 1.10.0, no Icons) and the Chocolatey package, with release notes from `docs/RELEASE_NOTES_<version>.md` up to its Downloads section; `scripts/package-managers-unix.mjs` writes the cask, the PKGBUILD and the dnf `.repo` file from `SHA256SUMS.txt`. Change wording there, not in the workflow.
- Only arm64 macOS and x64 Linux files exist, so the cask declares `depends_on arch: :arm64` and the AUR, deb and rpm packages are x86_64 only. The app isn't notarized: the cask clears the quarantine with `postflight_steps` (Homebrew 7 rejects `postflight do`). QueueCumber has no CLI, so nothing goes on the PATH besides the Linux packages' own `/usr/bin/queuecumber` launcher.
- Each job installs the real package before it publishes. Windows: hash and Authenticode check, install, app version and start, uninstall; winget reads the product code, display name and publisher from HKCU, validates and installs from the manifests; Chocolatey packs, installs, checks and uninstalls. Homebrew: `brew style`, `brew audit --online`, install, quarantine gone, version, start, `uninstall --zap`. AUR: `.SRCINFO` and `makepkg -si` in `archlinux:latest`. Cloudsmith: the .deb and .rpm on `ubuntu:24.04` and `fedora:latest`, then again from the repository after upload. Linux checks share `scripts/check-linux-install.sh` (package version, `ldd`, desktop entry and icon, start under Xvfb).
- dnf uses our own `.repo` file without `sslcacert`: Cloudsmith's `setup.rpm.sh` points at `/etc/pki/tls/certs/ca-bundle.crt`, which Fedora 43+ lacks. The README must keep Cloudsmith's attribution (badge and "free for open-source projects"); without it the free repository can be suspended.
- Secrets: `WINGET_TOKEN` (classic token, `public_repo`), `CHOCOLATEY_API_KEY`, `HOMEBREW_TAP_TOKEN` (fine-grained, Contents read/write on `davidemaggi/homebrew-tap`), `CLOUDSMITH_API_KEY` (service account with Write on the repository) and, once AUR registrations reopen, `AUR_SSH_PRIVATE_KEY`. Without one, that step is skipped with a notice. The tap is shared with other projects: publication commits `<cask> <version>` as github-actions[bot] and retries the push with `pull --rebase`. Submitted is not approved: new winget and Chocolatey packages wait for registry review.
- To retry a tag, publish an existing release on some channels only, or try without publishing, run **Package managers** by hand (tag, `channels`, submit off). Never open winget-pkgs PRs, push Chocolatey packages, edit the tap, push to the AUR or upload to Cloudsmith manually.

## Interface work

- For new screens, use `.agents/skills/design-taste-frontend/SKILL.md` and its app-screen reference. QueueCumber is an operational desktop tool: prioritize scanning, useful density and precise states.
- For UI review/improvement, use `.agents/skills/impeccable/SKILL.md`. Run its context launcher once per session as directed. PRODUCT exists: repeat init only when product context needs updating. Keep workflow preferences outside PRODUCT.
- Use the supplied artwork in `resources/branding/`; read its README when changing icons or the mark. Preserve the SVG sources and regenerate native exports with the documented script.
- Localize strings from the start, use English fallback and verify a second locale. Support light/dark/system themes, keyboard operation, visible focus, accessible names and status beyond color alone.
- Inspect rendered screens at supported window sizes in both themes, including empty/loading/error/disconnected states and dense message lists. Report what was actually inspected.

## Broker and data boundaries

The proposal's RabbitMQ capture contract governs observation. Never consume or acknowledge from application queues. Owned temporary observation queues/bindings are explicitly permitted; editing other broker resources is not.

- Keep broker/file access and routine credential state out of the renderer. Explicit editing may load one selected profile through validated IPC into a masked local form; never persist it in renderer storage or include credentials in summaries/logs. Validate IPC data and callers; expose narrowly scoped operations.
- Treat messages, headers, imports, connection strings and filenames as untrusted. Preserve original bytes; render content as data.
- Encrypt private connection data and sensitive captures at rest. Use OS-backed key protection; fail closed for persistence when protection is unavailable. Redact secrets from logs/errors.
- Bound RAM, disk, IPC batches, pending writes and formatting work. Make overflow and capture gaps visible.
- Commit only synthetic sanitized fixtures. Keep private data outside the repository; `.gitignore` is not a security boundary.

## Verification

Prove changed behavior at its boundary: real-broker integration tests for routing/reconnects, measurements for capture resources, tamper/wrong-password tests for imports, interaction checks for UI flows. Run relevant checks before claiming success and report skipped checks. A single-OS run does not establish cross-platform support.
