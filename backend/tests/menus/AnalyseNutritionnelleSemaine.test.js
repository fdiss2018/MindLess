import { describe, it, expect } from 'vitest';
import { calculerPortionsConsommees, comparerBilanSemaine } from '../../src/menus/domain/AnalyseNutritionnelleSemaine.js';

function planningAvec(jours) {
  return { jours };
}

describe('calculerPortionsConsommees', () => {
  const recette = {
    id: 'r1',
    portions: 4,
    ingredients: [
      { nom: 'tomate', quantite: 400, unite: 'g' }, // 400/100 = 4 portions totales -> 1/personne
      { nom: 'poulet', quantite: 480, unite: 'g' }, // 480/120 = 4 portions totales -> 1/personne
      { nom: 'seitan', quantite: 200, unite: 'g' }, // non classé, ignoré
    ],
  };
  const recettesParId = { r1: recette };

  it('agrège les portions par groupe sur toute la semaine, ramenées à 1 part', () => {
    const planning = planningAvec({
      lundi: { midi: { texte: null, recetteId: 'r1' }, soir: { texte: 'Pizza maison', recetteId: null } },
      mardi: { midi: { texte: null, recetteId: null }, soir: { texte: null, recetteId: 'r1' } },
    });

    const resultat = calculerPortionsConsommees(planning, recettesParId);

    expect(resultat.portionsParGroupe.legumes).toBeCloseTo(2);
    expect(resultat.portionsParGroupe.proteinesAnimales).toBeCloseTo(2);
    expect(resultat.repasNonEvalues).toBe(1);
  });

  it('compte 1 portion par occurrence pour une unité non convertible en grammes', () => {
    const recetteAvecPieces = {
      id: 'r2',
      portions: 2,
      ingredients: [{ nom: 'oeuf', quantite: 4, unite: 'pièce' }],
    };
    const planning = planningAvec({
      lundi: { midi: { texte: null, recetteId: 'r2' }, soir: { texte: null, recetteId: null } },
    });

    const resultat = calculerPortionsConsommees(planning, { r2: recetteAvecPieces });
    expect(resultat.portionsParGroupe.proteinesAnimales).toBeCloseTo(0.5); // 1 portion / 2 parts
  });

  it('ignore les créneaux dont la recette référencée est introuvable', () => {
    const planning = planningAvec({
      lundi: { midi: { texte: null, recetteId: 'inconnue' }, soir: { texte: null, recetteId: null } },
    });
    const resultat = calculerPortionsConsommees(planning, {});
    expect(resultat.portionsParGroupe.legumes).toBe(0);
    expect(resultat.repasNonEvalues).toBe(0);
  });
});

describe('comparerBilanSemaine', () => {
  it('marque un groupe comme couvert quand le réel atteint la cible', () => {
    const portionsConsommees = { portionsParGroupe: { legumes: 21, fruits: 5 } };
    const objectifs = { legumes: 21, fruits: 14, feculents: 14, legumineuses: 2, proteinesAnimales: 7, produitsLaitiers: 14 };

    const bilan = comparerBilanSemaine(portionsConsommees, objectifs);
    const legumes = bilan.find((b) => b.groupe === 'legumes');
    const fruits = bilan.find((b) => b.groupe === 'fruits');

    expect(legumes.couvert).toBe(true);
    expect(fruits.couvert).toBe(false);
  });
});
