/*******************************************************************************
 * TP — L'ÉVOLUTION DU BÂTI VUE PAR SENTINEL — SCRIPT COMPLET (corrigé)
 * Ce fichier est la somme des 11 blocs du TP, dans l'ordre.
 * Google Earth Engine : code.earthengine.google.com
 ******************************************************************************/

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


// ===== ÉTAPE 9 — L'EXPORT VERS QGIS OU ARCGIS ================================
// Une tâche apparaît dans l'onglet « Tasks » : cliquez sur « RUN » pour envoyer
// le fichier GeoTIFF dans votre Google Drive. Valeur 0 = non bâti.
Export.image.toDrive({
  image: anneeBati.unmask(0).toShort(),
  description: 'annee_construction_' + NOM_COMMUNE.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  region: ZONE, scale: 10, maxPixels: 1e10
});


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
