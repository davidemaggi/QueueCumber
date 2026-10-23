# Kafka inspection

QueueCumber 0.3.0 adds Kafka alongside RabbitMQ. The same retained-message viewer, encrypted storage, resource budgets, exports and background lifecycle apply. Kafka does not need a RabbitMQ-style management URL.

## Connect

Choose Kafka when creating a connection. Supply one or more bootstrap `host:port` addresses. Hosts returned in broker metadata must also be reachable from your computer. Enable TLS for remote brokers; certificate and hostname checks stay enabled. A custom PEM CA can be supplied. Plain transport requires explicit consent, including when SASL is used.

Supported credential modes are no SASL, SASL PLAIN, SCRAM-SHA-256 and SCRAM-SHA-512. Credentials, broker addresses and custom CAs stay in the privileged processes after saving and are encrypted with the existing vault. The edit form requires re-entering full settings rather than sending stored secrets to the renderer. OAuth/OIDC token refresh, AWS IAM signing, Kerberos and mutual TLS client keys are not implemented.

The account needs topic metadata/Describe and Read permissions for selected topics. No consumer-group permission is needed: the application makes direct metadata, ListOffsets and Fetch requests, never JoinGroup, OffsetCommit or ConsumerGroupHeartbeat requests. Do not grant Create, Write, Delete, Alter or consumer-group privileges for inspection. Provider-specific ACL policies still require validation with the administrator.

## Select partitions and positions

Search for a topic, then choose up to 128 explicit partitions. The table pages eight partitions at a time. Beginning, live end and a decimal offset can be set independently for each selected partition; the bulk control applies beginning/live to the current selection. Topics with more than 128 partitions require a subset. Discovery refuses more than 10,000 topics or partitions rather than creating an unbounded UI. Metadata itself is parsed by the client before these collection limits are enforced.

Offsets are signed 64-bit non-negative integers represented as **decimal strings**, from `0` through `9223372036854775807`. They are never rounded through JavaScript numbers. The end offset is exclusive. An offset before retention is clamped to the first retained position; a requested position beyond the current end is clamped to that end with a visible notice. A live-end snapshot is taken during setup; it is not an atomic snapshot across partitions.

The next local position advances only after storage/admission processes a record, including intentional budget/rate omissions. Compacted holes and control entries can make offsets discontinuous; advancing to a processed batch boundary does not imply a lost message for every skipped number. A tombstone is a null Kafka value, distinct from an empty byte array. Local capture timestamps and Kafka record timestamps are separate. Kafka timestamps follow the topic setting: producer time for `CreateTime`, broker append time for `LogAppendTime`.

Reads deliberately use **READ_UNCOMMITTED** so an inspector can see transactional data, including records later aborted by their producer. Transactional records carry that flag; this is not a read-committed business view. Control batches are skipped. Ordering is preserved within each partition; interleaving across partitions follows the bounded polling loop and is not a global broker order. No offsets are committed to any broker consumer group.

## Reconnect, retention and topology

Transient network/leader failures use capped exponential backoff and jitter. Local next positions survive reconnects within the running capture. Authentication/authorization, unsupported configuration, missing topics, storage failures, topic UUID changes or a shrinking log end stop the capture. A changed topic UUID or truncated log requires a new capture instead of silently mixing two histories.

The loop refreshes metadata and retained ranges between fetch cycles. Newly added partitions are announced; an existing capture keeps its original selected set. Start a new capture after refreshing the resource to include them. Retention can still race a fetch; the next retry/range check revalidates the position and marks a gap. Gaps count interruptions/clamps, not an exact number of lost records.

Stop and Quit abort retries, close all sockets and wait for the loop. Cancellation during initial connection stays stopped. After an app restart, encrypted retained sessions reopen stopped and require explicit new captures, matching RabbitMQ history behavior. This version does not automatically resume consumers after process/OS termination.

## Working set and record fidelity

Fetches run sequentially, targeting one selected partition at a time, with 1 MiB requested response/partition budgets, 100 ms maximum broker wait and one in-flight request per client. The loop yields between admitted records. An idle selected partition can add up to 100 ms to a cycle; this trades throughput for a small, cancellable working set. Existing finite storage/cache/retention/rate budgets still apply to all providers together.

Kafka may return an oversized first record batch beyond its requested fetch size. The client also allocates/decompresses the response before local admission. These request settings and the cache budget are not total-RSS ceilings. Large/oversized payloads and metadata become visible omission records under the existing limits; disk failure stops consumption rather than accumulating an in-memory backlog. See [validation](VALIDATION.md) for the measured synthetic workload.

Records retain original value bytes, binary/null keys and ordered repeated headers. Dump message metadata adds a `kafka` object with topic, partition, decimal offset/timestamp, tombstone and transactional flags. `headers.key` stores the binary/null key; `headers.kafkaHeaders` is an ordered array of `{key,value}` byte/null pairs. JSONL and folder/ZIP metadata use the existing typed-header encoding, preserving repeated header names and arbitrary bytes. See [data formats](DATA_FORMATS.md).

## Tested broker/authentication matrix

| Environment | Authentication/transport | Evidence |
| --- | --- | --- |
| Local Apache Kafka 4.2.0, official Docker image, KRaft | Plain transport, explicit consent | Discovery, partition reads, reconnect, retention, topology, compressed/binary data, exports, load and native Electron workflow |
| Same broker | Verified TLS with synthetic custom CA | Metadata and record fetch; missing CA rejected |
| Same broker | SASL PLAIN over verified TLS | Metadata and record fetch; wrong password rejected |
| Same broker | SCRAM-SHA-256 over verified TLS | Metadata and record fetch; wrong password rejected |
| Same broker | SCRAM-SHA-512 over verified TLS | Metadata and record fetch; wrong password rejected |
| Confluent Cloud, Aiven, Redpanda Cloud | Hosted endpoints | Not tested with real accounts; no compatibility claim |
| AWS MSK, Azure Event Hubs Kafka endpoint | Hosted endpoints / provider-specific authentication | Not tested; IAM/OAuth/mutual-TLS mechanisms are not implemented |
| Other Kafka versions, multi-broker deployments | Protocol/leader compatibility | Not yet certified; local tests use one broker |

The public client is pinned to `@platformatic/kafka` 2.14.0. Its [direct consumer fetch API](https://github.com/platformatic/kafka/blob/main/docs/consumer.md#advanced-methods) is used without stream/group consumption. The [Apache consumer model](https://kafka.apache.org/42/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html) explains manual partition assignment versus group subscriptions. No runtime plugin code or cloud-account provisioning is included.
