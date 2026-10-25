#!/usr/bin/env bash
# Copie le catalogue du site dans l'appli (hors-ligne) : catalogue.json, images, modèles USDZ, vidéo tutoriel.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SITE="$HERE/../site"; OUT="$HERE/ChezVous/Catalogue"
rm -rf "$OUT"; mkdir -p "$OUT/img" "$OUT/models"
cp "$SITE/catalogue.json" "$OUT/"
cp "$SITE"/img/*.jpg "$OUT/img/"
cp "$SITE"/models/*.usdz "$OUT/models/"
cp "$SITE/tuto.mp4" "$SITE/tuto-poster.jpg" "$OUT/"
echo "Catalogue embarqué : $(ls "$OUT/models" | wc -l) modèles, $(du -sh "$OUT" | cut -f1)"
