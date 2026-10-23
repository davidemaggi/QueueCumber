# 1.0.1 inspection feedback

The maintainer requested this scope before runner/signing execution. Continue locally; the runner-start checkpoint still applies.

- Reuse an existing capture for the same connection/resource, retaining messages and positions; active starts are idempotent. Restart stopped captures and report the observation gap.
- Add complete-name tooltips and an accessible, persistent resource-pane resize handle.
- Guided RabbitMQ setup takes host/port, infers TLS on standard ports and exposes TLS for custom ports. Advanced URLs remain available. Load existing profiles only for explicit editing through validated IPC; keep secrets out of summaries/logs/localStorage.
- Filter resource kind and known message counts. Discover distinct routing keys from queue bindings, with their exchange/queue context. Select individual bindings and add manual direct/topic exchange routes to owned observation queues only. Preserve selections over reconnect/restart.
- Page captures oldest/newest first in SQLite without loading all records into memory.
- Test endpoint parsing, edit preservation, session reuse/routes, discovery and bidirectional paging; inspect the existing UI in both themes and supported widths. Update product/roadmap/readme and validation notes.

Implementation builds on the existing React/Electron/provider architecture and visual system. No new dependencies or remote release execution are needed.

The maintainer confirmed runner/configuration readiness and authorized testing the real signing flow after the local feedback fixes. PR/merge and remote release verification are now authorized; publication still follows acceptance.

Final review found three restart corrections: check every matching active legacy history, compare migrated Kafka selections against saved starts, and validate limits before changing a stopped capture. All three regression tests failed before correction and passed afterward.
