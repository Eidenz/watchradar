#!/bin/sh
# Runs as root only long enough to make the /data bind mount writable by the app user,
# then drops to `node`. Docker creates a missing host directory as root, which is why
# the chown baked into the image is not enough.
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R node:node "${DATA_DIR:-/data}"
  exec su-exec node "$@"
fi
exec "$@"
