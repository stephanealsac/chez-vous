#!/usr/bin/env python3
"""Normal map de toile de lin, tuilable, très fine (tuile = 1 cm, 18 fils/cm). Usage : gen_weave.py <site_dir>"""
import sys, os, numpy as np
from PIL import Image
def weave(N, threads, amp, seed, out, color_out=None, base=0.075, contrast=0.55):
    x = (np.arange(N) + 0.5) / N; X, Y = np.meshgrid(x, x)
    # tissage toile : fils de chaîne et de trame alternés (hauteur = somme de deux sinusoïdes croisées en damier)
    # cellules d'un fil de côté ; dans une cellule sur deux (damier) c'est le fil vertical qui passe dessus
    warp = np.abs(np.cos(np.pi * threads * X))   # bombé du fil vertical (varie selon x)
    weft = np.abs(np.cos(np.pi * threads * Y))   # bombé du fil horizontal (varie selon y)
    checker = np.sign(np.sin(np.pi * threads * X) * np.sin(np.pi * threads * Y))
    h = np.where(checker > 0, warp + 0.15 * weft, weft + 0.15 * warp)
    rng = np.random.default_rng(seed); h += 0.08 * rng.standard_normal((N, N))   # irrégularité des fibres
    # normales par gradient (tuilable : gradient circulaire)
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * amp * threads / 4
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * amp * threads / 4
    nx, ny, nz = -dx, dy, np.ones_like(h)        # +Y vers le haut de l'image (convention glTF/USD, OpenGL)
    l = np.sqrt(nx**2 + ny**2 + nz**2); nx, ny, nz = nx / l, ny / l, nz / l
    rgb = np.stack([(nx + 1) / 2, (ny + 1) / 2, (nz + 1) / 2], -1)
    Image.fromarray((rgb * 255).round().astype(np.uint8)).save(os.path.join(sys.argv[1], out), optimize=True)
    print(out, N, 'px,', threads, 'fils/cm, amplitude', amp)
    if color_out:
        # couleur du tissu : gris très sombre, les fils qui passent dessus sont un peu plus clairs (sRGB 8 bits)
        hn = (h - h.min()) / (h.max() - h.min())
        v = base * (1 - contrast / 2 + contrast * hn)            # valeur linéaire approx.
        srgb = np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(v, 1 / 2.4) - 0.055)
        Image.fromarray((np.clip(srgb, 0, 1) * 255).round().astype(np.uint8), 'L').convert('RGB').save(os.path.join(sys.argv[1], color_out), optimize=True)
        print(color_out, 'sRGB', int(srgb.min() * 255), '-', int(srgb.max() * 255))

weave(256, 24, 0.45, 11, 'tape_normal.png', 'tape_color.png', base=0.022, contrast=0.7)   # galon des chants du châssis (relief + nuances)
