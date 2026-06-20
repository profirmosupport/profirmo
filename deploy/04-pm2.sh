#!/usr/bin/env bash
# Wire up pm2 to run the backend as a service with auto-restart on crash
# and auto-start on boot.

set -euo pipefail

DEST=/var/www/profirmo
APP_NAME=profirmo-api

cd "$DEST"

cat > "$DEST/ecosystem.config.js" <<'EOF'
// PM2 process file — keep next to the repo root so pm2 finds it.
module.exports = {
  apps: [
    {
      name: 'profirmo-api',
      cwd: '/var/www/profirmo/backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      out_file: '/var/log/profirmo/out.log',
      error_file: '/var/log/profirmo/err.log',
      time: true,
    },
  ],
};
EOF

echo "[pm2] log dir"
sudo mkdir -p /var/log/profirmo
sudo chown -R ubuntu:ubuntu /var/log/profirmo

echo "[pm2] start (or restart if already running)"
pm2 startOrRestart "$DEST/ecosystem.config.js"

echo "[pm2] save process list + enable systemd startup"
pm2 save
# Generates a `systemctl enable` line; execute the line it prints.
SYSTEMD_LINE=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1)
echo "[pm2] systemd line: $SYSTEMD_LINE"
eval sudo "$SYSTEMD_LINE" || echo "[pm2] systemd enable may need manual run — see output above"

echo "[pm2] status"
pm2 status

echo "[pm2] DONE"
