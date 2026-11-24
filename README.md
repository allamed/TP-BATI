# TP — L'évolution du bâti vue par Sentinel

Nov 24, 2026 · @allam mohamed

En onze étapes, vous construisez pas à pas un outil qui montre où, quand et à quel rythme une commune s'est construite entre 2016 et 2025. À chaque étape, vous collez un bloc de code sous le précédent, vous cliquez sur « Run » et vous obtenez un nouveau résultat.

## Avant de commencer

Durée : 1 h à 1 h 15. Aucun prérequis en programmation : vous n'écrivez pas le code, vous l'assemblez bloc par bloc et vous apprenez à lire ce qu'il produit.

**Le besoin.** Avant de contrôler bâtiment par bâtiment (TP suivant), on veut une vue d'ensemble de la commune de Dar Bouazza : où, quand et à quel rythme a-t-on construit ?

**La règle du TP, à répéter à chaque étape**

1. Copiez le bloc de code de l'étape, en entier.
2. Collez-le **tout en bas** de l'éditeur, sous ce que vous avez déjà collé. N'effacez jamais rien.
3. Cliquez sur « Run ».
4. Regardez le résultat à l'endroit indiqué, puis lisez « Comment lire le résultat ».
5. Cliquez sur « Save » de temps en temps.

Pour démarrer : ouvrez [code.earthengine.google.com](https://code.earthengine.google.com), connectez-vous, et partez d'un script vide (bouton « NEW » puis « File », ou effacez le contenu de l'éditeur central).

**Où regarder dans Earth Engine**

| Zone | Où | À quoi elle sert dans ce TP |
| --- | --- | --- |
| Éditeur | Panneau central, en haut | Vous y collez les blocs, l'un sous l'autre |
| Carte | En bas | Les images et les couches s'y affichent |
| Layers | Bouton en haut à droite de la carte | Cocher ou décocher une couche, régler sa transparence |
| Console | Onglet en haut à droite | Les textes, les chiffres et les graphiques s'y affichent |
| Tasks | Onglet à côté de Console | Les exports vers Google Drive s'y lancent |

**Les onze étapes**

| Étape | Ce que vous ajoutez | Ce que vous obtenez | Où regarder |
| --- | --- | --- | --- |
| 1 | La zone d'étude | Un rectangle bleu autour de la commune | Carte, Console |
| 2 | Les images Sentinel-2 | L'image de 2016 et celle de 2025 | Carte, Layers |
| 3 | Dynamic World | Le bâti de 2016 en gris, celui de 2025 en rouge | Carte, Layers |
| 4 | L'année de construction | Une carte colorée selon l'année, avec sa légende | Carte |
| 5 | Les chiffres | Les hectares bâtis et deux graphiques | Console |
| 6 | Le clic | L'historique de n'importe quel point | Carte, Console |
| 7 | Le radar Sentinel-1 | Une image en trois dates où le neuf ressort en rouge | Carte |
| 8 | L'animation | Un GIF de l'étalement urbain, à télécharger | Console |
| 9 | L'export | Un fichier GeoTIFF pour QGIS ou ArcGIS | Tasks |
| 10 | L'application | Deux cartes séparées par un rideau avant / après | Tout l'écran |
| 11 | L'application complète | Animation, chiffres et clic réunis dans un panneau | Tout l'écran |

**Deux conseils**

- Les couches s'empilent sur la carte au fil des étapes. Si l'affichage ralentit, ouvrez « Layers » et décochez celles dont vous n'avez plus besoin.
- Un message en rouge dans la Console ? Le plus souvent, un bloc a été collé deux fois, ou collé avant un bloc précédent. Vérifiez l'ordre : chaque bloc commence par une ligne `// ===== ÉTAPE N`.

## Étape 1 — La zone d'étude

On commence par dire à Earth Engine où et quand regarder. Ce premier bloc contient les seuls réglages du TP : la commune, son emprise, la période et le seuil de bâti.

```javascript
// ===== ÉTAPE 1 — LA ZONE D'ÉTUDE =============================================
// Les seules lignes à modifier pour changer de commune ou de période
var NOM_COMMUNE = 'Dar Bouazza';
var EMPRISE = [-7.87, 33.48, -7.76, 33.55];   // [ouest, sud, est, nord], en degrés
var ANNEE_DEBUT = 2016;
var ANNEE_FIN = 2025;
var SEUIL_BATI = 0.5;      // probabilité au-delà de laquelle un pixel est considéré comme bâti

var ZONE = ee.Geometry.Rectangle(EMPRISE);
var ANNEES = [];
for (var a = ANNEE_DEBUT; a <= ANNEE_FIN; a++) { ANNEES.push(a); }
var ANNEE_MILIEU = Math.round((ANNEE_DEBUT + ANNEE_FIN) / 2);

// Affichage : fond satellite, carte centrée, contour de la zone en bleu clair
Map.setOptions('SATELLITE');
Map.centerObject(ZONE, 13);
var contour = ee.Image().byte().paint(ee.FeatureCollection([ee.Feature(ZONE)]), 1, 2);
Map.addLayer(contour, {palette: ['00e5ff']}, 'Zone d\'étude');

print('Commune étudiée :', NOM_COMMUNE);
print('Années étudiées :', ANNEES);
print('Surface de la zone (km²) :', ZONE.area(1).divide(1e6));
```

**Ce qui s'affiche**

- Sur la carte : le fond satellite de Google, centré sur Dar Bouazza, et un rectangle bleu clair qui délimite la zone d'étude.
- Dans la Console : le nom de la commune, la liste des années de 2016 à 2025 (cliquez sur la petite flèche pour la déplier) et la surface de la zone, environ 80 km².

**Comment lire le résultat**

- Le rectangle n'est pas la limite administrative de la commune : c'est une emprise simple, définie par quatre nombres (ouest, sud, est, nord). Tout ce qui suit sera calculé à l'intérieur.
- Le fond satellite est une image récente à très haute résolution, sans date précise. Il sert de repère, pas de mesure. Les mesures viendront des images Sentinel, qui sont datées.

**À retenir.** `Map.addLayer(...)` ajoute une couche sur la carte et `print(...)` écrit dans la Console. Vous retrouverez ces deux instructions à presque toutes les étapes.

**Vérifiez.** La zone contient-elle bien le littoral, le centre de Dar Bouazza et les terres agricoles autour ? Repérez déjà à l'œil un quartier qui vous semble récent.

## Étape 2 — Les images Sentinel-2

On fabrique une image par an à partir des images Sentinel-2 (optique, 10 m), puis on affiche la première et la dernière année pour un premier avant / après.

```javascript
// ===== ÉTAPE 2 — LES IMAGES SENTINEL-2 =======================================
var S2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED').filterBounds(ZONE);
var VIS_S2 = {bands: ['B4', 'B3', 'B2'], min: 400, max: 3000, gamma: 1.3};

// Une image par an : la médiane des images peu nuageuses de mai à septembre
function imageS2(annee) {
  return S2.filterDate(annee + '-05-01', annee + '-10-01')
           .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
           .median()
           .clip(ZONE);
}

print('Nombre d\'images Sentinel-2 retenues pour ' + ANNEE_FIN + ' :',
      S2.filterDate(ANNEE_FIN + '-05-01', ANNEE_FIN + '-10-01')
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)).size());

Map.addLayer(imageS2(ANNEE_DEBUT), VIS_S2, 'Sentinel-2 ' + ANNEE_DEBUT);
Map.addLayer(imageS2(ANNEE_FIN), VIS_S2, 'Sentinel-2 ' + ANNEE_FIN);
```

**Ce qui s'affiche**

- Sur la carte : l'image Sentinel-2 de 2025 en couleurs naturelles, découpée sur la zone. Elle est plus floue que le fond satellite : un pixel représente 10 m au sol.
- Dans « Layers » : deux nouvelles couches, « Sentinel-2 2016 » et « Sentinel-2 2025 ». La dernière ajoutée est au-dessus.
- Dans la Console : le nombre d'images de 2025 qui ont servi à fabriquer l'image annuelle.

**Comment lire le résultat**

- Décochez et recochez « Sentinel-2 2025 », ou faites glisser son curseur de transparence : vous passez de 2025 à 2016. C'est votre premier avant / après.
- Les zones qui changent de teinte entre les deux dates sont les candidates : un champ (vert ou brun) devenu lotissement (gris clair, blanc, trame régulière de rues).
- Chaque image annuelle n'est pas une photo prise un jour donné. C'est la médiane de toutes les images peu nuageuses de mai à septembre : pour chaque pixel, on garde la valeur du milieu. Les nuages et les ombres, qui sont des valeurs extrêmes, disparaissent.

**À retenir.** `imageS2(annee)` est une fonction : une recette que l'on écrit une fois et que l'on réutilise pour n'importe quelle année. Tout le TP est construit avec quelques recettes de ce type.

**Vérifiez.** Trouvez deux secteurs construits entre 2016 et 2025. À 10 m de résolution, distinguez-vous un bâtiment isolé ? Un lotissement ?

## Étape 3 — Dynamic World : où est le bâti ?

L'œil repère les changements, mais ne les mesure pas. On fait appel à Dynamic World : pour chaque image Sentinel-2, ce jeu de données fournit, pixel par pixel, une probabilité que le sol soit bâti. C'est le seul ingrédient d'IA du TP, utilisé ici comme une donnée prête à l'emploi.

```javascript
// ===== ÉTAPE 3 — DYNAMIC WORLD : OÙ EST LE BÂTI ? ============================
var DW = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterBounds(ZONE);
var VIS_PROBA = {min: 0, max: 1, palette: ['000004', '51127c', 'b73779', 'fc8961', 'fcfdbf']};

// Probabilité moyenne de bâti sur l'année (entre 0 et 1)
function probaBati(annee) {
  return DW.filterDate(annee + '-01-01', (annee + 1) + '-01-01').select('built').mean().clip(ZONE);
}
// Bâti ou non : 1 si la probabilité dépasse le seuil, 0 sinon
function bati(annee) {
  return probaBati(annee).gt(SEUIL_BATI);
}

Map.addLayer(probaBati(ANNEE_FIN), VIS_PROBA, 'Probabilité de bâti ' + ANNEE_FIN);
Map.addLayer(bati(ANNEE_FIN).selfMask(), {palette: ['ff1744']}, 'Bâti ' + ANNEE_FIN + ' (rouge)');
Map.addLayer(bati(ANNEE_DEBUT).selfMask(), {palette: ['9e9e9e']}, 'Bâti ' + ANNEE_DEBUT + ' (gris)');
```

**Ce qui s'affiche**

Trois nouvelles couches, empilées dans cet ordre de bas en haut :

- « Probabilité de bâti 2025 » : un fond sombre (probabilité proche de 0) qui s'éclaire vers l'orange puis le jaune pâle (probabilité proche de 1) ;
- « Bâti 2025 (rouge) » : les pixels classés bâtis en 2025 ;
- « Bâti 2016 (gris) » : les pixels classés bâtis en 2016, posés par-dessus.

**Comment lire le résultat**

- Le gris recouvre le rouge partout où c'était déjà bâti en 2016. **Le rouge qui reste visible est donc ce qui a été construit entre 2016 et 2025.**
- Décochez les deux couches « Bâti » pour voir la probabilité seule : le cœur des quartiers denses est très clair, les franges et les routes sont dans des teintes intermédiaires. Le modèle hésite là où le pixel de 10 m mélange toit, cour et végétation.
- Passer de la probabilité (une nuance) au bâti (oui ou non) demande un seuil : ici `SEUIL_BATI = 0.5`. C'est un choix, pas une vérité. Vous le ferez varier dans l'exercice 2.

**À retenir.** `.selfMask()` rend transparents les pixels qui valent 0 : on ne colore que le bâti et on voit le reste à travers.

**Vérifiez.** Comparez avec l'image Sentinel-2 de 2025 (décochez les couches du dessus). Trouvez un endroit où le modèle se trompe : une plage, une carrière ou un sol nu classé bâti, ou au contraire des maisons isolées non détectées.

## Étape 4 — L'année de construction de chaque pixel

L'étape 3 compare deux dates. Ici on utilise les dix années pour dater chaque pixel : depuis quelle année est-il bâti sans interruption ?

```javascript
// ===== ÉTAPE 4 — L'ANNÉE DE CONSTRUCTION DE CHAQUE PIXEL =====================
// On part de la dernière année et on remonte le temps : tant que le pixel est
// bâti sans interruption, on recule sa date.
var encoreBati = ee.Image(1);
var anneeBati = ee.Image(0);
for (var i = ANNEES.length - 1; i >= 0; i--) {
  encoreBati = encoreBati.and(bati(ANNEES[i]).unmask(0));
  anneeBati = anneeBati.where(encoreBati, ANNEES[i]);
}
anneeBati = anneeBati.selfMask().clip(ZONE).rename('annee');

// Mise en couleurs : gris pour le bâti déjà présent au début, dégradé pour le reste
var PALETTE_ANNEES = ['ffffb2', 'fed976', 'feb24c', 'fd8d3c', 'fc4e2a', 'e31a1c', 'bd0026', '800026', '4a1486'];
var carteAnnees = ee.ImageCollection([
  anneeBati.updateMask(anneeBati.eq(ANNEE_DEBUT)).visualize({min: 0, max: 1, palette: ['9e9e9e']}),
  anneeBati.updateMask(anneeBati.gt(ANNEE_DEBUT))
           .visualize({min: ANNEE_DEBUT + 1, max: ANNEE_FIN, palette: PALETTE_ANNEES})
]).mosaic();

Map.addLayer(carteAnnees, {}, 'Année de construction');

// La légende (on en fait une fonction pour la réutiliser à l'étape 10)
function legendeAnnees() {
  return ui.Panel([
    ui.Label('■ déjà bâti en ' + ANNEE_DEBUT, {color: '#9e9e9e', fontSize: '13px', margin: '4px 4px 0 8px'}),
    ui.Label(String(ANNEE_DEBUT + 1), {fontSize: '12px', margin: '5px 4px 0 12px'}),
    ui.Thumbnail({image: ee.Image.pixelLonLat().select(0),
                  params: {bbox: [0, 0, 1, 0.1], dimensions: '120x12', format: 'png',
                           min: 0, max: 1, palette: PALETTE_ANNEES},
                  style: {margin: '6px 2px 0 2px', width: '120px', height: '12px'}}),
    ui.Label(String(ANNEE_FIN), {fontSize: '12px', margin: '5px 0 0 4px'})
  ], ui.Panel.Layout.flow('horizontal'));
}
var legende = legendeAnnees();
legende.style().set({position: 'bottom-left', padding: '4px 8px'});
Map.add(legende);
```

**Ce qui s'affiche**

- Une nouvelle couche « Année de construction ». Elle demande dix années de données : laissez-lui quelques secondes de plus que les autres.
- En bas à gauche de la carte, une légende : un carré gris, puis un dégradé du jaune pâle (2017) au violet (2025).

**Comment lire le résultat**

| Couleur | Signification |
| --- | --- |
| Gris | Déjà bâti en 2016, et bâti toutes les années depuis |
| Jaune pâle à orange | Construit au début de la période (2017 à 2020) |
| Rouge à bordeaux | Construit en milieu et fin de période (2021 à 2024) |
| Violet | Construit la dernière année (2025) |
| Pas de couleur | Non bâti en 2025 |

- Un lotissement apparaît comme une tache d'une ou deux couleurs voisines : il a été construit en un ou deux ans. Un front d'urbanisation qui avance se lit comme un dégradé du jaune vers le violet.
- La règle de bon sens derrière le calcul : une zone bâtie le reste. On part de 2025 et on remonte le temps ; tant que le pixel est bâti, on recule sa date. Un pixel détecté bâti une seule année puis redevenu « non bâti » (fausse alerte) est ainsi écarté.
- Conséquence à garder en tête : la date affichée est celle où le modèle voit du bâti de façon stable. Un terrassement ou un chantier peut être daté un an avant la construction réelle.

**Vérifiez.** Dans quelles directions la commune s'étend-elle ? Le long de quels axes ? Repérez un secteur entièrement violet ou bordeaux : vous le retrouverez aux étapes suivantes.

## Étape 5 — Les chiffres : surface bâtie par année

La carte montre où ; il reste à dire combien. On additionne la surface des pixels de chaque couleur de la carte de l'étape 4.

```javascript
// ===== ÉTAPE 5 — LES CHIFFRES : SURFACE BÂTIE PAR ANNÉE ======================
// Surface (en hectares) de chaque « année de construction »
var surfaceParAnnee = ee.Image.pixelArea().divide(10000).addBands(anneeBati).reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'annee'}),
  geometry: ZONE, scale: 10, maxPixels: 1e10, tileScale: 4
});

// Transforme le résultat brut en phrases et en graphiques (réutilisé à l'étape 11)
function chiffres(resultat) {
  var surface = {};
  (resultat.groups || []).forEach(function(g) { surface[g.annee] = g.sum; });

  var cumul = surface[ANNEE_DEBUT] || 0;
  var depart = cumul;
  var tableCumul = [['Année', 'Surface bâtie (ha)']];
  var tableNouveau = [['Année', 'Nouveau bâti (ha)']];
  ANNEES.forEach(function(annee) {
    if (annee > ANNEE_DEBUT) {
      var nouveau = surface[annee] || 0;
      cumul += nouveau;
      tableNouveau.push([String(annee), nouveau]);
    }
    tableCumul.push([String(annee), cumul]);
  });
  var gain = cumul - depart;
  var duree = ANNEE_FIN - ANNEE_DEBUT;

  return {
    phrases: [
      'Bâti en ' + ANNEE_DEBUT + ' : ' + depart.toFixed(0) + ' ha',
      'Bâti en ' + ANNEE_FIN + ' : ' + cumul.toFixed(0) + ' ha',
      'Gain : + ' + gain.toFixed(0) + ' ha' +
          (depart > 0 ? ' (+ ' + (100 * gain / depart).toFixed(0) + ' %)' : ''),
      'Rythme moyen : ' + (gain / duree).toFixed(0) + ' ha par an, soit ' +
          (gain / duree / 0.714 / 365).toFixed(1) + ' terrain(s) de football par jour'
    ],
    graphiques: [
      ui.Chart(tableCumul, 'AreaChart', {
        title: 'Surface bâtie cumulée (ha)', legend: {position: 'none'}, colors: ['c4281b'],
        vAxis: {viewWindow: {min: 0}}, height: 220
      }),
      ui.Chart(tableNouveau, 'ColumnChart', {
        title: 'Nouveau bâti par année (ha)', legend: {position: 'none'}, colors: ['fd8d3c'], height: 220
      })
    ]
  };
}

// Lancement du calcul ; le résultat s'affiche dans la console dès qu'il est prêt
surfaceParAnnee.evaluate(function(resultat, erreur) {
  if (!resultat) { print('Calcul impossible : ' + erreur); return; }
  var c = chiffres(resultat);
  print('——— LES CHIFFRES DE ' + NOM_COMMUNE.toUpperCase() + ' ———');
  c.phrases.forEach(function(phrase) { print(phrase); });
  c.graphiques.forEach(function(graphique) { print(graphique); });
});
```

**Ce qui s'affiche**

Rien de nouveau sur la carte : tout se passe dans la Console. Le calcul parcourt tous les pixels de la zone et peut prendre jusqu'à une minute ; le résultat arrive donc après les autres lignes, en bas de la Console :

- quatre lignes de chiffres clés : la surface bâtie en 2016, celle de 2025, le gain en hectares et en pourcentage, et le rythme moyen ;
- un graphique en aire, « Surface bâtie cumulée (ha) » ;
- un graphique en colonnes, « Nouveau bâti par année (ha) ».

**Comment lire le résultat**

- Le graphique en aire donne le stock : la surface totale bâtie à la fin de chaque année. Sa pente indique la vitesse ; une pente qui se redresse signale une accélération.
- Le graphique en colonnes donne le flux : ce qui s'est ajouté chaque année. La colonne la plus haute est l'année où l'on a le plus construit.
- Le rythme en « terrains de football par jour » traduit les hectares en une image parlante : un terrain fait environ 0,7 ha.
- Ces chiffres sont des ordres de grandeur. Ils comptent des pixels de 10 m classés bâtis, voirie et cours comprises, et ils dépendent du seuil choisi à l'étape 1. Ce n'est pas une emprise au sol cadastrale.
- Survolez un graphique : la valeur de chaque année s'affiche. Le bouton en haut à droite du graphique l'ouvre dans un nouvel onglet, d'où vous pouvez télécharger les données en CSV ou l'image en PNG.

**Vérifiez.** Quelle année a vu le plus de constructions ? La colonne de cette année correspond-elle à la couleur dominante de la carte de l'étape 4 ?

## Étape 6 — L'historique d'un point, au clic

Une carte et des totaux ne disent pas pourquoi un pixel a reçu telle date. Ici, chaque clic sur la carte affiche l'histoire complète du point : toutes les valeurs de probabilité de bâti, image après image, de 2016 à 2025.

```javascript
// ===== ÉTAPE 6 — L'HISTORIQUE D'UN POINT, AU CLIC ============================
// Le graphique : la probabilité de bâti du point, image après image
function graphiquePoint(point) {
  return ui.Chart.image.series({
    imageCollection: DW.filterBounds(point).filterDate(ANNEE_DEBUT + '-01-01', (ANNEE_FIN + 1) + '-01-01')
                       .select('built'),
    region: point, reducer: ee.Reducer.mean(), scale: 10
  }).setChartType('ScatterChart').setOptions({
    title: 'Probabilité de bâti au point cliqué',
    legend: {position: 'none'}, pointSize: 2, colors: ['c4281b'],
    vAxis: {viewWindow: {min: 0, max: 1}}, height: 220
  });
}

// Le verdict : lit la carte de l'étape 4 au point cliqué, puis appelle « suite » avec une phrase
function verdictPoint(point, suite) {
  anneeBati.unmask(0).reduceRegion({reducer: ee.Reducer.first(), geometry: point, scale: 10})
    .get('annee').evaluate(function(annee) {
      if (!annee) {
        suite('Ce point n\'est pas classé comme bâti en ' + ANNEE_FIN + '.');
      } else if (annee === ANNEE_DEBUT) {
        suite('Ce point était déjà bâti en ' + ANNEE_DEBUT + '.');
      } else {
        suite('Ce point est bâti sans interruption depuis ' + annee + '.');
      }
    });
}

// À chaque clic sur la carte : on marque le point et on affiche son historique dans la console
var couchePoint = null;
Map.style().set('cursor', 'crosshair');
Map.onClick(function(coordonnees) {
  var point = ee.Geometry.Point([coordonnees.lon, coordonnees.lat]);
  if (couchePoint !== null) { Map.remove(couchePoint); }
  couchePoint = Map.addLayer(point, {color: '00e5ff'}, 'Point cliqué');
  print('——— Point cliqué : ' + coordonnees.lon.toFixed(4) + ' ; ' + coordonnees.lat.toFixed(4) + ' ———');
  verdictPoint(point, function(phrase) { print(phrase); });
  print(graphiquePoint(point));
});
```

**Ce qui s'affiche**

Après « Run », rien ne change, sauf le curseur de la souris qui devient une croix sur la carte. Restez sur l'onglet « Console » et cliquez sur la carte. À chaque clic :

- un point bleu clair marque l'endroit cliqué ;
- la Console affiche les coordonnées, puis un nuage de points rouges (une valeur par image Sentinel-2, soit plusieurs centaines), puis une phrase de verdict : « déjà bâti en 2016 », « bâti sans interruption depuis telle année » ou « pas classé comme bâti en 2025 ».

**Comment lire le résultat**

Cliquez successivement sur trois endroits et comparez les trois graphiques :

| Où cliquer | Forme attendue du nuage de points |
| --- | --- |
| Un quartier ancien (gris) | Points groupés en haut, près de 1, sur toute la période |
| Un champ | Points groupés en bas, près de 0, sur toute la période |
| Un lotissement récent (rouge ou violet) | Une marche d'escalier : en bas, puis une montée, puis en haut |

- La date de la marche d'escalier est la date de construction vue par le satellite. Elle doit correspondre à l'année du verdict, à un an près.
- Le nuage n'est jamais une ligne nette : d'une image à l'autre, la probabilité varie avec la saison, la lumière, la brume. C'est pour cela que l'étape 3 travaille sur la moyenne annuelle et non sur une image isolée.
- Un point isolé très haut ou très bas au milieu des autres est une image perturbée (nuage mal filtré, ombre), pas un événement réel.

**Vérifiez.** Cliquez sur le secteur violet ou bordeaux repéré à l'étape 4. Voyez-vous la marche d'escalier ? Trouvez ensuite un point dont le nuage monte puis redescend : que s'est-il passé à cet endroit ?

## Étape 7 — Le radar Sentinel-1 en trois dates

Jusqu'ici tout repose sur un seul capteur (Sentinel-2) et un seul modèle (Dynamic World). On cherche une confirmation indépendante avec le radar Sentinel-1, qui voit de jour comme de nuit et à travers les nuages.

```javascript
// ===== ÉTAPE 7 — LE RADAR SENTINEL-1 EN TROIS DATES ==========================
var S1 = ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(ZONE)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');
var VIS_RADAR = {min: -20, max: 0};

// Rétrodiffusion radar médiane sur l'année
function radar(annee) {
  return S1.filterDate(annee + '-01-01', (annee + 1) + '-01-01').median();
}

// Rouge = dernière année, vert = année du milieu, bleu = première année
var radarTroisDates = ee.Image.cat([radar(ANNEE_FIN), radar(ANNEE_MILIEU), radar(ANNEE_DEBUT)])
  .rename(['fin', 'milieu', 'debut']).clip(ZONE);

Map.addLayer(radarTroisDates, VIS_RADAR,
             'Radar : rouge ' + ANNEE_FIN + ', vert ' + ANNEE_MILIEU + ', bleu ' + ANNEE_DEBUT);
```

**Ce qui s'affiche**

Une nouvelle couche d'aspect granuleux, majoritairement en nuances de gris, avec des taches colorées. Ce n'est pas une photographie : chaque canal de couleur est l'image radar d'une année différente (rouge = 2025, vert = 2021, bleu = 2016).

**Comment lire le résultat**

Un bâtiment renvoie fortement le signal radar : ses murs et le sol forment des angles droits qui réfléchissent l'onde vers le satellite. Un champ ou une surface lisse en renvoie peu. La couleur d'un pixel dit donc à quelles dates le signal était fort :

| Couleur | Signal fort en… | Interprétation |
| --- | --- | --- |
| Blanc ou gris clair | 2016, 2021 et 2025 | Bâti ancien |
| Jaune | 2021 et 2025 | Construit en première période (2016 à 2021) |
| Rouge | 2025 seulement | Construit récemment (2021 à 2025) |
| Bleu | 2016 seulement | Disparu ou transformé |
| Gris sombre ou noir | Aucune date | Sol nu lisse, eau calme, route |

- Les teintes pâles et changeantes dans les champs ne sont pas des constructions : le signal radar d'une parcelle agricole varie avec l'humidité du sol et le stade de la culture.
- La mer change de couleur selon l'état des vagues aux trois dates : ignorez-la.
- Le radar et Dynamic World se trompent pour des raisons différentes. Quand les deux désignent le même secteur, l'indice est solide ; quand ils divergent, c'est un endroit à regarder de près.

**Vérifiez.** Affichez tour à tour cette couche et « Année de construction » (cochez et décochez dans « Layers »). Les taches rouges et jaunes du radar tombent-elles sur les quartiers datés par l'étape 4 ? Trouvez un endroit où les deux ne racontent pas la même histoire.

## Étape 8 — L'animation de l'étalement urbain

On réunit l'image Sentinel-2 de chaque année (étape 2) et la carte des années de construction (étape 4) dans un film : une image par an, avec en rouge tout ce qui a été construit depuis 2016.

```javascript
// ===== ÉTAPE 8 — L'ANIMATION DE L'ÉTALEMENT URBAIN ===========================
// Le bâti apparu entre le début et une année donnée
function nouveauBatiJusqua(annee) {
  return anneeBati.gt(ANNEE_DEBUT).and(anneeBati.lte(annee)).selfMask();
}
// L'image Sentinel-2 de l'année, avec ce nouveau bâti en rouge par-dessus
function imageAvecNouveauBati(annee) {
  return imageS2(annee).visualize(VIS_S2)
    .blend(nouveauBatiJusqua(annee).visualize({palette: ['ff1744'], opacity: 0.7}));
}

Map.addLayer(imageAvecNouveauBati(ANNEE_FIN), {}, 'Image + nouveau bâti ' + ANNEE_DEBUT + ' → ' + ANNEE_FIN);

// Une image par an, avec une barre de progression jaune en bas
var trames = ANNEES.map(function(annee) {
  var avancement = (annee - ANNEE_DEBUT + 1) / ANNEES.length;
  var barre = ee.Geometry.Rectangle([EMPRISE[0], EMPRISE[1],
                                     EMPRISE[0] + (EMPRISE[2] - EMPRISE[0]) * avancement,
                                     EMPRISE[1] + (EMPRISE[3] - EMPRISE[1]) * 0.025]);
  var barreImage = ee.Image().byte().paint(ee.FeatureCollection([ee.Feature(barre)]), 1)
                     .visualize({palette: ['ffd600']});
  return imageAvecNouveauBati(annee).blend(barreImage);
});
var animation = ee.ImageCollection.fromImages(trames);
var PARAMS_GIF = {region: ZONE, dimensions: 600, framesPerSecond: 1.5, crs: 'EPSG:3857'};

// Le lien de téléchargement (une fonction, pour le réutiliser à l'étape 11)
function lienAnimation() {
  var lien = ui.Label('Préparation du lien de téléchargement…', {fontSize: '13px', margin: '2px 8px'});
  animation.getVideoThumbURL(PARAMS_GIF, function(url, erreur) {
    if (url) {
      lien.setValue('Télécharger l\'animation (GIF)');
      lien.setUrl(url);
    } else {
      lien.setValue('Lien indisponible : ' + erreur);
    }
  });
  return lien;
}

print('——— L\'ANIMATION ———');
print(ui.Thumbnail({image: animation, params: PARAMS_GIF, style: {width: '385px'}}));
print(lienAnimation());
```

**Ce qui s'affiche**

- Sur la carte : une couche « Image + nouveau bâti 2016 → 2025 », c'est-à-dire l'image de 2025 avec en rouge translucide tout ce qui a été construit depuis 2016.
- Dans la Console, après une attente qui peut atteindre une minute : une animation qui tourne en boucle, puis un lien « Télécharger l'animation (GIF) ».

**Comment lire le résultat**

- Chaque image de l'animation dure moins d'une seconde et correspond à une année. La barre jaune en bas indique l'avancement : courte en 2016, pleine largeur en 2025.
- Le fond change à chaque image : c'est l'image Sentinel-2 de l'année. Le rouge ne fait que s'étendre : il cumule tout le bâti apparu depuis 2016.
- La première image n'a pas de rouge : 2016 est l'état de départ.
- Regardez l'animation plusieurs fois en fixant à chaque fois un secteur différent. On y voit ce que la carte fixe de l'étape 4 ne montre pas : l'ordre dans lequel les quartiers se remplissent.
- Le lien ouvre le GIF dans un nouvel onglet ; un clic droit puis « Enregistrer l'image sous » le télécharge. Il s'insère tel quel dans une présentation.

**Vérifiez.** L'urbanisation progresse-t-elle par extension continue depuis le centre, ou par lotissements isolés qui se rejoignent ensuite ?

## Étape 9 — L'export vers QGIS ou ArcGIS

La carte des années de construction ne doit pas rester dans le navigateur. On l'exporte en GeoTIFF pour la superposer au cadastre ou aux autorisations de construire dans un SIG.

```javascript
// ===== ÉTAPE 9 — L'EXPORT VERS QGIS OU ARCGIS ================================
// Une tâche apparaît dans l'onglet « Tasks » : cliquez sur « RUN » pour envoyer
// le fichier GeoTIFF dans votre Google Drive. Valeur 0 = non bâti.
Export.image.toDrive({
  image: anneeBati.unmask(0).toShort(),
  description: 'annee_construction_' + NOM_COMMUNE.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  region: ZONE, scale: 10, maxPixels: 1e10
});
```

**Ce qui s'affiche**

Rien sur la carte ni dans la Console. L'onglet « Tasks » (à côté de « Console ») se colore en orange : une tâche nommée `annee_construction_dar_bouazza` y attend.

**Ce que vous devez faire**

1. Ouvrez l'onglet « Tasks » et cliquez sur « RUN » à droite de la tâche.
2. Dans la fenêtre qui s'ouvre, gardez les réglages proposés et cliquez de nouveau sur « RUN ».
3. Attendez une à quelques minutes : la tâche passe au bleu une fois terminée. Le fichier `.tif` est alors à la racine de votre Google Drive.

**Comment lire le résultat**

- Le fichier contient une seule bande. Chaque pixel de 10 m porte un nombre : 0 pour le non bâti, 2016 pour le bâti déjà présent au départ, puis 2017 à 2025 pour l'année de construction.
- Dans QGIS, il s'affiche d'abord en nuances de gris presque uniformes. Choisissez un rendu « Palette / Valeurs uniques » et rendez la valeur 0 transparente pour retrouver la carte de l'étape 4.
- Une tâche est recréée à chaque « Run » du script. Inutile de la relancer à chaque fois : cliquez sur « RUN » dans « Tasks » seulement quand vous voulez un nouveau fichier.

**Vérifiez.** La tâche est-elle bien passée au bleu ? Vous pouvez poursuivre le TP pendant que l'export tourne.

## Étape 10 — L'application : rideau avant / après

Vous avez maintenant toutes les pièces. Il reste à les présenter à quelqu'un qui ne lira jamais le code : un élu, un chef de service, un agent de terrain. Ce bloc remplace l'écran habituel par une application : deux cartes séparées par un rideau, et un panneau de commandes.

```javascript
// ===== ÉTAPE 10 — L'APPLICATION : RIDEAU AVANT / APRÈS =======================
// On remplace la carte habituelle par deux cartes séparées par un rideau,
// et un panneau de commandes à gauche.
ui.root.clear();

var carteG = ui.Map();
var carteD = ui.Map();
[carteG, carteD].forEach(function(carte) {
  carte.setOptions('SATELLITE');
  carte.setControlVisibility({layerList: false, mapTypeControl: false,
                              fullscreenControl: false, drawingToolsControl: false});
  carte.style().set('cursor', 'crosshair');
});
ui.Map.Linker([carteG, carteD]);
carteG.centerObject(ZONE, 13);

var rideau = ui.SplitPanel({firstPanel: carteG, secondPanel: carteD,
                            orientation: 'horizontal', wipe: true, style: {stretch: 'both'}});
var panneau = ui.Panel({style: {width: '420px', padding: '8px'}});
ui.root.add(panneau);
ui.root.add(rideau);

// Étiquettes posées sur les cartes
var STYLE_ETIQUETTE = {fontWeight: 'bold', fontSize: '15px', padding: '4px 8px',
                       backgroundColor: 'rgba(255,255,255,0.85)'};
var etiquetteG = ui.Label('', STYLE_ETIQUETTE);
var etiquetteD = ui.Label('', STYLE_ETIQUETTE);
etiquetteG.style().set('position', 'bottom-left');
etiquetteD.style().set('position', 'bottom-right');
carteG.add(etiquetteG);
carteD.add(etiquetteD);

// Les couches de chaque carte : 0 = couche principale, 1 = contour, 2 = point cliqué
[carteG, carteD].forEach(function(carte) {
  carte.layers().set(0, ui.Map.Layer(ee.Image().byte(), {}, 'Couche principale'));
  carte.layers().set(1, ui.Map.Layer(contour, {palette: ['00e5ff']}, 'Zone d\'étude'));
  carte.layers().set(2, ui.Map.Layer(ee.FeatureCollection([]), {}, 'Point cliqué'));
});

// Les couches proposées pour la carte de droite : tout ce que vous avez construit
var C_IMAGE = 'Image Sentinel-2';
var C_NOUVEAU = 'Image + nouveau bâti en rouge';
var C_ANNEES = 'Année de construction';
var C_RADAR = 'Radar Sentinel-1 en trois dates';
var C_PROBA = 'Probabilité de bâti';

function majGauche() {
  var annee = curseurG.getValue();
  carteG.layers().set(0, ui.Map.Layer(imageS2(annee), VIS_S2, 'Sentinel-2 ' + annee));
  etiquetteG.setValue('Sentinel-2 · ' + annee);
}

function majDroite() {
  var type = choixCouche.getValue();
  var annee = curseurD.getValue();
  var couche, libelle;
  if (type === C_IMAGE) {
    couche = ui.Map.Layer(imageS2(annee), VIS_S2, type);
    libelle = 'Sentinel-2 · ' + annee;
  } else if (type === C_NOUVEAU) {
    couche = ui.Map.Layer(imageAvecNouveauBati(annee), {}, type);
    libelle = 'Nouveau bâti ' + ANNEE_DEBUT + ' → ' + annee;
  } else if (type === C_ANNEES) {
    couche = ui.Map.Layer(carteAnnees, {}, type);
    libelle = 'Année de construction';
  } else if (type === C_RADAR) {
    couche = ui.Map.Layer(radarTroisDates, VIS_RADAR, type);
    libelle = 'Radar : rouge ' + ANNEE_FIN + ', vert ' + ANNEE_MILIEU + ', bleu ' + ANNEE_DEBUT;
  } else {
    couche = ui.Map.Layer(probaBati(annee), VIS_PROBA, type);
    libelle = 'Probabilité de bâti · ' + annee;
  }
  carteD.layers().set(0, couche);
  etiquetteD.setValue(libelle);
}

var curseurG = ui.Slider({min: ANNEE_DEBUT, max: ANNEE_FIN, value: ANNEE_DEBUT, step: 1,
                          style: {stretch: 'horizontal'}});
var curseurD = ui.Slider({min: ANNEE_DEBUT, max: ANNEE_FIN, value: ANNEE_FIN, step: 1,
                          style: {stretch: 'horizontal'}});
var choixCouche = ui.Select({items: [C_IMAGE, C_NOUVEAU, C_ANNEES, C_RADAR, C_PROBA], value: C_IMAGE,
                             style: {stretch: 'horizontal'}});
curseurG.onChange(ui.util.debounce(majGauche, 300));
curseurD.onChange(ui.util.debounce(majDroite, 300));
choixCouche.onChange(majDroite);

// Petits outils de mise en page
function titre(contenu) {
  return ui.Label(contenu, {fontWeight: 'bold', fontSize: '16px', margin: '14px 8px 4px 8px', color: '#14263a'});
}
function texte(contenu) {
  return ui.Label(contenu, {fontSize: '13px', margin: '2px 8px', whiteSpace: 'pre-wrap'});
}
function ligne(etiquette, widget) {
  return ui.Panel([ui.Label(etiquette, {fontSize: '13px', width: '110px', margin: '8px 0 0 8px'}), widget],
                  ui.Panel.Layout.flow('horizontal'), {stretch: 'horizontal'});
}

// Le contenu du panneau
panneau.add(ui.Label('L\'évolution du bâti vue par Sentinel',
                     {fontWeight: 'bold', fontSize: '21px', margin: '4px 8px', color: '#c4281b'}));
panneau.add(ui.Label(NOM_COMMUNE + ' · ' + ANNEE_DEBUT + ' – ' + ANNEE_FIN,
                     {fontSize: '14px', margin: '0 8px 6px 8px', color: '#555555'}));

panneau.add(titre('1. Avant / après : faites glisser le rideau'));
panneau.add(texte('La barre verticale au milieu des cartes se déplace à la souris. ' +
                  'À gauche l\'image de l\'année de départ, à droite celle de l\'année d\'arrivée.'));
panneau.add(ligne('Carte de gauche', curseurG));
panneau.add(ligne('Carte de droite', curseurD));

panneau.add(titre('2. Changez la couche de droite'));
panneau.add(texte('Essayez les couches une par une, en gardant l\'image Sentinel-2 à gauche pour comparer.'));
panneau.add(ligne('Couche', choixCouche));
panneau.add(texte('Légende de « Année de construction » :'));
panneau.add(legendeAnnees());
panneau.add(texte('Lecture du radar en trois dates : blanc = bâti ancien, rouge = construit récemment, ' +
                  'jaune = construit en première période, bleu = disparu ou transformé.'));

// État initial des deux cartes
majGauche();
majDroite();
```

**Ce qui s'affiche**

L'écran change complètement. La carte unique et son bouton « Layers » disparaissent, remplacés par :

- à gauche, un panneau de 420 pixels de large, avec un titre, deux curseurs d'année et une liste déroulante « Couche » ;
- à droite, deux cartes côte à côte, séparées par une barre verticale : Sentinel-2 2016 à gauche, Sentinel-2 2025 à droite. Une étiquette en bas de chaque carte rappelle ce qu'elle montre.

La Console continue d'afficher les résultats des étapes 5 et 8 : rien n'est perdu.

**Comment utiliser et lire le résultat**

- Attrapez la barre verticale à la souris et faites-la glisser : vous balayez la commune entre 2016 et 2025. Les deux cartes sont liées : zoomer ou déplacer l'une déplace l'autre.
- Les curseurs changent l'année de chaque côté. Mettez 2019 à gauche et 2021 à droite pour isoler ce qui s'est construit entre ces deux dates.
- La liste « Couche » affiche à droite, au choix, chacun des résultats des étapes 2, 3, 4, 7 et 8. Gardez Sentinel-2 à gauche : le rideau devient un outil de vérification, qui confronte chaque couche calculée à l'image réelle.
- Avec « Année de construction » et « Radar », le curseur de droite n'a pas d'effet : ces deux couches couvrent déjà toute la période.

**À retenir.** Ce bloc ne calcule rien de nouveau. Il appelle les fonctions des étapes précédentes (`imageS2`, `probaBati`, `imageAvecNouveauBati`…) quand vous bougez un curseur. C'est l'intérêt d'avoir écrit des recettes réutilisables.

**Vérifiez.** Choisissez « Année de construction » à droite, zoomez sur un quartier violet et balayez avec le rideau : l'image 2016 de gauche montre-t-elle bien un terrain non bâti à cet endroit ?

## Étape 11 — L'application complète

Dernier bloc : on range dans le panneau ce qui s'affichait jusqu'ici dans la Console (les chiffres, l'animation, l'historique au clic) et on ajoute un bouton qui fait défiler les années directement sur la carte.

```javascript
// ===== ÉTAPE 11 — L'APPLICATION COMPLÈTE =====================================
// --- L'animation sur la carte -------------------------------------------------
panneau.add(titre('3. Regardez la ville grandir'));
panneau.add(texte('Le bouton fait défiler les années sur la carte de droite, avec le nouveau bâti en rouge. ' +
                  'Laissez à chaque image le temps de se charger.'));
var minuterie = null;
var boutonLecture = ui.Button({label: '▶  Lancer l\'animation sur la carte', style: {stretch: 'horizontal'}});
function arreter() {
  if (minuterie !== null) { ui.util.clearTimeout(minuterie); minuterie = null; }
  boutonLecture.setLabel('▶  Lancer l\'animation sur la carte');
}
boutonLecture.onClick(function() {
  if (minuterie !== null) { arreter(); return; }
  choixCouche.setValue(C_NOUVEAU, false);
  curseurD.setValue(ANNEE_DEBUT, false);
  majDroite();
  boutonLecture.setLabel('■  Arrêter');
  minuterie = ui.util.setInterval(function() {
    var annee = curseurD.getValue();
    if (annee >= ANNEE_FIN) { arreter(); return; }
    curseurD.setValue(annee + 1, false);
    majDroite();
  }, 3500);
});
panneau.add(boutonLecture);

// --- Le GIF de l'étape 8 --------------------------------------------------------
panneau.add(titre('4. L\'animation à emporter'));
panneau.add(texte('Une image par an de ' + ANNEE_DEBUT + ' à ' + ANNEE_FIN + ', nouveau bâti en rouge. ' +
                  'La barre jaune indique l\'avancement. Le calcul peut prendre une minute.'));
panneau.add(ui.Thumbnail({image: animation, params: PARAMS_GIF,
                          style: {width: '385px', margin: '4px 8px'}}));
panneau.add(lienAnimation());

// --- Les chiffres de l'étape 5 --------------------------------------------------
panneau.add(titre('5. Les chiffres'));
var panneauChiffres = ui.Panel([texte('Calcul en cours, environ une minute…')]);
panneau.add(panneauChiffres);
surfaceParAnnee.evaluate(function(resultat, erreur) {
  panneauChiffres.clear();
  if (!resultat) {
    panneauChiffres.add(texte('Calcul impossible : ' + erreur));
    return;
  }
  var c = chiffres(resultat);
  c.phrases.forEach(function(phrase) {
    panneauChiffres.add(ui.Label(phrase, {fontWeight: 'bold', fontSize: '14px', margin: '3px 8px', color: '#c4281b'}));
  });
  c.graphiques.forEach(function(graphique) { panneauChiffres.add(graphique); });
});

// --- Le clic de l'étape 6 --------------------------------------------------------
panneau.add(titre('6. Cliquez sur la carte'));
panneau.add(texte('Cliquez sur un bâtiment récent, puis sur un champ, puis sur un quartier ancien. ' +
                  'Le graphique montre, image après image, la probabilité que ce point soit bâti.'));
var panneauClic = ui.Panel([texte('(aucun point cliqué)')]);
panneau.add(panneauClic);

function auClic(coordonnees) {
  var point = ee.Geometry.Point([coordonnees.lon, coordonnees.lat]);
  [carteG, carteD].forEach(function(carte) {
    carte.layers().set(2, ui.Map.Layer(point, {color: '00e5ff'}, 'Point cliqué'));
  });
  var verdict = ui.Label('Recherche de l\'année de construction…', {fontSize: '13px', margin: '2px 8px'});
  panneauClic.clear();
  panneauClic.add(verdict);
  panneauClic.add(graphiquePoint(point));
  verdictPoint(point, function(phrase) { verdict.setValue(phrase); });
}
carteG.onClick(auClic);
carteD.onClick(auClic);

// --- Les questions ------------------------------------------------------------------
panneau.add(titre('7. Export et questions'));
panneau.add(texte('Onglet « Tasks » à droite du code : cliquez sur RUN pour enregistrer la carte ' +
                  'des années de construction dans votre Google Drive.\n\n' +
                  'À discuter :\n' +
                  '• Dans quelles directions la commune s\'étend-elle ? Le long de quels axes ?\n' +
                  '• Quelle année a vu le plus de constructions ?\n' +
                  '• Trouvez une zone rouge qui n\'est pas une construction (chantier, carrière, sol nu).\n' +
                  '• Le radar et la carte des années racontent-ils la même histoire ?\n' +
                  '• Quel secteur iriez-vous contrôler en priorité dans le TP suivant ?'));
```

**Ce qui s'affiche**

Le panneau de gauche s'allonge : faites-le défiler vers le bas. Sous les rubriques 1 et 2 de l'étape précédente apparaissent cinq nouvelles rubriques :

| Rubrique du panneau | Contenu | Vient de |
| --- | --- | --- |
| 3. Regardez la ville grandir | Un bouton qui fait défiler les années sur la carte de droite | Nouveau |
| 4. L'animation à emporter | Le GIF et son lien de téléchargement | Étape 8 |
| 5. Les chiffres | Les quatre chiffres clés et les deux graphiques | Étape 5 |
| 6. Cliquez sur la carte | Le verdict et le graphique du point cliqué | Étape 6 |
| 7. Export et questions | Le rappel de l'export et les questions à discuter | Étape 9 |

**Comment utiliser et lire le résultat**

- Le bouton « Lancer l'animation sur la carte » avance d'une année toutes les 3,5 secondes, de 2016 à 2025. À la différence du GIF, vous pouvez zoomer sur un quartier avant de lancer, et arrêter quand vous voulez.
- Un clic sur l'une des deux cartes remplace le contenu de la rubrique 6 : le graphique et le verdict se lisent exactement comme à l'étape 6, mais restent à côté de la carte.
- Les chiffres et le GIF mettent jusqu'à une minute à apparaître : le message « Calcul en cours » est normal.
- Vous avez reconstruit, bloc par bloc, une application complète. Pour la partager sans montrer le code : bouton « Apps » en haut de l'éditeur, puis « NEW APP ».

**Vérifiez.** Lancez l'animation sur la carte après avoir zoomé sur le secteur qui vous paraît le plus dynamique. Quel secteur iriez-vous contrôler en priorité dans le TP suivant, et avec quels arguments tirés des étapes 4, 5, 6 et 7 ?

## À vous de jouer

Votre script est complet. Les exercices consistent à modifier quelques lignes, presque toutes dans le bloc de l'étape 1 tout en haut du script, puis à cliquer de nouveau sur « Run ».

**Exercice 1 — Changer de commune**

Dans le bloc de l'étape 1, remplacez `NOM_COMMUNE` et `EMPRISE`. Quelques emprises approximatives, à ajuster en regardant la carte :

| Commune | EMPRISE |
| --- | --- |
| Tamesna | `[-6.98, 33.79, -6.89, 33.86]` |
| Tamansourt | `[-8.14, 31.70, -8.04, 31.77]` |
| Bouskoura | `[-7.70, 33.42, -7.60, 33.49]` |

Pour une autre zone, gardez un rectangle de 5 à 15 km de côté. Pour lire des coordonnées, mettez provisoirement la ligne `ui.root.clear();` de l'étape 10 en commentaire (ajoutez `//` devant) afin de retrouver la carte simple, ouvrez l'onglet « Inspector » et cliquez sur deux coins opposés. Le rythme de construction est-il comparable à celui de Dar Bouazza ?

**Exercice 2 — Changer le seuil**

Passez `SEUIL_BATI` à 0.35, puis à 0.65. Que deviennent la surface bâtie et la carte des années de construction ? Quel seuil choisiriez-vous pour ne rater aucune construction ? Pour éviter les fausses alertes ?

**Exercice 3 — Changer la période**

Mettez `ANNEE_FIN` à 2026 pour inclure l'année en cours, qui est incomplète. Le résultat de la dernière année est-il aussi fiable que les autres ? Pourquoi ?

**Exercice 4 — Ajouter votre propre couche**

Collez ce douzième bloc tout en bas du script pour afficher la végétation (NDVI) de la dernière année sur la carte de droite, puis cliquez sur « Run » :

```javascript
// ===== EXERCICE 4 — LA VÉGÉTATION (NDVI) ====================================
var ndvi = imageS2(ANNEE_FIN).normalizedDifference(['B8', 'B4']);
carteD.layers().set(0, ui.Map.Layer(ndvi, {min: 0, max: 0.6, palette: ['ffffff', '1b7837']}, 'NDVI'));
etiquetteD.setValue('Végétation (NDVI) · ' + ANNEE_FIN);
```

La carte de droite passe en blanc (sol nu, bâti) et vert (végétation active). Remplacez `ANNEE_FIN` par `ANNEE_DEBUT` dans les trois lignes : les zones construites récemment étaient-elles des terres cultivées en 2016 ?

**Questions de synthèse**

- Dans quelles directions la commune s'étend-elle ? Le long de quels axes ?
- Quelle année a vu le plus de constructions ?
- Trouvez une zone rouge qui n'est pas une construction (chantier, carrière, sol nu).
- Le radar et la carte des années racontent-ils la même histoire ?
- Quel secteur iriez-vous contrôler en priorité dans le TP suivant ?

## D'où viennent les données

| Donnée | Nature | Résolution | Disponible depuis | Rôle dans le TP |
| --- | --- | --- | --- | --- |
| Sentinel-2 | Image optique | 10 m | 2015 | Les images en couleurs naturelles |
| Sentinel-1 | Image radar | 10 m | 2014 | La confirmation indépendante, de jour comme de nuit et à travers les nuages |
| Dynamic World | Classification par IA de chaque image Sentinel-2 | 10 m | 2015 | La probabilité de bâti par pixel |
