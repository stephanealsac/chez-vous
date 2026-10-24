#!/usr/bin/env python3
"""Texture d'occlusion du fond du caisson : plus sombre contre la lèvre et sous le bord de la toile.
Une image par œuvre × taille (le ratio du jour dépend de la toile). Usage : gen_floor_ao.py <site_dir>
"""
import json, os, sys, math
from PIL import Image
import numpy as np

SITE = sys.argv[1]
cat = json.load(open(os.path.join(SITE, 'catalogue.json')))
F = cat['frame']
lip, add, gap = F['lip_cm'], F['add_cm'], F['add_cm'] - F['lip_cm']
out = os.path.join(SITE, 'ao'); os.makedirs(out, exist_ok=True)
N = 512
n = 0
for w in cat['works']:
    for s in w['sizes']:
        iw, ih = s['w'] + 2 * gap, s['h'] + 2 * gap          # rectangle intérieur (jour), en cm
        xs = (np.arange(N) + 0.5) / N * iw - iw / 2
        ys = (np.arange(N) + 0.5) / N * ih - ih / 2
        X, Y = np.meshgrid(xs, ys)
        d_wall = np.minimum(iw / 2 - np.abs(X), ih / 2 - np.abs(Y))                 # distance à la lèvre
        d_canvas = np.maximum(np.abs(X) - s['w'] / 2, np.abs(Y) - s['h'] / 2)      # distance au bord de la toile (>0 hors toile)
        d_canvas = np.clip(d_canvas, 0, None)
        # ombre de la lèvre (paroi de 3 cm de haut au-dessus du fond) et de la toile (2 cm)
        ao_wall = 1 - 0.55 * np.exp(-d_wall / 0.9)
        ao_canvas = 1 - 0.45 * np.exp(-d_canvas / 0.7)
        ao = np.clip(ao_wall * ao_canvas, 0.25, 1)
        img = Image.fromarray((ao * 255).astype(np.uint8), 'L')
        name = f"{w['slug']}-{s['slug']}.png"
        img.save(os.path.join(out, name), optimize=True)
        s['ao_img'] = f'ao/{name}'
        n += 1
json.dump(cat, open(os.path.join(SITE, 'catalogue.json'), 'w'), ensure_ascii=False, indent=1)
print(n, 'textures d\'occlusion')
