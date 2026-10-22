#!/usr/bin/env bash
# Disposable test-only broker. All credentials and certificates are synthetic.
set -euo pipefail
/etc/kafka/docker/run &
broker_pid=$!
trap 'kill -TERM "$broker_pid" 2>/dev/null || true' EXIT TERM INT
for attempt in {1..90}; do
  if /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --alter \
    --add-config 'SCRAM-SHA-256=[password=local-test-only]' --entity-type users --entity-name cucumber >/tmp/qc-auth-setup.log 2>&1; then
    /opt/kafka/bin/kafka-configs.sh --bootstrap-server localhost:9092 --alter \
      --add-config 'SCRAM-SHA-512=[password=local-test-only]' --entity-type users --entity-name cucumber >>/tmp/qc-auth-setup.log 2>&1
    touch /tmp/qc-ready
    wait "$broker_pid"
    exit $?
  fi
  kill -0 "$broker_pid" || { cat /tmp/qc-auth-setup.log; exit 1; }
  sleep 1
done
cat /tmp/qc-auth-setup.log
exit 1
