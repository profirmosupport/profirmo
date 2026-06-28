#!/usr/bin/env bash
# Deploy the Profirmo backend code to /var/www/profirmo.
#   bash 02-app.sh
#
# Reads env values from /etc/profirmo/backend.env (place that file BEFORE
# running this script — see 03-env-template.env).

set -euo pipefail

REPO=https://github.com/profirmosupport/profirmo.git
DEST=/var/www/profirmo
ENV_SRC=/etc/profirmo/backend.env
ENV_DST="$DEST/backend/.env"

if [ ! -f "$ENV_SRC" ]; then
  echo "[app] FATAL: $ENV_SRC not found. Copy 03-env-template.env there first."
  exit 1
fi

echo "[app] ensure parent dir"
sudo mkdir -p "$(dirname "$DEST")"
sudo chown -R ubuntu:ubuntu "$(dirname "$DEST")"

if [ ! -d "$DEST/.git" ]; then
  echo "[app] cloning $REPO -> $DEST"
  git clone --depth 1 "$REPO" "$DEST"
else
  echo "[app] repo present — pulling latest"
  cd "$DEST"
  git fetch origin
  git reset --hard origin/main
fi

cd "$DEST/backend"

echo "[app] backend npm install (production deps)"
npm ci --omit=dev

echo "[app] place env file"
sudo install -m 600 -o ubuntu -g ubuntu "$ENV_SRC" "$ENV_DST"

echo "[app] verify env has DB_HOST set"
grep -E "^DB_HOST=" "$ENV_DST" >/dev/null || { echo "[app] DB_HOST missing"; exit 1; }

echo "[app] DONE"
