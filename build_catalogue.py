#!/usr/bin/env python3
"""Construit catalogue.json à partir des données WooCommerce (Store API, public).
Usage: python3 -I build_catalogue.py <data_dir> <out_dir>
"""
import json, re, html, sys, os, subprocess, unicodedata

DATA = sys.argv[1]
OUT = sys.argv[2]
SELECTION = [34533, 34501, 31420, 33389, 31469, 27977, 30305, 20957, 30214]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
MAX_TEX = 1536  # px, côté le plus long de la texture (suffisant en AR, ~3× plus léger)

def strip(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()

def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s

products = json.load(open(os.path.join(DATA, 'toile.json')))
variations = {}
for fn in os.listdir(os.path.join(DATA, 'var')):
    v = json.load(open(os.path.join(DATA, 'var', fn)))
    variations[v['id']] = v

catalogue = []
for pid in SELECTION:
    p = next(x for x in products if x['id'] == pid)
    name = strip(p['name']).strip('« »').strip()
    sd = strip(p['short_description'])
    # Tailles : "Classique : 54 x 45 cm"
    sizes = []
    # Convention du site : le plus grand côté est écrit en premier ("54 x 45" pour un portrait, "140 x 65" pour
    # un paysage). On oriente donc le couple selon l'orientation de l'image.
    img0 = p['images'][0]
    landscape = True
    m = re.search(r' (\d+)w$', img0['srcset'].split(',')[0].strip()) if img0.get('srcset') else None
    raw0 = os.path.join(DATA, 'raw-' + p['slug'])
    if not os.path.exists(raw0):
        subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', raw0, img0['src']], check=True)
    wh0 = subprocess.run(['identify', '-format', '%w %h', raw0], capture_output=True, text=True).stdout.split()
    landscape = int(wh0[0]) >= int(wh0[1])
    for label, a_, b_ in re.findall(r'(Classique|Grand|Géant|Monumental)\s*:\s*(\d{2,3})\s*[xX×]\s*(\d{2,3})\s*cm', sd):
        big, small = max(int(a_), int(b_)), min(int(a_), int(b_))
        w, h = (big, small) if landscape else (small, big)
        sizes.append({'label': label, 'w': w, 'h': h, 'slug': slugify(label)})
    # prix par taille (variation Taille=<slug>)
    for s in sizes:
        s['price_framed'] = None
        s['price_unframed'] = None
        for v in p['variations']:
            attrs = {a['name']: a['value'] for a in v['attributes']}
            if 'Taille' in attrs and attrs['Taille'] != s['slug']:
                continue
            vv = variations.get(v['id'])
            if not vv:
                continue
            price = int(vv['prices']['price'])
            if attrs.get('Montage') == 'encadre-caisse-us-noire':
                s['price_framed'] = price
            else:
                s['price_unframed'] = price
    img = p['images'][0]
    desc = strip(p['description'])  # texte du site, tel quel
    catalogue.append({
        'id': pid,
        'slug': p['slug'],
        'title': name,
        'edition': (re.search(r'numérotée de 1 à (\d+)', sd) or [None, None])[1],
        'url': p['permalink'],
        'image_src': img['src'],
        'image': f"img/{p['slug']}.jpg",
        'thumb': f"img/{p['slug']}-thumb.jpg",
        'sizes': sizes,
        'description': desc,
    })

os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
for a in catalogue:
    raw = os.path.join(DATA, 'raw-' + a['slug'])
    if not os.path.exists(raw):
        subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', raw, a['image_src']], check=True)
    # texture : recadrée au ratio de la toile (centrée), ≤ 2048 px, jpeg q85 ; vignette 600 px
    s0 = a['sizes'][0]
    ratio = s0['w'] / s0['h']
    wh = subprocess.run(['identify', '-format', '%w %h', raw], capture_output=True, text=True).stdout.split()
    iw, ih = int(wh[0]), int(wh[1])
    if iw / ih > ratio:   # image trop large → on rogne les côtés
        cw, ch = int(round(ih * ratio)), ih
    else:                 # image trop haute → on rogne haut/bas
        cw, ch = iw, int(round(iw / ratio))
    a['crop_note'] = f'{iw}x{ih} -> {cw}x{ch} (ratio {ratio:.3f}, image {iw/ih:.3f})'
    subprocess.run(['convert', raw, '-auto-orient', '-gravity', 'center', '-crop', f'{cw}x{ch}+0+0', '+repage',
                    '-strip', '-resize', f'{MAX_TEX}x{MAX_TEX}>', '-quality', '80',
                    os.path.join(OUT, a['image'])], check=True)
    subprocess.run(['convert', raw, '-auto-orient', '-strip', '-resize', '600x600>', '-quality', '80',
                    os.path.join(OUT, a['thumb'])], check=True)
    wh = subprocess.run(['identify', '-format', '%w %h', os.path.join(OUT, a['image'])], capture_output=True, text=True).stdout.split()
    a['image_px'] = [int(wh[0]), int(wh[1])]
    del a['image_src']

json.dump({'frame': {'type': 'caisse-americaine', 'color': '#111111', 'finish': 'mat',
                     'bar_width_cm': 4.5, 'bar_depth_cm': 4.5, 'gap_cm': 0.8, 'canvas_depth_cm': 3.5},
           'artist': 'Stéphane Alsac', 'site': 'https://www.stephane-alsac.com', 'works': catalogue},
          open(os.path.join(OUT, 'catalogue.json'), 'w'), ensure_ascii=False, indent=1)
for a in catalogue:
    print(a['title'], a['image_px'], a['crop_note'], [(s['label'], s['w'], s['h'], s['price_framed'], s['price_unframed']) for s in a['sizes']])
