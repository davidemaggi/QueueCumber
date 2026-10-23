---
name: QueueCumber
description: A quiet workspace for inspecting message traffic.
colors:
  accent-light: "#3c6b2e"
  accent-dark: "#9cc87b"
  ground-light: "#f6f6f5"
  ground-dark: "#171717"
  surface-light: "#ffffff"
  surface-dark: "#111111"
  ink-light: "#202420"
  ink-dark: "#e9ece8"
  muted-light: "#62675f"
  muted-dark: "#a4aaa0"
  border-light: "#dedfda"
  border-dark: "#30332e"
typography:
  title:
    fontFamily: Public Sans, sans-serif
    fontSize: 26px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.025em
  body:
    fontFamily: Public Sans, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.65
rounded:
  control: 6px
spacing:
  small: 8px
  medium: 16px
  panel: 24px
components:
  button-primary:
    rounded: "{rounded.control}"
    padding: 6px 11px
    height: 32px
---

# QueueCumber visual system

## Overview

Taste's data-terminal direction supplies restrained selections, neutral surfaces and tabular figures for long developer sessions. Cucumber green identifies the product and active state. The implemented inspection workspace is the visual reference; there is no final logo yet.

## Colors

Use neutral ground, surface, raised, ink, muted and border roles in both themes. The accent belongs on selection underlines, the temporary mark, focus and active capture status. Primary actions use near-black in light mode and pale ink in dark mode; avoid filling the chrome with green.

## Typography

Bundle Public Sans locally. Use the title and body tokens above, 12px metadata and 11px compact message figures. Monospace is reserved for payloads, broker identifiers, routing patterns and timestamps. Align numbers to the right with tabular digits. Use sentence case and descriptive native broker terms.

## Layout

A 236px labeled sidebar holds connections and session history. A 260px resource pane leads into binding coverage, then the message list and detail. Below 1150px, the sidebar/resource lanes narrow and list/detail stack in their own scrolling workspace. The desktop window minimum is 860 × 600; this is not a mobile-web layout. Keep important actions above the fold and large payloads within their pane.

## Elevation & Depth

Surfaces are flat. Use a tone step or quiet border for separation, without decorative shadows or glass. Errors and limitations stay beside the affected workflow.

## Shapes

Controls use the small shared corner radius. Structural panels and table rows remain square and aligned. The temporary cucumber mark is geometric SVG, not a finished brand asset.

## Components

Buttons expose hover, disabled and focus states. Inputs have explicit labels and visible focus rings. Navigation and detail tabs use a thin accent underline. The message list virtualizes a bounded page and selects on a neutral raised surface. Header tables preserve typed property representations. JSON and text are escaped data, never HTML.

Theme text selection, caret and scrollbar colors from semantic roles. A short form/first-run arrival animation respects reduced motion. Retain empty, waiting, disconnected, partial-coverage and error states.

## Do's and Don'ts

- Keep broker data and counts factual; screenshots use synthetic test messages.
- Preserve context while refreshing, and explain capture gaps and omitted routes.
- Keep operation screens readable before adding decoration.
- Do not fabricate traffic, release claims or charts.
- Do not use gradients, glows or decorative dashboard metrics.
