#!/usr/bin/env bash
# Reconstruit tout le site à partir du site WooCommerce :
#   1. catalogue.json + images (python)   2. modèles 3D usdz/glb (node)   3. service worker
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
python3 -I "$ROOT/build_catalogue.py" "$ROOT/data" "$ROOT/site"
node "$HERE/gen_models.mjs" "$ROOT/site"
node "$HERE/gen_sw.mjs" "$ROOT/site"
echo "OK — dossier à déployer : $ROOT/site"
