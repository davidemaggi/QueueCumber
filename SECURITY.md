# Security

QueueCumber connects directly to brokers and handles private messages locally. It is an inspector, not a sandbox for arbitrary plugins or a security boundary against a compromised operating-system account.

## Reporting a problem

Please report suspected credential exposure, malicious-message execution, unsafe imports or unintended broker mutation privately to **me@davidemaggi.dev**. Include the app version, OS, a sanitized reproduction and expected behavior. Do not include real credentials, captures or customer messages. If GitHub private vulnerability reporting is enabled, it is also suitable; do not open a public issue containing exploit details or secrets. No response-time guarantee is implied.

Security fixes target the latest 1.x release. There is no backport commitment for unpublished 0.x milestones. Until a release is actually published and the acceptance checklist passes, 1.0 metadata identifies prepared source, not a security certification.

## Boundaries

- The sandboxed, isolated renderer has no Node, broker sockets or generic filesystem/shell bridge. Browser permission checks/requests and device permissions are denied. New windows, navigation and attached webviews are blocked. CSP limits loaded content; messages are rendered as data.
- Main validates sender window/main frame, operation names, arguments and concurrent IPC count. Dialogs choose paths in privileged code. Profiles returned to the UI contain only ID, name and provider; credential editing requires re-entry. Broker errors exposed to the renderer use bounded codes or generic messages.
- Complete private profiles and sensitive capture metadata/payloads use AES-256-GCM. The random vault key uses Electron's OS-backed safeStorage; Linux basic_text/unknown backends cannot enable persistence. If OS protection is unavailable, session-only mode uses a temporary encrypted capture directory and an in-memory key. A locked/corrupt existing vault fails closed rather than overwriting data.
- OS storage is not isolation from same-user malware or a compromised account. Process memory, swap, crash dumps and OS backups can contain sensitive data. Logical deletion does not guarantee forensic erasure. Local paths, IDs, timestamps and sizes can remain in SQLite indexes; resource names, headers and payloads are encrypted.
- Configuration transfer uses a fixed bounded scrypt KDF and authenticated versioned AES-GCM envelope; import is bounded, previewed and atomic. Passwords are not retained. Connection endpoints are user-selected: only import files you intend to use; imports never connect automatically.
- Message dumps are plaintext. Safe generated filenames, bounded record streaming, cancellation and encrypted recovery journals protect normal operations, not confidentiality of the destination. Forced termination in session-only mode may leave partial plaintext dumps beside that destination.
- RabbitMQ creates only its own observation queues/bindings, never consumes application queues; stream acknowledgements supply credit without deleting log records. Kafka uses direct partition reads without group joins/commits. Observation can add broker load and alter routing side effects; use dedicated least-privilege credentials.
- RAM/disk quotas bound application caches and retention, not all broker-client allocations or total RSS. Protocol libraries can allocate oversized records or metadata before admission. Capture may omit/evict messages under load, and disk errors stop it.

See [formats and recovery](docs/DATA_FORMATS.md), [validation evidence](docs/VALIDATION.md) and [acceptance checks](docs/ACCEPTANCE.md). Dependency locks, CI and local review reduce risk; no independent security certification or exhaustive penetration test is claimed.
