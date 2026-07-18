import { describe, it, expect } from 'vitest';
import { classerIngredient } from '../../src/menus/domain/ReferentielAlimentaire.js';

describe('classerIngredient', () => {
  it('classe un ingrédient connu dans son groupe', () => {
    expect(classerIngredient('tomate')).toEqual({ groupe: 'legumes', portionReferenceG: 100 });
    expect(classerIngredient('lentilles vertes')).toEqual({ groupe: 'legumineuses', portionReferenceG: 150 });
  });

  it("n'est pas sensible à la casse ni aux espaces superflus", () => {
    expect(classerIngredient(' Tomate ')).toEqual({ groupe: 'legumes', portionReferenceG: 100 });
  });

  it('retombe sur "nonClasse" pour un ingrédient absent du référentiel', () => {
    expect(classerIngredient('seitan')).toEqual({ groupe: 'nonClasse', portionReferenceG: null });
  });
});
