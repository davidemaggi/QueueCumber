# QueueCumber 1.0.1

A few less prickly inspection workflows, plus optional Windows signing.

- Start and Stop reuse the same capture history. Unchanged stream/Kafka selections continue from saved positions; explicitly changed starting options reposition that history.
- RabbitMQ guided setup takes host and port, with TLS controls and separate credentials. Editing loads the saved values instead of starting with an empty form.
- Resource names have full-name tooltips. Resize the resource pane with its divider or keyboard, and filter by resource type and known message count.
- Browse distinct routing keys with exchange/destination context. Select individual queue bindings or add direct/topic routes to the temporary observation queue.
- Page retained messages newest or oldest first without loading the whole capture into memory.
- Unsigned downloads remain independent of signing availability. Optional Windows signed installer/ZIP assets use the self-hosted certificate store and separate checksums, after signature and timestamp verification.

Queue captures still see future routed traffic, not application backlog. The implicit default-exchange route cannot be mirrored. Manual direct/topic routes do not change application queues or bindings. Message dumps remain plaintext; configuration transfers remain encrypted.

Patch releases have no character name. Real signing and installation results must be recorded before publication; this file is prepared release copy, not a signing-success claim.
