# GATE RUSH — la pub fake, en vrai jeu

Le gameplay des pubs fake de Last War, jouable pour de vrai dans le navigateur :
ta squad avance sur un pont, tu choisis les portes mathématiques (+N, x2, −N, ÷2),
tu fais grossir ton armée et tu survis aux squads rouges le plus longtemps possible.
Les parties sont courtes : la difficulté monte très vite.

**Jouer : https://arsenehuot.github.io/gate-rush/**

## Fonctionnalités
- 3D (Three.js), fidèle au look des pubs : pont en pierre sur l'océan, soldats
  humanoïdes instanciés (casque, gilet, fusil, jambes animées)
- Portes : nombres (+N, x2, −N, ÷2) et améliorations dorées (DÉGÂTS, CADENCE, ARME ↑)
- 3 armes : FUSIL → MINIGUN → BLASTER, chacune avec ses projectiles
- Obstacles : caisses bonus 🎁, barils explosifs, barricades à détruire
- Ennemis : éclaireurs rapides, soldats en squad, brutes blindées, boss géants
- Tirer sur une porte augmente sa valeur (max +10 par porte)
- Classement mondial top 100 : pseudo + rang affichés en fin de partie
- Mobile (glisser) et desktop (souris ou flèches)

## Technique
- Site statique servi par GitHub Pages, aucun build
- Classement stocké sur textdb.online (clé partagée, voir `leaderboard.js`) —
  service gratuit sans compte ; à remplacer par un vrai backend si le jeu décolle
- Sons générés en WebAudio, aucune dépendance hors Three.js (CDN)

## Dev local
N'importe quel serveur statique, par exemple :

```sh
python3 -m http.server 4173
```

Hooks de debug dans la console : `__start()` lance une partie, `__step(dt)` avance
la simulation (utile pour l'équilibrage), `__G` expose l'état du jeu.
