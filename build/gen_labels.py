#!/usr/bin/env python3
"""Étiquettes de format affichées sous le cadre en réalité augmentée (une image par œuvre × taille).
Usage : python3 -I gen_labels.py <site_dir>
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

SITE = sys.argv[1]
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts') + '/'
W, H = 2200, 200
cat = json.load(open(os.path.join(SITE, 'catalogue.json')))
out = os.path.join(SITE, 'labels'); os.makedirs(out, exist_ok=True)
f1 = ImageFont.truetype(F + 'CormorantGaramond-Italic.ttf', 110); f1.set_variation_by_axes([300])
f2 = ImageFont.truetype(F + 'Raleway.ttf', 44); f2.set_variation_by_axes([400])

def spaced(d, x_right, y, text, font, fill, spacing=6):
    x = x_right
    for ch in reversed(text):
        w = d.textlength(ch, font=font); x -= w; d.text((x, y), ch, font=font, fill=fill, anchor='lm'); x -= spacing

n = 0
for w in cat['works']:
    multi = len(w['sizes']) > 1
    for s in w['sizes']:
        im = Image.new('RGB', (W, H), '#eeeae1'); d = ImageDraw.Draw(im)
        d.text((60, H / 2), s['label'], font=f1, fill='#1a1a1a', anchor='lm')
        right = f"{s['w']} × {s['h']} cm" + ("   ·   Touchez le tableau pour changer de format" if multi else '')
        spaced(d, W - 60, H / 2, right.upper(), f2, '#4a4a4a')
        d.line([(0, 0), (W, 0)], fill='#d4cfc4', width=3)
        name = f"{w['slug']}-{s['slug']}.jpg"
        im.save(os.path.join(out, name), quality=86)
        s['label_img'] = f'labels/{name}'
        n += 1
json.dump(cat, open(os.path.join(SITE, 'catalogue.json'), 'w'), ensure_ascii=False, indent=1)
print(n, 'étiquettes')
