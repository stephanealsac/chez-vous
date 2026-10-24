#!/usr/bin/env python3
"""Normal map de toile de lin, tuilable, très fine (tuile = 1 cm, 18 fils/cm). Usage : gen_weave.py <site_dir>"""
import sys, os, numpy as np
from PIL import Image
N = 256; threads = 18; amp = 0.10   # amplitude faible : relief discret
x = (np.arange(N) + 0.5) / N; X, Y = np.meshgrid(x, x)
# tissage toile : fils de chaîne et de trame alternés (hauteur = somme de deux sinusoïdes croisées en damier)
# cellules d'un fil de côté ; dans une cellule sur deux (damier) c'est le fil vertical qui passe dessus
warp = np.abs(np.cos(np.pi * threads * X))   # bombé du fil vertical (varie selon x)
weft = np.abs(np.cos(np.pi * threads * Y))   # bombé du fil horizontal (varie selon y)
checker = np.sign(np.sin(np.pi * threads * X) * np.sin(np.pi * threads * Y))
h = np.where(checker > 0, warp + 0.15 * weft, weft + 0.15 * warp)
rng = np.random.default_rng(7); h += 0.08 * rng.standard_normal((N, N))   # irrégularité des fibres
# normales par gradient (tuilable : gradient circulaire)
dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * amp * threads / 4
dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * amp * threads / 4
nx, ny, nz = -dx, dy, np.ones_like(h)        # +Y vers le haut de l'image (convention glTF/USD, OpenGL)
l = np.sqrt(nx**2 + ny**2 + nz**2); nx, ny, nz = nx / l, ny / l, nz / l
rgb = np.stack([(nx + 1) / 2, (ny + 1) / 2, (nz + 1) / 2], -1)
Image.fromarray((rgb * 255).round().astype(np.uint8)).save(os.path.join(sys.argv[1], 'weave_normal.png'), optimize=True)
print('weave_normal.png', N, 'px, amplitude', amp)
