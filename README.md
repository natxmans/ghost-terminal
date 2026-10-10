# Ghost Terminal

![Ghost Terminal](og-image.png)

**Tape n'importe quoi sur ton clavier… et deviens un hacker de film.**

Chaque touche fait apparaître du vrai code (coloré comme dans un éditeur), et des dizaines d'effets dramatiques transforment ton écran en scène de film d'espionnage.

👉 **[Essayer Ghost Terminal en ligne](https://natxmans.github.io/ghost-terminal/)**

---

## ✨ Fonctionnalités

- **8 langages** de faux code : C (noyau), Python, JavaScript, Rust, Go, Assembleur x86, Bash… et **ton propre code** (colle-le dans les réglages).
- **10 effets dramatiques** à lancer avec `Maj` + `1` … `0`, cumulables, dans des fenêtres déplaçables.
- **Mode mission** : une opération complète qui enchaîne plusieurs effets toute seule.
- **Pilote automatique** : le code s'écrit sans toucher au clavier.
- **Mode immersion** : plus aucune interface, juste le terminal. Parfait pour une blague.
- **18 succès** à débloquer, et un code secret caché 🌈.
- **Voix de l'ordinateur** (synthèse vocale) et **sons** générés en direct.
- **HUD** façon film : processeur, radar, trafic, journal des événements.
- **7 thèmes** de couleur et effet écran CRT.
- **Application installable** qui marche **hors ligne** (PWA).
- **Mobile** : touche l'écran pour taper, 3 doigts = accès autorisé, 4 doigts = accès refusé.

## ⌨️ Raccourcis

| Touche | Action |
|---|---|
| N'importe quelle touche | Écrire du code |
| `Alt` ×3 | ACCÈS AUTORISÉ |
| `Verr. Maj` ×3 | ACCÈS REFUSÉ |
| `Maj` + `1` | Brèche système |
| `Maj` + `2` | Caméra & micro (simulés) |
| `Maj` + `3` | Traçage GPS |
| `Maj` + `4` | Explorateur de fichiers |
| `Maj` + `5` | Requête base de données |
| `Maj` + `6` | Cassage de mot de passe |
| `Maj` + `7` | Balayage satellite |
| `Maj` + `8` | Autodestruction |
| `Maj` + `9` | Réseau mondial |
| `Maj` + `0` | Mode fantôme |
| `F1` | Aide |
| `F2` | Téléchargement |
| `F3` | Mode mission |
| `F6` | Pilote automatique |
| `F7` | Panneau HUD |
| `F8` | Thème suivant |
| `F9` | Réglages |
| `F10` | Mode immersion |
| `Échap` | Tout fermer |

## 🔒 Tout est faux (et sans danger)

Ghost Terminal est un **jouet**. Rien n'est piraté : la caméra, le micro, le GPS et les fichiers affichés sont **100 % simulés**. Le site n'accède à aucun de tes appareils et ne collecte aucune donnée : les réglages et succès restent dans ton navigateur, et seules les polices d'écriture sont chargées depuis Google Fonts.

## 🚀 Lancer en local

Aucune installation : ouvre simplement `index.html` dans ton navigateur.

Pour profiter de l'installation en application et du mode hors ligne, sers le dossier avec un petit serveur, par exemple :

```bash
python -m http.server 8000
```

puis ouvre <http://localhost:8000>.

## 📁 Structure

| Fichier | Rôle |
|---|---|
| `index.html` | La page |
| `style.css` | Le design (thèmes, fenêtres, effets) |
| `app.js` | Le moteur : frappe, fenêtres, missions, succès, HUD, son, voix |
| `effects.js` | Les 11 effets dramatiques |
| `snippets.js` | Le faux code de chaque langage |
| `highlight.js` | La coloration du code |
| `icons.js` | Les icônes |
| `security.js` | La protection anti-copie |
| `sw.js`, `manifest.webmanifest` | L'application installable et le mode hors ligne |
