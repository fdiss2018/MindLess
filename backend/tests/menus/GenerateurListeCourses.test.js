import { describe, it, expect } from 'vitest';
import {
  genererItemsDepuisPlanning, fusionnerAvecListeExistante,
} from '../../src/menus/domain/GenerateurListeCourses.js';

describe('genererItemsDepuisPlanning', () => {
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

    const items = genererItemsDepuisPlanning(planning, recettesParId);
    const farine = items.find((i) => i.nom === 'Farine');

    expect(farine.quantite).toBe(400); // deux créneaux liés à r1
    expect(farine.recetteIds).toEqual(['r1']);
  });

  it('ignore les créneaux en texte libre', () => {
    const planning = {
      jours: { lundi: { midi: { texte: 'Pizza', recetteId: null }, soir: { texte: null, recetteId: null } } },
    };
    expect(genererItemsDepuisPlanning(planning, recettesParId)).toEqual([]);
  });
});

describe('fusionnerAvecListeExistante', () => {
  it('crée un nouvel item quand il n\'existe pas encore', () => {
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Farine', unite: 'g', quantite: 200, recetteIds: ['r1'] }],
      [],
    );
    expect(itemsACreer).toHaveLength(1);
    expect(itemsAModifier).toHaveLength(0);
  });

  it('ne modifie jamais un item déjà coché', () => {
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Farine', unite: 'g', quantite: 200, recetteIds: ['r1'] }],
      [{ id: 'i1', nom: 'Farine', unite: 'g', quantite: 100, coche: true, origine: 'recette' }],
    );
    expect(itemsACreer).toHaveLength(0);
    expect(itemsAModifier).toHaveLength(0);
  });

  it('fait passer un item manuel en "mixte" en cumulant les quantités', () => {
    const { itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Farine', unite: 'g', quantite: 200, recetteIds: ['r1'] }],
      [{
        id: 'i1', nom: 'Farine', unite: 'g', quantite: 100, coche: false, origine: 'manuel', recetteIds: [],
      }],
    );
    expect(itemsAModifier[0]).toMatchObject({ id: 'i1', quantite: 300, origine: 'mixte' });
  });
});
