# Chez vous — Stéphane Alsac

Visualisation des Éditions sur Toile sur son mur, à taille réelle, en réalité augmentée.
Fonctionne dans Safari (iPhone/iPad, AR Quick Look) et Chrome (Android, Scene Viewer).
Aucune base de données, aucun serveur : un site statique, qui marche hors-ligne une fois chargé.

## Mise en ligne (Netlify)

**Option A, immédiate (5 minutes)** : sur app.netlify.com, « Add new site » → « Deploy manually », puis glisser-déposer le dossier `site/` (ou le zip `chez-vous-site.zip`). Netlify donne une adresse `xxx.netlify.app` ; on peut ensuite lui attacher un sous-domaine (ex. `chez-vous.stephane-alsac.com`) dans « Domain management ».

**Option B, pérenne** : créer un dépôt GitHub vide, y pousser ce dossier, puis sur Netlify « Import an existing project » → GitHub → ce dépôt. Le fichier `netlify.toml` à la racine indique déjà que le site est le dossier `site/`, sans étape de build. Chaque `git push` redéploie.

Après le premier déploiement, relancer `SITE_URL=https://<adresse finale> build/build.sh` pour que l'image de partage (Open Graph) pointe vers l'adresse définitive, puis redéployer.

**Depuis le site stephane-alsac.com** : un seul lien vers l'adresse de l'app (menu, pied de page, ou bouton « Voir chez vous ») ; pas de code à ajouter sur les fiches produit. Un lien direct par œuvre est aussi possible, voir « Liens » ci-dessous.

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

## À tester sur un vrai iPhone (première mise en ligne)

1. Ouvrir l'adresse dans Safari, choisir une œuvre, « Voir sur mon mur » : l'œuvre doit s'accrocher au mur **droite** (haut en haut). Si elle est à l'envers ou couchée → voir « Orientation » ci-dessous.
2. Vérifier la taille réelle : la largeur affichée en AR doit correspondre aux dimensions encadrées (le pincement pour agrandir est désactivé).
3. Bannière en bas de la vue AR : titre, format, prix, bouton « Acquérir ce tirage » → ramène sur la fiche produit du site.
4. Sur Android (Chrome) : le bouton ouvre Scene Viewer ; toucher le mur pour poser l'œuvre.

## Orientation du modèle iPhone

`build/gen_models.mjs` écrit le USDZ « à plat » (dos sur le sol, face vers le haut, haut du tableau vers −Z), convention Reality Composer pour l'ancrage vertical.
Si, au test sur iPhone, le tableau apparaît à l'envers ou de travers : `USDZ_ORIENTATION=upright node build/gen_models.mjs site` puis redéployer.

## Images

Les visuels proviennent du site et portent le filigrane « Stéphane Alsac ». Pour l'app finale (et la version App Store), remplacer `data/raw-<slug>` par les fichiers sans filigrane, puis relancer `build/build.sh` : le reste est automatique.

## Liens

- Catalogue : `https://<domaine>/`
- Une œuvre : `https://<domaine>/#<slug>` — ex. `#tableau-peinture-tigre`
- Une œuvre à une taille : `#<slug>/<taille>` — ex. `#the-sanctum/grand`

Le slug est celui de la fiche produit WooCommerce (dernier segment de l'URL du produit).
