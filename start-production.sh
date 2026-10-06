#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production

echo "[1/3] Checking migrations..."
node scripts/migrate.js

echo "[2/3] Starting application..."
exec node server.js
