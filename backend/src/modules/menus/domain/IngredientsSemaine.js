// Besoins en ingrédients d'une semaine de planning — exposés aux autres modules via ../api.js
// (consommé par le module courses pour générer la liste). Fusionne par nom + unité normalisés,
// sans conversion d'unité (farine/g et farine/kg restent deux entrées distinctes).
function normaliserCle(nom, unite) {
  return `${(nom || '').trim().toLowerCase()}::${(unite || '').trim().toLowerCase()}`;
}

// Agrège les ingrédients de toutes les recettes liées au planning d'une semaine.
// Ne prend en compte que les créneaux liés à une recette (recetteId) — un créneau
// texte libre n'est pas transformé en article de courses.
export function agregerIngredientsSemaine(planning, recettesParId) {
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
