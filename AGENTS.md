# Working on QueueCumber

Read [PRODUCT.md](PRODUCT.md) for confirmed product truth and [ROADMAP.md](ROADMAP.md) for scope. Before architecture or implementation work, read [the proposal](docs/PROJECT_PLAN.md), including its approval status. Keep proposals distinct from approved decisions.

Architecture was approved on 2026-10-22. The MVP implementation plan at `docs/superpowers/plans/2026-10-22-rabbitmq-mvp.md` was also approved; native execution is authorized. Documentation and repository preparation are authorized.

## Workflow

- Version shared skill sources, launchers, `skills-lock.json` and portable hooks. Ignore downloaded platform binaries and local runtime output; keep `AGENTS.md` tracked. Review hook changes as executable code.

- Work on `development`; base isolated feature branches on it when needed. Preserve unrelated changes. Never push, publish or tag a release without authorization.
- When the maintainer authorizes a whole milestone, execute its full scope continuously, including verification, review and documentation; report the integrated result instead of stopping between blocks.
- Build every distribution/release artifact through GitHub Actions; publish through GitHub Releases. Local packaging is for development only. For packaging, signing or release work, read [docs/RELEASING.md](docs/RELEASING.md). Windows signing uses Azure Artifact Signing; maintainer account notes belong in ignored `maintainer-local/`.
- Keep README instructions accurate for what runs. Update ROADMAP when status/scope changes and PRODUCT when confirmed requirements change.
- Write documentation, identifiers and comments in English; follow the user's language in conversation. Use a friendly developer voice and restrained humor. Keep errors and security instructions plain.
- Follow ROADMAP's SemVer/schema policy. Never invent releases, screenshots, benchmarks, install commands or compatibility claims.
- Prefer small working vertical slices and focused modules. Put provider-specific behavior behind explicit capabilities rather than scattered UI conditions.

## Interface work

- For new screens, use `.agents/skills/design-taste-frontend/SKILL.md` and its app-screen reference. QueueCumber is an operational desktop tool: prioritize scanning, useful density and precise states.
- For UI review/improvement, use `.agents/skills/impeccable/SKILL.md`. Run its context launcher once per session as directed. PRODUCT exists: repeat init only when product context needs updating. Keep workflow preferences outside PRODUCT.
- Establish visual direction during the approved UI stage. Preserve cucumber-inspired branding; no final logo exists.
- Localize strings from the start, use English fallback and verify a second locale. Support light/dark/system themes, keyboard operation, visible focus, accessible names and status beyond color alone.
- Inspect rendered screens at supported window sizes in both themes, including empty/loading/error/disconnected states and dense message lists. Report what was actually inspected.

## Broker and data boundaries

The proposal's RabbitMQ capture contract governs observation. Never consume or acknowledge from application queues. Owned temporary observation queues/bindings are explicitly permitted; editing other broker resources is not.

- Keep credentials and broker/file access out of the renderer. Validate IPC data and callers; expose narrowly scoped operations.
- Treat messages, headers, imports, connection strings and filenames as untrusted. Preserve original bytes; render content as data.
- Encrypt private connection data and sensitive captures at rest. Use OS-backed key protection; fail closed for persistence when protection is unavailable. Redact secrets from logs/errors.
- Bound RAM, disk, IPC batches, pending writes and formatting work. Make overflow and capture gaps visible.
- Commit only synthetic sanitized fixtures. Keep private data outside the repository; `.gitignore` is not a security boundary.

## Verification

Prove changed behavior at its boundary: real-broker integration tests for routing/reconnects, measurements for capture resources, tamper/wrong-password tests for imports, interaction checks for UI flows. Run relevant checks before claiming success and report skipped checks. A single-OS run does not establish cross-platform support.
