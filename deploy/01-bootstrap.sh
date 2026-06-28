#!/usr/bin/env bash
# Run as ubuntu user on a fresh Ubuntu 22.04 / 24.04 EC2 host.
#   bash 01-bootstrap.sh
#
# Idempotent — re-running is safe. Installs runtime + tools that the
# Profirmo backend needs.

set -euo pipefail

echo "[bootstrap] apt update + upgrade"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "[bootstrap] base tools"
sudo apt-get install -y \
  curl wget git ca-certificates gnupg lsb-release \
  build-essential ufw \
  mysql-client \
  nginx \
  unzip jq

echo "[bootstrap] Node.js 20 (NodeSource)"
if ! command -v node >/dev/null || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "[bootstrap] pm2 (process manager)"
sudo npm install -g pm2

echo "[bootstrap] certbot + nginx plugin (snap is the official path on Ubuntu 22+)"
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

echo "[bootstrap] ufw (firewall) — allow ssh / http / https"
sudo ufw allow OpenSSH || true
sudo ufw allow 'Nginx Full' || true
yes | sudo ufw enable || true
sudo ufw status

echo "[bootstrap] enable + start nginx"
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx --no-pager | head -10

echo "[bootstrap] DONE"
