# Complete 0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete the remaining 0.2.0 features continuously: protected connection transfer, streamed captures, RabbitMQ stream positioning, retention/recovery and cancellation.

**Architecture:** Main owns native file dialogs, bounded encrypted connection-transfer staging and atomic vault imports. Utility owns export jobs, finite capture snapshots and provider sessions; exports read one retained record at a time and never pin retention. Existing tray remains active. RabbitMQ streams use AMQP non-destructive stream subscriptions with local offsets, not application consumer groups.

**Tech Stack:** Existing TypeScript/Electron/React/Node crypto/SQLite, amqplib, a streamed ZIP64 writer, Vitest and native Electron Playwright.

**Spec:** `docs/PROJECT_PLAN.md` secure transfer, dumps and RabbitMQ capture contract; `ROADMAP.md` 0.2.0. Maintainer explicitly requests completion of the entire milestone without pauses between blocks.

## Global Constraints

- Work on development; no push, tag, workflow dispatch or release publication.
- All distribution artifacts are built in GitHub Actions. Local builds are verification/development only.
- Never consume/ack application classic/quorum queues. Stream acknowledgements are non-destructive credit only.
- English/Italian, light/dark, strict IPC validation, no broker/filesystem credentials in the renderer.
- Encrypt whole connection exports with password+scrypt+AES-GCM. Fixed versioned KDF cost, finite file/profile/password limits, no stored export password.
- Transfer connection configuration; capture limits, UI preferences and OS keys remain machine-local. Show this explicitly.
- Export retained captures, not original queue backlog. Plaintext warning is explicit. Generate filenames; preserve destinations on failure/cancel.
- No unbounded snapshot pinning or message arrays. One export and one transfer operation at a time. ZIP entry metadata is capped; use folder/JSONL for larger captures.
- Windows/Linux desktop and real cloud/key-store validation stay pending unless actually executed. Do not infer them from macOS.

## Review Focus

- Tampered/huge imports, unsupported versions and wrong passwords fail without mutation or secret-bearing errors.
- Conflicts and concurrent profile changes do not lose unrelated data; an import is one atomic vault write.
- Retention, cancellation, disk-full and Quit remove partial exports and preserve existing destinations.
- Stream first/next/offset, reconnect offsets, deleted streams and retention clamps remain visible and non-destructive.
- Long captures/exports remain finite in RAM, pending work and IPC; typed headers and original bytes survive exports.

## Task 1 — Encrypted connection transfer

- [x] Write failing crypto/container and atomic-conflict import regressions.
- [x] Implement versioned bounded transfer codec, serialized vault batch imports and native main-process dialog/staging service.
- [x] Add narrow typed IPC, localized settings controls, conflict preview and password clearing.
- [x] Verify wrong-password/tamper/size/version rejection, concurrency and UI flows; integrate in the final milestone commit.

## Task 2 — Retained capture exports and retention

- [x] Write failing tests for JSONL/folder/ZIP round trips, safe names, typed headers, cancellation/failure cleanup and retention during export.
- [x] Implement one utility export job with fixed upper-record snapshot, progress/cancel, no pinning and bounded ZIP entries.
- [x] Add main-process dialogs/IPC and localized resource/session export controls; add explicit delete-retained-history control.
- [x] Verify file destinations, disk-full/read failures, recovery and bounded working set; integrate in the final milestone commit.

## Task 3 — RabbitMQ streams

- [x] Write real-broker first/live/offset and reconnect regressions proving data remains readable by another consumer.
- [x] Validate actual resource type through management before choosing a stream consumer; fail closed if it is not a stream.
- [x] Implement explicit start positions, local resume offset, gap/clamp reporting and stored/exported offset provenance.
- [x] Add localized stream controls and native UI verification; integrate in the final milestone commit.

## Task 4 — Milestone verification

- [x] Run unit/integration/native desktop/build/lint/type/format checks and inspect light/dark/narrow screens.
- [x] Obtain one independent whole-change review and fix Important/Critical findings with regressions.
- [x] Document versioned config/dump formats and limitations; update README/ROADMAP/validation.
- [x] Set development version 0.2.0 (no release/tag claim), commit final work, retain documented external release gates.

## Implemented decisions and remaining release gates

- Connection transfer covers profiles. Resource limits, desktop appearance and OS keys stay machine-local; they must be configured separately on a new computer.
- Export snapshots never pin retention. A dump can omit records that expire during its run and reports their count. ZIP stops at 10,000 messages to bound archive metadata; larger captures use JSONL or folders.
- Numeric stream positions use a bounded retained-prefix probe. Future positions can wait on RabbitMQ 4.2 and stay unverified until delivery; this avoids claiming exactness the broker has not confirmed.
- Recovery journals persist only with OS-protected storage. Forced termination in session-only mode can leave plaintext partial exports for manual deletion; normal cancel/Quit cleans them.
- The maintainer requested the complete milestone without intermediate handoffs. Shared wiring and the final review are integrated in one development commit, giving coarser commit granularity than per-task commits.
- Real Windows/Linux desktops, cloud authentication, OS keystores and release signing remain unverified external gates. Source checks do not certify those environments. Distribution builds remain in GitHub Actions; no push, tag or publication was performed.

Final verification: 50 unit, 21 integration and six native Electron tests; type checking, lint, formatting, production build and actionlint pass locally. One independent review found an incoming-name preview discrepancy; its regression was observed failing, then passing after the fix. Full checks passed after the correction. See `docs/VALIDATION.md` for resource measurements and deferred narrow-pane layout work.
