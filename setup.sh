#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[DevMate AI] Bootstrapping project..."

if [[ ! -f "$ROOT_DIR/.env" ]]; then
	cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
	echo "Created .env from .env.example"
fi

echo "Installing backend dependencies..."
cd "$ROOT_DIR/backend"
npm install

echo "Generating Prisma client and running migrations..."
npx prisma generate
npx prisma migrate deploy || true

echo "Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
npm install

echo "Setup complete."
echo "Run services with: docker compose up --build"

chmod +x setup.sh
./setup.sh