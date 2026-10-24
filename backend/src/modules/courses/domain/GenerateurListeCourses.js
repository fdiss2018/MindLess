// Fusion des besoins en ingrédients d'une semaine (fournis par le module menus, voir
// modules/menus/api.js) avec la liste de courses existante — fonction pure, la route
// routes/listeCourses.js orchestre la lecture et l'écriture.
function normaliserCle(nom, unite) {
  return `${(nom || '').trim().toLowerCase()}::${(unite || '').trim().toLowerCase()}`;
}

// Fusionne les items générés depuis le planning avec la liste de courses existante,
// sans jamais écraser un item déjà coché ni supprimer un item devenu inutile.
// Retourne les écritures à effectuer, séparées entre créations et modifications.
export function fusionnerAvecListeExistante(itemsGeneres, itemsExistants) {
  const existantParCle = new Map();
  itemsExistants.forEach((item) => existantParCle.set(normaliserCle(item.nom, item.unite), item));

  const itemsACreer = [];
  const itemsAModifier = [];

  itemsGeneres.forEach((genere) => {
    const cle = normaliserCle(genere.nom, genere.unite);
    const existant = existantParCle.get(cle);

    if (!existant) {
      itemsACreer.push({
        nom: genere.nom,
        quantite: genere.quantite,
        unite: genere.unite,
        categorie: '',
        coche: false,
        origine: 'recette',
        recetteIds: genere.recetteIds,
      });
      return;
    }

    if (existant.coche) return; // un item déjà coché n'est jamais modifié

    if (existant.origine === 'recette') {
      itemsAModifier.push({
        id: existant.id,
        quantite: genere.quantite,
        recetteIds: genere.recetteIds,
      });
      return;
    }

    // origine 'manuel' ou 'mixte' : la quantité saisie manuellement est préservée,
    // le besoin de la recette s'y ajoute.
    const recetteIdsFusionnes = [...new Set([...(existant.recetteIds || []), ...genere.recetteIds])];
    itemsAModifier.push({
      id: existant.id,
      quantite: existant.quantite + genere.quantite,
      origine: 'mixte',
      recetteIds: recetteIdsFusionnes,
    });
  });

  return { itemsACreer, itemsAModifier };
}
