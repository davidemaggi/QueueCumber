# RabbitMQ inspection and permissions

QueueCumber supports ordinary AMQP credentials plus an accessible RabbitMQ management API. Both use the AMQP URL's user/password. Verified TLS and custom CA certificates are supported. Cloud-specific IAM, OAuth refresh and mutual TLS client keys are not implemented. Test your actual hosted endpoint rather than assuming the local broker matrix certifies it.

## A restricted account

Use a dedicated vhost/account. An administrator can scope configure/write to QueueCumber's owned observation names and read to those names plus the source exchanges, inspected queues and selected streams. RabbitMQ requires read on the source exchange and write on the destination queue when creating a binding. A management-tagged user can access management APIs within its vhost permissions; it does not need the administrator tag.

For example, if approved resources are named `orders.events` (source exchange), `orders.worker` (queue) and `orders.log` (stream), the permission expressions are:

| Permission | Example regex |
| --- | --- |
| Configure | `^queuecumber[.].*$` |
| Write | `^queuecumber[.].*$` |
| Read | `^(queuecumber[.].*|orders[.]events|orders[.]worker|orders[.]log)$` |
| User tag | `management` |

Apply these through the administrator's normal broker controls. Escape regex metacharacters in real resource names. Restrict which exchanges can be read; do not replace the read regex with `.*` without evaluating that access. A stream must already exist: this account cannot create it. The reserved `queuecumber.*` namespace must contain only QueueCumber-owned queues; don't place application resources there. Permissions do not distinguish one QueueCumber session's prefix from another, so use separate accounts/vhosts where that isolation matters.

The local integration fixture tests this model with generated application names, a management-tagged user, owned configure/write and exact application read permissions: capture succeeds while redeclaring the application queue and publishing to the source exchange are denied. The fixture publisher is an independent administrator used only to generate synthetic test traffic. An account with no management tag is separately verified to fail management access while AMQP login still works. These local checks do not replace an administrator's hosted-policy validation.

## What a capture means

Classic and quorum queues are never consumed directly. QueueCumber reads supported inbound bindings, declares an exclusive non-durable observation queue and copies direct/topic/fanout/headers routes. Owned deliveries are acknowledged after local admission/storage; the selected application's messages remain untouched. Setup and reconnect are not atomic, and gaps are visible.

The default exchange cannot be mirrored. Distribution/hash/plugin exchanges are unsupported until individually tested. Choosing partial coverage does not make omitted bindings safe to mirror. Queue-specific TTL, priority, dead-lettering and policies can make observation differ from application contents. Adding a binding changes topology and may affect mandatory returns/alternate exchanges; this is not a zero-side-effect tap.

Streams are checked as streams and read directly, using AMQP credit/acknowledgements without deleting the log. Begin/live/exact positions are independent of application consumers. Retention may remove an old offset; future offsets remain unverified until a record confirms them. No automatic capture resumes after an app restart.

## Evidence and limits

| Environment | Evidence |
| --- | --- |
| Local RabbitMQ 4.2 management Docker fixture | Discovery, restricted permissions, supported routing types, original queue non-consumption, partial setup cleanup, reconnect, retention/stream positions and resource measurements |
| Synthetic HTTPS management endpoint | Unknown CA rejected; supplied test CA accepted |
| Hosted RabbitMQ / provider control planes | Real accounts not tested; endpoint reachability, permission model and transport authentication require acceptance |
| AMQPS against a real TLS-enabled broker | Requires maintainer acceptance; the HTTPS CA fixture does not prove the AMQP TLS handshake |

See [validation](VALIDATION.md), [acceptance](ACCEPTANCE.md), and RabbitMQ's [access-control documentation](https://www.rabbitmq.com/docs/access-control).
