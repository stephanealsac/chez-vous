#!/usr/bin/env python3
"""Ajoute la version anglaise (américaine) à catalogue.json, depuis la boutique anglaise du site
(https://www.stephane-alsac.com/en/, Store API publique) : titre, lien, description, prix en dollars.
Correspondance FR → EN par l'image principale du produit (même fichier dans les deux langues).
Usage : python3 -I build_catalogue_en.py <data_dir> <catalogue.json>
"""
import json, re, html, sys, os, subprocess, time

DATA, CAT = sys.argv[1], sys.argv[2]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
API = "https://www.stephane-alsac.com/en/wp-json/wc/store/v1/products"
SIZE_EN = {'classique': 'classic', 'grand': 'large', 'geant': 'giant', 'monumental': 'monumental'}
LABEL_EN = {'classique': 'Classic', 'grand': 'Large', 'geant': 'Giant', 'monumental': 'Monumental'}

def strip(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()

def title(s):
    return strip(s).strip('“”"«» ').strip()

def key(p):
    if not p.get('images'):
        return ''
    f = p['images'][0]['src'].split('/')[-1]
    return re.sub(r'-(\d+x\d+|e\d{9,})(?=\.)', '', f)

d = os.path.join(DATA, 'en'); os.makedirs(os.path.join(d, 'var'), exist_ok=True)
en = []
for page in (1, 2, 3):
    fn = os.path.join(d, f'products-{page}.json')
    if not os.path.exists(fn):
        subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', fn, f'{API}?per_page=100&page={page}'], check=True)
    part = json.load(open(fn))
    en += part
    if len(part) < 100:
        break
fr = {p['id']: p for p in json.load(open(os.path.join(DATA, 'toile.json')))}
enby = {}
for p in en:
    if any(c['slug'] == 'giclees-on-canvas' for c in p['categories']):
        enby.setdefault(key(p), p)

def price(v):
    pr = v['prices']; return round(int(pr['price']) / 10 ** pr['currency_minor_unit'])

cat = json.load(open(CAT))
missing = []
for w in cat['works']:
    e = enby.get(key(fr[w['id']]))
    if not e:
        missing.append(w['title']); continue
    w['title_en'] = title(e['name'])
    w['url_en'] = e['permalink']
    w['description_en'] = strip(e['description'])
    vars_ = []
    for v in e['variations']:
        fn = os.path.join(d, 'var', f"{v['id']}.json")
        if not os.path.exists(fn):
            subprocess.run(['curl', '-sS', '-m', '60', '-A', UA, '-o', fn, f"{API}/{v['id']}"], check=True)
            time.sleep(0.3)
        vars_.append((v, json.load(open(fn))))
    for s in w['sizes']:
        s['label_en'] = LABEL_EN.get(s['slug'], s['label'])
        want = SIZE_EN.get(s['slug'], s['slug'])
        for v, full in vars_:
            a = {x['name']: x['value'] for x in v['attributes']}
            if 'Size' in a and a['Size'].removesuffix('-en') != want:   # sans attribut Size : œuvre à un seul format
                continue
            m = a.get('Mounting', '')
            if 'floater' in m or 'framed' in m:
                s['price_framed_usd'] = price(full)
            elif 'tube' in m:
                s['price_unframed_usd'] = price(full)
json.dump(cat, open(CAT, 'w'), ensure_ascii=False, indent=1)
ok = sum(1 for w in cat['works'] if 'title_en' in w)
noprice = [w['title'] for w in cat['works'] for s in w['sizes'] if 'title_en' in w and 'price_framed_usd' not in s]
print(f'EN : {ok}/{len(cat["works"])} œuvres ; sans correspondance : {missing} ; tailles sans prix encadré $ : {noprice}')
