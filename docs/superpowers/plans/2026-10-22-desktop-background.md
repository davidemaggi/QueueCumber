# Desktop Background Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Keep approved capture sessions running after an explicitly opted-in window close, with visible tray status and reliable Quit.

**Architecture:** Main owns a focused desktop lifecycle controller, native tray and versioned nonsensitive preferences. The existing utility continues capture while the renderer is hidden. A bounded independent status poll updates tray menus without relying on renderer timers.

**Tech Stack:** Existing Electron, React, TypeScript, Zod, Vitest and native Electron Playwright.

**Spec:** `docs/PROJECT_PLAN.md#interface-and-desktop-lifecycle`; continuation authorized by the maintainer on 2026-10-22.

## Global Constraints

- Stay on development. No push, release, tag or remote workflow execution.
- Preserve original broker resources and encrypted bounded storage.
- Background close is off by default and explicitly configurable. Quit always shuts down captures and cleans temporary storage.
- Localize desktop/menu/settings strings in English and Italian. Preserve the existing Taste design; review rendered changes with Impeccable.
- Platform limitations must be visible. On Linux, keep a minimized accessible window when close-in-background is enabled, even if no desktop tray host exists.

## Review Focus

- Explicit Quit while close-to-tray is enabled must terminate rather than hide again.
- A failed or absent tray must leave an accessible window route.
- Renderer throttling/hidden windows must not stop capture or tray updates.
- Utility failure must replace stale active tray status with an error.
- Repeated status refreshes/menu actions must stay bounded and preserve session ownership.

## Task 1: Preferences and lifecycle

Files: create `src/shared/desktop.ts`, `src/main/preferences.ts`, `src/main/desktop.ts`, native icon asset; modify main, bridge and contracts; unit tests for versioned preference persistence and event/menu behavior.

- [x] Write failing unit tests for validated preference persistence, opt-in close, Quit ordering, fallback accessibility and bounded tray menu/status behavior.
- [x] Run RED, then implement the smallest main-process controller with native dependencies and explicit shutdown.
- [x] Extend validated IPC for desktop preference reads/writes; use non-overlapping tray polling and no extra broker connections.
- [x] Run unit tests, typecheck and lint; record outcomes.

## Task 2: Settings and native verification

Files: settings/app/locales, Electron tests, README/ROADMAP/validation notes.

- [x] Add a localized background setting and explicit current close behavior. Persist language for native menus without exposing profiles.
- [x] Add native tests for opt-in close/hide or minimize, reopen, actual RabbitMQ capture while hidden, tray status and explicit Quit cleanup.
- [x] Verify utility failure updates tray state, invalid preferences recover safely and default close still exits.
- [x] Inspect settings in both themes and supported desktop sizes; run build, unit, integration/Electron checks as relevant.
- [x] Obtain one independent final review, fix Important/Critical findings, update evidence and commit on development.

Configuration transfer, stream positioning, dumps and Kafka remain the next independent slices; a tray implementation does not mark 0.2 or 1.0 complete.
