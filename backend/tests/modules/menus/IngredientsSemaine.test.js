import { describe, it, expect } from 'vitest';
import { agregerIngredientsSemaine } from '../../../src/modules/menus/domain/IngredientsSemaine.js';

describe('agregerIngredientsSemaine', () => {
  const recette = {
    id: 'r1',
    ingredients: [
      { nom: 'Farine', quantite: 200, unite: 'g' },
      { nom: 'Œufs', quantite: 2, unite: 'pièce' },
    ],
  };
  const recettesParId = { r1: recette };

  it('agrège les ingrédients des créneaux liés à une recette', () => {
    const planning = {
      jours: {
        lundi: { midi: { texte: null, recetteId: 'r1' }, soir: { texte: null, recetteId: null } },
        mardi: { midi: { texte: 'Pâtes', recetteId: null }, soir: { texte: null, recetteId: 'r1' } },
      },
    };

    const items = agregerIngredientsSemaine(planning, recettesParId);
    const farine = items.find((i) => i.nom === 'Farine');

    expect(farine.quantite).toBe(400); // deux créneaux liés à r1
    expect(farine.recetteIds).toEqual(['r1']);
  });

  it('ignore les créneaux en texte libre', () => {
    const planning = {
      jours: { lundi: { midi: { texte: 'Pizza', recetteId: null }, soir: { texte: null, recetteId: null } } },
    };
    expect(agregerIngredientsSemaine(planning, recettesParId)).toEqual([]);
  });
});
