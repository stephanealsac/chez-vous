# Chez vous — Stéphane Alsac

Visualisation des Éditions sur Toile sur son mur, à taille réelle, en réalité augmentée.
Fonctionne dans Safari (iPhone/iPad, AR Quick Look) et Chrome (Android, Scene Viewer).
Aucune base de données, aucun serveur : un site statique.

## Mise en ligne (Netlify)

**Option A, immédiate (5 minutes)** : sur app.netlify.com, « Add new site » → « Deploy manually », puis glisser-déposer le dossier `site/` (ou le zip `chez-vous-site.zip`). Netlify donne une adresse `xxx.netlify.app` ; on peut ensuite lui attacher un sous-domaine (ex. `chez-vous.stephane-alsac.com`) dans « Domain management ».

**Option B, pérenne** : créer un dépôt GitHub vide, y pousser ce dossier, puis sur Netlify « Import an existing project » → GitHub → ce dépôt. Le fichier `netlify.toml` à la racine indique déjà que le site est le dossier `site/`, sans étape de build. Chaque `git push` redéploie.

Après le premier déploiement, relancer `SITE_URL=https://<adresse finale> build/build.sh` pour que l'image de partage (Open Graph) pointe vers l'adresse définitive, puis redéployer.

**Depuis le site stephane-alsac.com** : un seul lien vers l'adresse de l'app (menu, pied de page, ou bouton « Voir chez vous ») ; pas de code à ajouter sur les fiches produit. Un lien direct par œuvre est aussi possible, voir « Liens » ci-dessous.

## Dossiers

- `site/` — **le site à déployer tel quel** (Netlify). Tout est dedans : page, polices, images, modèles 3D.
- `build_catalogue.py` — lit la boutique WooCommerce (API publique), choisit les œuvres, télécharge et recadre les images, écrit `site/catalogue.json`.
- `build/gen_models.mjs` — génère pour chaque œuvre × taille un `.usdz` (iPhone) et un `.glb` (Android) : toile + caisse américaine noire mate (baguette 4,5 × 4,5 cm, jour 0,8 cm).
- `build/build.sh` — enchaîne les trois.
- `data/` — cache des réponses WooCommerce et des images brutes.

## Ajouter ou modifier une œuvre

1. Dans `build_catalogue.py`, ajouter l'identifiant WooCommerce du produit dans `SELECTION`.
2. Lancer `build/build.sh`.
3. Déployer `site/` (ou `git push` si Netlify est branché sur le dépôt).

Les textes, tailles, prix et images viennent du site, tels quels. Convention lue automatiquement : le site écrit le grand côté en premier (« 54 × 45 » pour un portrait, « 140 × 65 » pour un paysage) ; l'orientation est déduite de l'image.

## Le cadre (caisse américaine, d'après photos et cotes de l'atelier)

Profil dans `build/frame_geometry.mjs`, cotes dans `site/catalogue.json` (bloc `frame`) : arête avant `lip_cm` 1,8 ; le cadre ajoute `add_cm` 4,3 par côté (lèvre + jour de 2,5) ; profondeur `depth_cm` 4 ; fond du caisson `floor_cm` 1,3 (2,7 de profondeur intérieure) ; châssis + toile `canvas_depth_cm` 2,3 (face de la toile 0,4 cm en retrait de l'arête) ; arête avant du châssis arrondie `canvas_round_cm` 0,25 (l'image tourne sur l'arrondi, le galon couvre le chant) ; arêtes avant arrondies (`fillet_*_cm`).
Matières : noir neutre satiné (cadre ; les photos iPhone réchauffent les tons, ne pas s'y fier), fond du caisson mat avec ombre calculée (`build/gen_floor_ao.py` → `site/ao/`), toile mate **sans aucune texture** (la vue RA d’Apple amplifie les reliefs), galon de toile fine noire sur les chants du châssis (`build/gen_weave.py` → `site/tape_color.png` + `site/tape_normal.png`, 24 fils/cm).
Aperçu image de synthèse : `node build/render.mjs models/<fichier>.glb sortie.png [front|three-quarter|corner|corner2]`.
Après modification, relancer `build/build.sh`.

## Changer de format pendant la réalité augmentée

Testé et abandonné sur le web : AR Quick Look exécute le toucher et le masquage, mais pas l'état initial (formats superposés). Un format par fichier `.usdz` ; on revient à la page pour changer. Le changement de taille en direct sera fait dans l'app native (ARKit).

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

## Cache

Les fichiers 3D portent un nom unique par contenu (`<slug>-<taille>-<empreinte>.usdz`) : toute modification du cadre ou d'une image change le nom, et les téléphones chargent la nouvelle version sans vider leur cache. `catalogue.json` et la page ne sont jamais mis en cache.

## Liens

- Catalogue : `https://<domaine>/`
- Une œuvre : `https://<domaine>/#<slug>` — ex. `#tableau-peinture-tigre`
- Une œuvre à une taille : `#<slug>/<taille>` — ex. `#the-sanctum/grand`

Le slug est celui de la fiche produit WooCommerce (dernier segment de l'URL du produit).


## Mise à jour d'octobre 2026
- **Catalogue complet** : toutes les Éditions sur Toile achetables de la boutique (46), ordre de la boutique. `SELECTION = None` dans `build_catalogue.py`.
- **Tailles** : prises comme le site, dans les *dimensions des variations WooCommerce* (longueur × largeur) — toile = variation « roulé dans un tube », encadrée = variation « encadré caisse US noire » (`framed_cm`, affichée telle quelle). Le texte « Taille disponible : … » de la description courte n'est plus utilisé (périmé sur plusieurs fiches). Orientation : le grand côté est horizontal si l'image est horizontale.
- **Accueil** : titre « Éditions sur Toile » (capitales espacées, comme GALERIE sur le site), vignettes carrées recadrées au centre (`img/*-thumb.jpg`, 600 px). Les adresses d'images portent une empreinte (`?v=`) pour contourner le cache d'un an.
- **Fiche** : plus de silhouette d'échelle ; sélecteur de taille toujours affiché (même une seule), caractères agrandis.
- **Ombre portée** : plan transparent contre le mur (texture RGBA `ao/shadow-*.png`, matériau sans aucune réflexion : ior 1, spéculaire nul), ombre sous le cadre et à droite, fondu vers les lignes du haut et de gauche. Réglages dans `build/gen_floor_ao.py` (`OFFX, OFFY, SOFT, AMAX`).
- **Tutoriel vidéo** : `site/tuto.mp4` (31 s, 1080×1920, H.264 + bruitages AAC, 6,5 Mo) + `tuto-poster.jpg`, adresses avec empreinte `?v=` (cache un an). Source : `build/tuto/v6.html` (motion design : iPhone 3D avec l'appli réelle à l'écran, pièce « écran initial » de Stef, Razzle Dazzle Classique puis Grand recentré au doigt, sous-titres en Cormorant). Fabrication : `node tuto/make_video.mjs v6.html tuto 30 24` depuis `build/` avec `CRF=25 AUDIO=tuto/audio/mix6.wav` ; bande-son par `tuto/audio/make_audio.py 30.8 mix6.wav none 6` (bruitages seuls). Captures d'écran : `tuto/capture_zebra*.mjs` (serveur local :8765). Cadres détourés : `render.mjs` avec `ALPHA=1`. Les autres essais (v1–v5, voix Piper/Chatterbox, musique générée) restent dans `build/tuto/` mais ne sont pas publiés. S'ouvre à la première visite de l'accueil, puis via « ? ».
