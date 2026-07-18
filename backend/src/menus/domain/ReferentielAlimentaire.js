// Classe un ingrédient dans l'un des 6 groupes alimentaires suivis par le
// bilan nutritionnel : legumes, fruits, feculents, legumineuses,
// proteinesAnimales, produitsLaitiers. Un ingrédient absent de cette table est
// classé "nonClasse" — il n'empêche pas le calcul du reste, il est juste
// exclu du décompte de portions (voir AnalyseNutritionnelleSemaine).
//
// portionReferenceG sert de seuil pour convertir une quantité exprimée en
// grammes/kilogrammes en nombre de portions (voir compterPortions). Pour les
// unités non convertibles (pièce, botte, cuillère...), une occurrence de
// l'ingrédient dans une recette compte pour 1 portion — approximation
// assumée du mode "portions par groupe" plutôt qu'un calcul nutritionnel
// précis par base de composition.
const NON_CLASSE = { groupe: 'nonClasse', portionReferenceG: null };

const REFERENTIEL = {
  // Légumes
  tomate: { groupe: 'legumes', portionReferenceG: 100 },
  'tomates cerises': { groupe: 'legumes', portionReferenceG: 100 },
  courgette: { groupe: 'legumes', portionReferenceG: 100 },
  aubergine: { groupe: 'legumes', portionReferenceG: 100 },
  poivron: { groupe: 'legumes', portionReferenceG: 100 },
  concombre: { groupe: 'legumes', portionReferenceG: 100 },
  'haricot vert': { groupe: 'legumes', portionReferenceG: 100 },
  'haricots verts': { groupe: 'legumes', portionReferenceG: 100 },
  'mais doux': { groupe: 'legumes', portionReferenceG: 100 },
  fenouil: { groupe: 'legumes', portionReferenceG: 100 },
  'oignon nouveau': { groupe: 'legumes', portionReferenceG: 80 },
  'ail nouveau': { groupe: 'legumes', portionReferenceG: 20 },
  laitue: { groupe: 'legumes', portionReferenceG: 80 },
  radis: { groupe: 'legumes', portionReferenceG: 80 },
  betterave: { groupe: 'legumes', portionReferenceG: 100 },
  blette: { groupe: 'legumes', portionReferenceG: 100 },
  carotte: { groupe: 'legumes', portionReferenceG: 100 },
  epinard: { groupe: 'legumes', portionReferenceG: 100 },
  brocoli: { groupe: 'legumes', portionReferenceG: 100 },

  // Fruits
  peche: { groupe: 'fruits', portionReferenceG: 100 },
  nectarine: { groupe: 'fruits', portionReferenceG: 100 },
  abricot: { groupe: 'fruits', portionReferenceG: 100 },
  prune: { groupe: 'fruits', portionReferenceG: 100 },
  mirabelle: { groupe: 'fruits', portionReferenceG: 100 },
  melon: { groupe: 'fruits', portionReferenceG: 150 },
  pasteque: { groupe: 'fruits', portionReferenceG: 150 },
  framboise: { groupe: 'fruits', portionReferenceG: 100 },
  myrtille: { groupe: 'fruits', portionReferenceG: 100 },
  groseille: { groupe: 'fruits', portionReferenceG: 100 },
  figue: { groupe: 'fruits', portionReferenceG: 100 },
  pomme: { groupe: 'fruits', portionReferenceG: 100 },
  banane: { groupe: 'fruits', portionReferenceG: 100 },
  citron: { groupe: 'fruits', portionReferenceG: 50 },

  // Féculents
  'pates completes': { groupe: 'feculents', portionReferenceG: 150 },
  pates: { groupe: 'feculents', portionReferenceG: 150 },
  riz: { groupe: 'feculents', portionReferenceG: 150 },
  'riz basmati': { groupe: 'feculents', portionReferenceG: 150 },
  'riz semi-complet': { groupe: 'feculents', portionReferenceG: 150 },
  semoule: { groupe: 'feculents', portionReferenceG: 150 },
  'semoule complete': { groupe: 'feculents', portionReferenceG: 150 },
  boulgour: { groupe: 'feculents', portionReferenceG: 150 },
  quinoa: { groupe: 'feculents', portionReferenceG: 150 },
  'pomme de terre': { groupe: 'feculents', portionReferenceG: 150 },
  'pommes de terre': { groupe: 'feculents', portionReferenceG: 150 },
  'pommes de terre nouvelles': { groupe: 'feculents', portionReferenceG: 150 },
  'pain complet': { groupe: 'feculents', portionReferenceG: 80 },
  pain: { groupe: 'feculents', portionReferenceG: 80 },

  // Légumineuses
  'lentilles vertes': { groupe: 'legumineuses', portionReferenceG: 150 },
  lentilles: { groupe: 'legumineuses', portionReferenceG: 150 },
  'pois chiches': { groupe: 'legumineuses', portionReferenceG: 150 },
  'pois chiches cuits': { groupe: 'legumineuses', portionReferenceG: 150 },
  'haricots rouges': { groupe: 'legumineuses', portionReferenceG: 150 },
  'haricots rouges cuits': { groupe: 'legumineuses', portionReferenceG: 150 },
  houmous: { groupe: 'legumineuses', portionReferenceG: 100 },

  // Protéines animales
  poulet: { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'hauts de cuisse de poulet': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'blancs de poulet': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  dorade: { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'filets de dorade': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  thon: { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'thon au naturel': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  saumon: { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  oeuf: { groupe: 'proteinesAnimales', portionReferenceG: 60 },
  oeufs: { groupe: 'proteinesAnimales', portionReferenceG: 60 },
  'steaks haches': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'steak hache': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'filet mignon de porc': { groupe: 'proteinesAnimales', portionReferenceG: 120 },
  'jambon blanc': { groupe: 'proteinesAnimales', portionReferenceG: 60 },
  'jambon cru': { groupe: 'proteinesAnimales', portionReferenceG: 40 },

  // Produits laitiers
  'yaourt nature': { groupe: 'produitsLaitiers', portionReferenceG: 125 },
  'yaourts nature': { groupe: 'produitsLaitiers', portionReferenceG: 125 },
  'fromage blanc': { groupe: 'produitsLaitiers', portionReferenceG: 125 },
  lait: { groupe: 'produitsLaitiers', portionReferenceG: 150 },
  'fromage de chevre': { groupe: 'produitsLaitiers', portionReferenceG: 30 },
  'fromage de chevre frais': { groupe: 'produitsLaitiers', portionReferenceG: 30 },
  feta: { groupe: 'produitsLaitiers', portionReferenceG: 30 },
  mozzarella: { groupe: 'produitsLaitiers', portionReferenceG: 30 },
  parmesan: { groupe: 'produitsLaitiers', portionReferenceG: 20 },
  emmental: { groupe: 'produitsLaitiers', portionReferenceG: 30 },
};

function normaliser(nom) {
  return (nom || '').trim().toLowerCase();
}

export function classerIngredient(nom) {
  return REFERENTIEL[normaliser(nom)] || NON_CLASSE;
}
