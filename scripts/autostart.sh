#!/usr/bin/env bash
# Boot autostart: stop every running container that isn't part of this project,
# then bring up the tv-control dev stack. Installed as a systemd unit via `make autostart-install`.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."
PROJECT="$(basename "$PWD")"
COMPOSE=(docker compose -f docker-compose.dev.yml)

echo "Waiting for docker..."
for _ in $(seq 60); do
  docker info >/dev/null 2>&1 && break
  sleep 1
done
docker info >/dev/null

others=$(docker ps --format '{{.ID}} {{.Label "com.docker.compose.project"}}' \
  | awk -v p="$PROJECT" '$2 != p { print $1 }')
if [ -n "$others" ]; then
  echo "Stopping other containers: $(echo $others)"
  docker stop $others
fi

echo "Starting $PROJECT"
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps
