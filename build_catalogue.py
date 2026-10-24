#!/usr/bin/env python3
"""Construit catalogue.json à partir des données WooCommerce (Store API, public).
Usage: python3 -I build_catalogue.py <data_dir> <out_dir>
"""
import json, re, html, sys, os, subprocess, unicodedata

DATA = sys.argv[1]
OUT = sys.argv[2]
SELECTION = None  # None = toutes les Éditions sur Toile achetables (ordre de la boutique)
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
SIZE_RX = r'(Classique|Grand|Géant|Monumental)\s*:\s*(\d{2,3})\s*(?:cm)?\s*[xX×]\s*(\d{2,3})\s*cm'
if SELECTION is None:
    SELECTION = [p['id'] for p in products if p.get('is_purchasable') and p['variations']]
# variations (prix par taille/montage) : téléchargées une fois depuis la Store API, en cache dans data/var
os.makedirs(os.path.join(DATA, 'var'), exist_ok=True)
import time
for p in products:
    if p['id'] not in SELECTION:
        continue
    for v in p['variations']:
        fn = os.path.join(DATA, 'var', f"{v['id']}.json")
        if not os.path.exists(fn):
            subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', fn, f"https://www.stephane-alsac.com/wp-json/wc/store/v1/products/{v['id']}"], check=True)
            time.sleep(0.4)
variations = {}
for fn in os.listdir(os.path.join(DATA, 'var')):
    v = json.load(open(os.path.join(DATA, 'var', fn)))
    variations[v['id']] = v

catalogue = []
for pid in SELECTION:
    p = next(x for x in products if x['id'] == pid)
    name = strip(p['name']).strip('« »').strip()
    sd = strip(p['short_description'])
    # Tailles : comme le site, depuis les DIMENSIONS des variations WooCommerce (longueur × largeur), pas depuis le
    # texte de la description courte (souvent périmé). Toile = variation « roulé dans un tube » (sinon « monté sur
    # châssis ») ; encadrée = variation « encadré caisse US noire ».
    img0 = p['images'][0]
    raw0 = os.path.join(DATA, 'raw-' + p['slug'])
    if not os.path.exists(raw0):
        subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', raw0, img0['src']], check=True)
    wh0 = subprocess.run(['identify', '-format', '%w %h', raw0], capture_output=True, text=True).stdout.split()
    landscape = int(wh0[0]) >= int(wh0[1])
    def orient(l, w):
        big, small = max(l, w), min(l, w)
        return (big, small) if landscape else (small, big)
    labels = {}
    for a in p.get('attributes', []):
        if a['name'] == 'Taille':
            labels = {t['slug']: t['name'] for t in a['terms']}
    groups = {}
    for v in p['variations']:
        vv = variations.get(v['id'])
        if not vv:
            continue
        attrs = {a['name']: a['value'] for a in v['attributes']}
        key = attrs.get('Taille', 'classique')
        g = groups.setdefault(key, {'label': labels.get(key, key.capitalize()), 'slug': key, 'price_framed': None, 'price_unframed': None})
        d = vv['dimensions']
        dims = (float(d['length'] or 0), float(d['width'] or 0))
        price = int(vv['prices']['price'])
        mnt = attrs.get('Montage')
        if mnt in ('encadre-caisse-us-noire', 'encadre'):
            g['price_framed'] = price
            if dims[0] and dims[1]:
                g['framed'] = dims
        else:
            if g['price_unframed'] is None or mnt == 'roule-tube':
                g['price_unframed'] = price
            if dims[0] and dims[1] and (mnt == 'roule-tube' or 'canvas' not in g):
                g['canvas'] = dims
    sizes = []
    for g in groups.values():
        if 'canvas' not in g:
            if 'framed' in g:
                g['canvas'] = (g['framed'][0] - 9, g['framed'][1] - 9)
            else:
                m = re.search(r'%s\s*:\s*(\d{2,3})\s*(?:cm)?\s*[xX×]\s*(\d{2,3})\s*cm' % re.escape(g['label']), sd)
                if not m:
                    continue
                g['canvas'] = (float(m.group(1)), float(m.group(2)))
        w, h = orient(*g['canvas'])
        s_ = {'label': g['label'], 'slug': g['slug'], 'w': int(w) if w == int(w) else w, 'h': int(h) if h == int(h) else h,
              'price_framed': g['price_framed'], 'price_unframed': g['price_unframed']}
        if 'framed' in g:
            fw, fh = orient(*g['framed'])
            s_['framed_cm'] = {'w': int(fw) if fw == int(fw) else fw, 'h': int(fh) if fh == int(fh) else fh}
        sizes.append(s_)
    sizes.sort(key=lambda x: x['w'] * x['h'])
    if not sizes:
        print('IGNORÉ (aucune taille) :', name)
        continue
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
    # vignette carrée (grille d'accueil) : recadrée au centre, 600 px
    subprocess.run(['convert', raw, '-auto-orient', '-strip', '-resize', '600x600^', '-gravity', 'center', '-extent', '600x600',
                    '-quality', '80', os.path.join(OUT, a['thumb'])], check=True)
    wh = subprocess.run(['identify', '-format', '%w %h', os.path.join(OUT, a['image'])], capture_output=True, text=True).stdout.split()
    a['image_px'] = [int(wh[0]), int(wh[1])]
    del a['image_src']
    # les images sont mises en cache un an (immutable) : leur adresse porte une empreinte du contenu
    import hashlib
    for k in ('image', 'thumb'):
        h = hashlib.sha1(open(os.path.join(OUT, a[k]), 'rb').read()).hexdigest()[:8]
        a[k + '_url'] = a[k] + '?v=' + h

json.dump({'frame': {'type': 'caisse-americaine', 'color': 'noir neutre satiné', 'lip_cm': 1.8, 'add_cm': 4.3, 'depth_cm': 4.0,
                     'floor_cm': 1.3, 'canvas_depth_cm': 2.3, 'canvas_round_cm': 0.25, 'fillet_outer_cm': 0.15, 'fillet_inner_cm': 0.10},
           'artist': 'Stéphane Alsac', 'site': 'https://www.stephane-alsac.com', 'works': catalogue},
          open(os.path.join(OUT, 'catalogue.json'), 'w'), ensure_ascii=False, indent=1)
for a in catalogue:
    print(a['title'], a['image_px'], a['crop_note'], [(s['label'], s['w'], s['h'], s['price_framed'], s['price_unframed']) for s in a['sizes']])
