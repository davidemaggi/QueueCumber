# RabbitMQ MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the 0.1.0 RabbitMQ inspection workflow with secure connections, mirrored bindings, bounded encrypted captures and a localized desktop UI.

**Architecture:** Sandboxed React renderer, a narrow preload bridge, Electron main for OS integration and a utility process for broker/storage work. One repository with focused modules and an explicit provider capability seam.

**Tech Stack:** Electron, React, strict TypeScript, Vite, pnpm, electron-builder; Vitest and real-broker integration fixtures. Select maintained compatible versions at execution time.

**Spec:** [Approved architecture](../../PROJECT_PLAN.md), [product](../../../PRODUCT.md), [roadmap](../../../ROADMAP.md).

**Status:** Approved on 2026-10-22. Native execution selected; implementation in progress.

## Global constraints

- Work on `development`, preserve pre-existing skill/config changes and commit only task-owned files.
- English default and English documentation; Italian translations; light/dark/system themes.
- Never consume or acknowledge from application queues. Mirror supported bindings onto owned temporary queues only.
- Encrypt private connections and captured sensitive content. Renderer receives neither credentials nor broad privileged APIs.
- Resource settings are configurable; no expected user traffic estimate is required. Finite global bounds remain mandatory.
- No claims of tested platform/provider support without evidence. No publishing or release tags in this plan.

## Review focus

1. Quota reduction during capture/export must not invalidate retained-data access silently (Task 2 and Task 4).
2. Oversized deliveries may already be buffered by the broker client: report rejection honestly and measure allocation (Task 4 and Task 6).
3. Partial binding setup and connection loss must clean up owned resources without touching originals (Task 5).
4. Imported/malformed connection fields and malicious payloads must not escape privileged boundaries (Task 3 and Task 6).
5. Worker crash or disk failure must produce visible capture gaps rather than silent retries or unbounded buffers (Task 4–6).

## Files and responsibilities

| Files | Responsibility |
| --- | --- |
| `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `electron.vite.config.ts`, `electron-builder.yml` | Build/run/test/package configuration |
| `src/main/index.ts`, `src/main/ipc.ts`, `src/preload/index.ts` | Desktop lifecycle and privileged bridge |
| `src/shared/contracts.ts`, `src/shared/limits.ts` | Versioned data/IPC contracts and resource validation |
| `src/service/index.ts`, `src/service/sessions.ts` | Utility service and session lifecycle |
| `src/service/settings.ts`, `src/service/storage.ts`, `src/main/vault.ts` | Settings, encrypted capture persistence and protected credentials |
| `src/service/providers/provider.ts`, `src/service/providers/rabbitmq.ts` | Provider capability boundary and RabbitMQ operations |
| `src/renderer/App.tsx`, `src/renderer/styles.css`, `src/renderer/components/*` | Desktop inspection UI |
| `src/renderer/locales/en.json`, `src/renderer/locales/it.json` | Localized copy |
| `tests/unit/*`, `tests/integration/*`, `tests/e2e/*`, `tests/fixtures/*` | Boundary tests and synthetic data |
| `compose.test.yml`, `.github/workflows/ci.yml` | Disposable broker fixture and platform checks |

Split components by actual responsibility; the wildcard does not require a prebuilt component framework. Add configuration files required by selected tooling within their owning task.

## Starting settings — proposed defaults for validation

These are adjustable starting points, not supported-throughput claims. Store bytes as integers; display MiB/GiB accurately. Keep a versioned settings schema and restore-defaults action.

| Setting | Initial value | Behavior |
| --- | --- | --- |
| Global capture cache | 64 MiB | Evict oldest RAM entries; retain paged disk access |
| Total capture disk quota | 2 GiB | Evict oldest eligible captures; account for journals/temporary headroom |
| Capture retention age | 7 days | Evict eligible older records even below quota |
| Maximum retained payload | 16 MiB | Record an omission marker, not a silently truncated full message |
| Preview/pretty-print input | 256 KiB | Larger content gets bounded raw access rather than eager formatting |
| Session admitted rate | Disabled | Optional positive messages/second; rejected observations produce gap counts |

Per-session limits can only narrow the global envelope. Validate positive finite safe integers and budget relationships. Reject zero/NaN/infinity for budgets; an optional disabled rate is a separate value. Choose finite internal IPC/prefetch/pending-write limits compatible with active sessions and payload sizes during Task 4; measure them before enabling capture.

The RAM setting controls capture-cache bytes, not total process RSS. Allocation in the runtime/client requires separate measurement. Live setting changes must be validated and preview destructive effects; a required subscription restart must be explicit. A read-only settings change must not change an application queue's policy.

## Task 1: Secure runnable desktop boundary

**Files:** Build/config files; `src/main/index.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/service/index.ts`, `src/shared/contracts.ts`; `tests/e2e/desktop.test.ts`.

**Interfaces:** Define `AppStatus = { service: 'ready' | 'failed' }` and expose only `getStatus(): Promise<AppStatus>` initially. Extend the bridge explicitly in later tasks, never through a generic invoke method.

- [ ] Inspect local Node/package-manager tooling, select compatible maintained dependency versions and create the minimal scaffold with scripts `dev`, `build`, `typecheck`, `test`, `test:integration`, `test:e2e` and `lint`.
- [ ] Write a failing desktop smoke test: `await getStatus()` returns `{service:'ready'}`; renderer has no Node/filesystem access; unknown IPC operations and untrusted senders are rejected.
- [ ] Run `pnpm test:e2e`; confirm a meaningful failing assertion once the test harness launches, not merely missing tooling.
- [ ] Implement main/preload/service startup with context isolation, sandbox and restrictive CSP. Handle startup failure in visible UI. Document the runnable commands in README.
- [ ] Run `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`; require successful build and all smoke assertions passing. Commit only this task's files.

## Task 2: Validated resource settings

**Files:** `src/shared/limits.ts`, `src/service/settings.ts`, `tests/unit/settings.test.ts`.

**Interfaces:** `CaptureSettings = { schemaVersion: 1; cacheBytes: number; diskBytes: number; retentionMs: number; maxPayloadBytes: number; previewBytes: number; admittedMessagesPerSecond: number | null }`; `validateSettings(input: unknown): CaptureSettings`; `resolveSessionSettings(global: CaptureSettings, overrides: Partial<CaptureSettings>): CaptureSettings`. Settings repository exposes `read()` and atomic `save(settings)`.

- [ ] Write failing tests asserting the table's exact defaults, rejection of negative/zero/nonfinite/unsafe integers, `previewBytes <= maxPayloadBytes`, and prevention of session overrides bypassing global limits.
- [ ] Add tests that invalid saved settings cannot activate capture, failed writes retain prior settings, and quota reductions return an explicit pending-effects preview before application.
- [ ] Run `pnpm test -- tests/unit/settings.test.ts` and verify the new assertions fail.
- [ ] Implement schema validation, atomic persistence, default recovery with a visible warning and a service operation for validated changes. Keep settings outside the checkout.
- [ ] Run the focused test plus `pnpm typecheck`; require all assertions passing. Commit task files.

## Task 3: Secure connection profiles and discovery

**Files:** `src/main/vault.ts`, `src/shared/contracts.ts`, `src/service/providers/provider.ts`, `src/service/providers/rabbitmq.ts`, `tests/unit/vault.test.ts`, `tests/integration/discovery.test.ts`, `compose.test.yml`.

**Interfaces:** Define privileged `ConnectionProfile`, renderer-safe `ConnectionSummary` and native `ResourceRef`. Expose `saveConnection(input): Promise<ConnectionSummary>`, `testConnection(id): Promise<{protocol: EndpointStatus; management: EndpointStatus}>` and `listResources(id, query, cursor): Promise<ResourcePage>`. Credentials are accepted only by the save/test form operations and never returned in summaries or errors.

- [ ] Write failing tests for encrypted full-record round trips, tampered records, unavailable OS protection, Linux insecure-backend rejection and redacted errors. Use injected keystore fixtures; add real OS smoke checks separately.
- [ ] Add integration fixtures for paginated resources, URL-encoded vhosts, denied management with working protocol access, invalid certificates and malformed endpoints. Assert no original queue mutation.
- [ ] Run `pnpm test -- tests/unit/vault.test.ts` and `pnpm test:integration -- tests/integration/discovery.test.ts`; verify meaningful failures against a running disposable broker.
- [ ] Implement protected-key handling, narrow profile operations and independent endpoint testing/discovery. Use maintained AMQP and validation dependencies only where needed. Reject unsafe protocols and validate endpoint fields before network access.
- [ ] Re-run focused tests, typecheck and OS protection smoke checks available on the host. Record unavailable platforms. Commit task files.

## Task 4: Bounded encrypted captures

**Files:** `src/service/storage.ts`, `src/shared/contracts.ts`, `tests/unit/storage.test.ts`, `tests/integration/capture-load.test.ts`.

**Interfaces:** `CaptureRecord` preserves raw payload, typed headers, local sequence and provenance. `append(sessionId, records): Promise<AppendResult>`, `readPage(sessionId, cursor, limit): Promise<CapturePage>`, `applyRetention(settings): Promise<RetentionResult>` and `close(): Promise<void>`. Only ciphertext and nonsensitive local indexing fields reach disk.

- [ ] Write failing tests for raw-byte recovery, tamper rejection, byte-based eviction, age/disk limits, oversized omission markers and unavailable/full disk. Assert sensitive strings do not occur in database/journal files.
- [ ] Add tests for quota reduction during reads, bounded pending writes, crash recovery and clean cancellation. Simulate mixed payload sizes rather than assuming one rate.
- [ ] Run focused tests to confirm failures, then implement encrypted batches and paged storage. Validate SQLite integration with the chosen Electron runtime before selecting a binding.
- [ ] Define finite cache/in-flight/IPC/concurrency limits; ensure a slow writer stops admission and signals failure without growing RAM. Distinguish measured RSS from logical buffer budgets.
- [ ] Run unit/integration tests and measure steady-state RSS, queue lengths and disk growth at several synthetic rates, including saturation and maximum payloads. Record observed limits and any client-buffer allocation caveats. Commit task files.

## Task 5: Temporary binding subscriptions and reconnection

**Files:** `src/service/sessions.ts`, `src/service/providers/rabbitmq.ts`, `tests/integration/routing.test.ts`, `tests/integration/reconnect.test.ts`.

**Interfaces:** `startCapture(connectionId, resource, options): Promise<SessionSummary>`, `stopCapture(sessionId): Promise<void>`, `subscribeSessionEvents(listener): Unsubscribe`. Summaries contain state, supported coverage, binding snapshot and gap counters, never credentials. Reuse Task 4's committed append result before acknowledging owned deliveries.

- [ ] Write failing routing tests for direct/topic/fanout/headers, full binding arguments, overlapping patterns, unsupported/default exchanges and partial coverage. Assert original queue backlog, bindings and consumer count are unchanged.
- [ ] Add tests for partial setup cleanup, broker restart, changed bindings, cancellation during reconnect, terminal permission failures and disk-write failure before ack. Assert only owned resources are cleaned and lost periods are visible.
- [ ] Run focused integration tests and verify meaningful failures.
- [ ] Implement owned ephemeral queues, finite prefetch, binding snapshots, admission limits and retry classification with capped backoff/jitter. Rate-limited observations are counted as omitted; only owned copies may be acknowledged/discarded.
- [ ] Re-run routing/reconnect/load tests. Verify no path consumes from the original queue and no retry continues after cancellation. Commit task files.

## Task 6: Usable localized inspection UI and MVP verification

**Files:** `src/renderer/App.tsx`, `src/renderer/components/*`, `src/renderer/styles.css`, locale files, `tests/e2e/inspection.test.ts`, `tests/unit/payload.test.ts`, `.github/workflows/ci.yml`; update README and ROADMAP.

**Interfaces:** Renderer uses only profile/discovery/session/settings/page APIs from Tasks 2–5. `formatPreview(payload, contentType, settings): PreviewResult` returns bounded escaped text/structured data; it never executes payloads or eagerly parses above the preview limit.

- [ ] Use Taste's app-screen workflow to establish the visual system, then read Impeccable context/craft guidance before UI edits. Keep interface direction consistent across inspection and settings.
- [ ] Write failing tests for oversized/malformed/binary JSON previews, literal HTML display and pagination; assert no payload-driven navigation or script execution.
- [ ] Add interaction tests for save/test/connect/search/start/inspect/stop, global/session settings, invalid input, lower-quota effects, disabled/active rate limits and visible omission/gap/disk-error state.
- [ ] Run tests to confirm new assertions fail, then implement the interface, English/Italian copy and light/dark/system themes. Virtualize message lists and debounce/cancel stale searches.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm test:e2e`. Inspect rendered narrow/default/wide windows, both themes, keyboard paths, empty/error states and dense captures. Apply Impeccable review fixes as a batch.
- [ ] Add CI checks across intended OS runners where available. Update README with actual setup, permissions, settings, measured caveats and supported matrix; mark roadmap tasks complete only with evidence. Commit task files and present the reviewable MVP.

## Deliberately separate plans

RabbitMQ stream consumption, tray/background UX, message exports, password-protected configuration transfer, Kafka and release publication belong to later roadmap milestones. This plan does not mark them shipped or weaken their approved requirements.

## Execution handoff

Review this plan before application implementation. Choose native execution (the primary agent implements tasks sequentially, with independent review at the end) or task-by-task delegated implementation/review. Native execution is recommended here because the six tasks share contracts and one runnable vertical slice; it limits handoff overhead. Native execution was confirmed on 2026-10-22.
