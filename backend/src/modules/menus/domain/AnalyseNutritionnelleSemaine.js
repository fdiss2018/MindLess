import { classerIngredient } from './ReferentielAlimentaire.js';

const GROUPES_SUIVIS = ['legumes', 'fruits', 'feculents', 'legumineuses', 'proteinesAnimales', 'produitsLaitiers'];

function portionsGrammage(quantite, unite, portionReferenceG) {
  // Normalisé (espaces + casse) : l'unité vient d'un champ texte libre saisi à la main
  // (recette-form.html), "Kg"/"G "/etc. ne doivent pas silencieusement retomber sur
  // l'approximation "1 portion" ci-dessous faute de correspondance exacte.
  const uniteNormalisee = (unite || '').trim().toLowerCase();
  if (uniteNormalisee === 'g') return quantite / portionReferenceG;
  if (uniteNormalisee === 'kg') return (quantite * 1000) / portionReferenceG;
  // Unité non convertible en grammes (pièce, botte, cuillère...) : une
  // occurrence de l'ingrédient dans la recette compte pour 1 portion —
  // approximation assumée du mode "portions par groupe".
  return 1;
}

// Agrège, sur toute la semaine, le nombre de portions par groupe alimentaire
// consommées par une part (1 personne) — ne prend en compte que les créneaux
// liés à une recette (recetteId), comme GenerateurListeCourses.js. Les
// créneaux en texte libre sont comptés à part (repasNonEvalues) plutôt que
// silencieusement ignorés.
export function calculerPortionsConsommees(planning, recettesParId) {
  const portionsParGroupe = Object.fromEntries(GROUPES_SUIVIS.map((g) => [g, 0]));
  let repasNonEvalues = 0;

  Object.values(planning.jours).forEach((jour) => {
    Object.values(jour).forEach((creneau) => {
      if (!creneau.recetteId) {
        if (creneau.texte) repasNonEvalues += 1;
        return;
      }

      const recette = recettesParId[creneau.recetteId];
      if (!recette) return;

      recette.ingredients.forEach((ingredient) => {
        const { groupe, portionReferenceG } = classerIngredient(ingredient.nom);
        if (groupe === 'nonClasse') return;

        const portionsTotales = portionsGrammage(ingredient.quantite, ingredient.unite, portionReferenceG);
        portionsParGroupe[groupe] += portionsTotales / recette.portions;
      });
    });
  });

  return { portionsParGroupe, repasNonEvalues };
}

// Compare les portions consommées (résultat de calculerPortionsConsommees)
// aux objectifs d'un profil (résultat de obtenirObjectifsSemaine).
export function comparerBilanSemaine(portionsConsommees, objectifs) {
  return GROUPES_SUIVIS.map((groupe) => {
    const reel = portionsConsommees.portionsParGroupe[groupe] || 0;
    const cible = objectifs[groupe];
    return {
      groupe, cible, reel: Math.round(reel * 10) / 10, couvert: reel >= cible,
    };
  });
}
