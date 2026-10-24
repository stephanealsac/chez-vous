# Chez vous — Stéphane Alsac

Visualisation des Éditions sur Toile sur son mur, à taille réelle, en réalité augmentée.
Fonctionne dans Safari (iPhone/iPad, AR Quick Look) et Chrome (Android, Scene Viewer).
Aucune base de données, aucun serveur : un site statique, qui marche hors-ligne une fois chargé.

## Dossiers

- `site/` — **le site à déployer tel quel** (Netlify). Tout est dedans : page, polices, images, modèles 3D.
- `build_catalogue.py` — lit la boutique WooCommerce (API publique), choisit les œuvres, télécharge et recadre les images, écrit `site/catalogue.json`.
- `build/gen_models.mjs` — génère pour chaque œuvre × taille un `.usdz` (iPhone) et un `.glb` (Android) : toile + caisse américaine noire mate (baguette 4,5 × 4,5 cm, jour 0,8 cm).
- `build/gen_sw.mjs` — génère le service worker (cache hors-ligne).
- `build/build.sh` — enchaîne les trois.
- `data/` — cache des réponses WooCommerce et des images brutes.

## Ajouter ou modifier une œuvre

1. Dans `build_catalogue.py`, ajouter l'identifiant WooCommerce du produit dans `SELECTION`.
2. Lancer `build/build.sh`.
3. Déployer `site/` (ou `git push` si Netlify est branché sur le dépôt).

Les tailles, prix et images viennent du site. Convention lue automatiquement : le site écrit le grand côté en premier (« 54 × 45 » pour un portrait, « 140 × 65 » pour un paysage) ; l'orientation est déduite de l'image.

## Réglages du cadre

Dans `site/catalogue.json` (bloc `frame`) : `bar_width_cm`, `bar_depth_cm`, `gap_cm`, `canvas_depth_cm`. Après modification, relancer `node build/gen_models.mjs site`.

## Orientation du modèle iPhone

`build/gen_models.mjs` écrit le USDZ « à plat » (dos sur le sol, face vers le haut, haut du tableau vers −Z), convention Reality Composer pour l'ancrage vertical.
Si, au test sur iPhone, le tableau apparaît à l'envers ou de travers : `USDZ_ORIENTATION=upright node build/gen_models.mjs site` puis redéployer.

## Liens

- Catalogue : `https://<domaine>/`
- Une œuvre : `https://<domaine>/#<slug>` — ex. `#tableau-peinture-tigre`
- Une œuvre à une taille : `#<slug>/<taille>` — ex. `#the-sanctum/grand`

Le slug est celui de la fiche produit WooCommerce (dernier segment de l'URL du produit).
