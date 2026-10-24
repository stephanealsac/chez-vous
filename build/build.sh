#!/usr/bin/env bash
# Reconstruit tout le site à partir du site WooCommerce :
#   SITE_URL=https://chez-vous.stephane-alsac.com build/build.sh   (SITE_URL = adresse finale, pour l'image de partage)
#   1. catalogue.json + images (python)   2. modèles 3D usdz/glb (node)   3. service worker
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
python3 -I "$ROOT/build_catalogue.py" "$ROOT/data" "$ROOT/site"
python3 -I "$HERE/gen_labels.py" "$ROOT/site"
node "$HERE/gen_models.mjs" "$ROOT/site"
# Image de partage (Open Graph) : URL absolue requise par iMessage/WhatsApp/Facebook
if [ -n "${SITE_URL:-}" ]; then
  sed -i "s#content=\"[^\"]*og-image.jpg\"#content=\"${SITE_URL%/}/og-image.jpg\"#" "$ROOT/site/index.html"
fi
node "$HERE/gen_sw.mjs" "$ROOT/site"
echo "OK — dossier à déployer : $ROOT/site"
