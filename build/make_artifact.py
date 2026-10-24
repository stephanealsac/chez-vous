#!/usr/bin/env python3
"""Dérive de site/index.html une version « artifact » (page de test hébergée par Claude) :
- sans doctype/html/head/body (le conteneur les ajoute)
- polices via Google Fonts, bibliothèques via CDN (CSP de l'artifact)
- pas de service worker
"""
import re, sys, json
src = open(sys.argv[1], encoding='utf-8').read()
out = sys.argv[2]

head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)

title = re.search(r'<title>(.*?)</title>', head).group(1)
style = re.search(r'<style>.*?</style>', head, re.S).group(0)
# police : Google Fonts (lien autorisé), avec color-scheme forcé clair (identité du site, une seule ambiance)
fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Raleway:wght@200;300;400;500&display=swap">'
style = style.replace(':root{', ':root{color-scheme:light;', 1)
style = style.replace('header{position:sticky;top:0;', 'header{position:sticky;top:env(safe-area-inset-top,0px);', 1)

body = body.replace('<script src="vendor/model-viewer.min.js" type="module"></script>',
                    '<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js"></script>')
body = body.replace('<script src="vendor/qrcode.min.js"></script>',
                    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>')
body = body.replace("if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});", '')
body = body.replace("window.open(work.url, '_blank')", "(window.open(work.url, '_blank') || (location.href = work.url))")

page = f'<title>Chez vous — Stéphane Alsac</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{fonts}\n{style}\n{body}'
# gouttières latérales demandées par le contrat de page : on ajoute les max() aux paddings horizontaux des blocs principaux
page = page.replace('padding:calc(14px + var(--sat)) 20px 14px;', 'padding-block:14px;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px));')
open(out, 'w', encoding='utf-8').write(page)
print('artifact page', len(page), 'chars')
