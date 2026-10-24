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
# ombre portée sur le mur : légèrement en dessous et sur la droite du cadre (lumière haut-gauche), rien au-dessus ni à gauche
MARGIN, OFFX, OFFY, SOFT, AMAX = 7.0, 1.0, -1.8, 2.0, 0.38   # cm, décalage x, décalage y, douceur, opacité max
for w in cat['works']:
    for s in w['sizes']:
        ow, oh = s['w'] + 2 * add, s['h'] + 2 * add          # dimensions hors-tout du cadre
        # zone de la texture : tout autour du cadre (le plan est invisible là où l'opacité est nulle)
        x0, x1 = -ow / 2 - MARGIN, ow / 2 + MARGIN
        y0, y1 = -oh / 2 - MARGIN, oh / 2 + MARGIN
        W, H = x1 - x0, y1 - y0
        xs = x0 + (np.arange(N) + 0.5) / N * W
        ys = y1 - (np.arange(N) + 0.5) / N * H
        X, Y = np.meshgrid(xs, ys)
        dx = np.maximum(np.abs(X - OFFX) - ow / 2, 0); dy = np.maximum(np.abs(Y - OFFY) - oh / 2, 0)
        d = np.sqrt(dx**2 + dy**2)                          # distance au rectangle d'ombre (cadre décalé)
        a = AMAX * np.exp(-(d / SOFT) ** 1.3)
        # rien au-dessus de la ligne du haut ni à gauche de la ligne de gauche du cadre, avec un fondu doux vers ces
        # lignes ; opacité pleine au contact du cadre (pas de liseré clair)
        m = np.clip((oh / 2 - Y) / 1.6, 0, 1) * np.clip((X + ow / 2) / 1.6, 0, 1)
        a = a * m
        # fondu vers zéro sur le bord de la texture (jamais de bord visible)
        edge = np.minimum(np.minimum(np.minimum(x1 - X, X - x0), np.minimum(Y - y0, y1 - Y)) / 2.5, 1)
        a = np.clip(a * np.clip(edge, 0, 1), 0, 1)
        rgba = np.zeros((N, N, 4), np.uint8); rgba[..., 3] = (a * 255).round().astype(np.uint8)
        name = f"shadow-{w['slug']}-{s['slug']}.png"
        Image.fromarray(rgba, 'RGBA').save(os.path.join(out, name), optimize=True)
        s['shadow_img'] = f'ao/{name}'
        s['shadow_cm'] = {'x0': round(x0, 2), 'x1': round(x1, 2), 'y0': round(y0, 2), 'y1': round(y1, 2)}
json.dump(cat, open(os.path.join(SITE, 'catalogue.json'), 'w'), ensure_ascii=False, indent=1)
print(n, 'textures d\'occlusion +', n, 'ombres')
