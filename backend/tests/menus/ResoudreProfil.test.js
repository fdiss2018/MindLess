import { describe, it, expect } from 'vitest';
import { resoudreProfil } from '../../src/menus/domain/ResoudreProfil.js';

describe('resoudreProfil', () => {
  it('résout un homme adulte', () => {
    expect(resoudreProfil({ sexe: 'homme', anneeNaissance: 1981 })).toBe('adulte_homme');
  });

  it('résout une femme adulte', () => {
    expect(resoudreProfil({ sexe: 'femme', anneeNaissance: 1981 })).toBe('adulte_femme');
  });

  it('retombe sur le profil générique si le profil est absent', () => {
    expect(resoudreProfil(null)).toBe('adulte_generique');
    expect(resoudreProfil(undefined)).toBe('adulte_generique');
  });

  it('retombe sur le profil générique si le sexe est absent ou non reconnu', () => {
    expect(resoudreProfil({ anneeNaissance: 1981 })).toBe('adulte_generique');
    expect(resoudreProfil({ sexe: 'autre', anneeNaissance: 1981 })).toBe('adulte_generique');
  });
});
