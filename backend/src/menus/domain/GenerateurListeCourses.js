// Copie assumée de public/utils/GenerateurListeCourses.js (pas de
// monorepo/package partagé entre front et backend) — la génération de la
// liste de courses se fait désormais côté serveur (voir routes/listeCourses.js).
function normaliserCle(nom, unite) {
  return `${(nom || '').trim().toLowerCase()}::${(unite || '').trim().toLowerCase()}`;
}

// Agrège les ingrédients de toutes les recettes liées au planning d'une semaine.
// Ne prend en compte que les créneaux liés à une recette (recetteId) — un créneau
// texte libre n'est pas transformé en article de courses.
export function genererItemsDepuisPlanning(planning, recettesParId) {
  const parCle = new Map();

  Object.values(planning.jours).forEach((jour) => {
    Object.values(jour).forEach((creneau) => {
      if (!creneau.recetteId) return;
      const recette = recettesParId[creneau.recetteId];
      if (!recette) return;

      recette.ingredients.forEach((ingredient) => {
        const cle = normaliserCle(ingredient.nom, ingredient.unite);
        if (!parCle.has(cle)) {
          parCle.set(cle, {
            nom: ingredient.nom.trim(),
            unite: (ingredient.unite || '').trim(),
            quantite: 0,
            recetteIds: new Set(),
          });
        }
        const entree = parCle.get(cle);
        entree.quantite += ingredient.quantite || 0;
        entree.recetteIds.add(recette.id);
      });
    });
  });

  return [...parCle.values()].map((e) => ({
    nom: e.nom, unite: e.unite, quantite: e.quantite, recetteIds: [...e.recetteIds],
  }));
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
