#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --legacy-peer-deps

echo "[post-merge] Pushing database schema..."
npm run db:push -- --force

echo "[post-merge] Done."
