# QueueCumber visual system

The inspection workspace follows Taste's data-terminal direction for long developer sessions, translated into both light and dark themes. Cucumber green is the single selection accent; surfaces remain neutral. This records the selected implementation direction, not a claim of completed visual review.

## Tokens

| Role | Light | Dark |
| --- | --- | --- |
| Ground | #f6f6f5 | #171717 |
| Surface | #ffffff | #111111 |
| Raised | #ededeb | #202020 |
| Ink | #202420 | #e9ece8 |
| Muted | #62675f | #a4aaa0 |
| Border | #dedfda | #30332e |
| Accent | #3c6b2e | #9cc87b |

Public Sans is bundled locally. Use 13px body, 12px metadata and 26px main titles; monospace is reserved for message data and identifiers. Controls use 6px corners, panels remain flat, selections use a 1px green underline, numeric columns use tabular digits. Focus rings must remain visible in both themes.

## Workspace

Connections and native broker resources form a labeled navigation pane; message list and detail share the remaining space. The signature is a binding snapshot strip connecting the selected application queue to its owned observation session, with start time and coverage. The first action is adding a real connection; empty states never invent traffic.

The workspace is Operate mode. Its question is: what is arriving on this route, and what does this message contain? Settings explain capture budgets and their effects. Keep failure and gap indicators beside their session, and retain context during refresh. Narrow windows stack list/detail rather than compress unreadable columns.
