import { describe, it, expect } from 'vitest';
import { fusionnerAvecListeExistante } from '../../../src/modules/courses/domain/GenerateurListeCourses.js';

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
