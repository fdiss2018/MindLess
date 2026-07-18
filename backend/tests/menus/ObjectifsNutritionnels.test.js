import { describe, it, expect } from 'vitest';
import { obtenirObjectifsSemaine } from '../../src/menus/domain/ObjectifsNutritionnels.js';

describe('obtenirObjectifsSemaine', () => {
  it('renvoie des objectifs différents pour homme et femme sur féculents/protéines', () => {
    const homme = obtenirObjectifsSemaine('adulte_homme');
    const femme = obtenirObjectifsSemaine('adulte_femme');
    expect(homme.feculents).toBeGreaterThan(femme.feculents);
    expect(homme.proteinesAnimales).toBeGreaterThan(femme.proteinesAnimales);
  });

  it('renvoie les mêmes objectifs planchers (légumes, fruits, laitages) pour les deux sexes', () => {
    const homme = obtenirObjectifsSemaine('adulte_homme');
    const femme = obtenirObjectifsSemaine('adulte_femme');
    expect(homme.legumes).toBe(femme.legumes);
    expect(homme.fruits).toBe(femme.fruits);
    expect(homme.produitsLaitiers).toBe(femme.produitsLaitiers);
  });

  it('retombe sur le profil générique pour une clé inconnue', () => {
    expect(obtenirObjectifsSemaine('clé-inexistante')).toEqual(obtenirObjectifsSemaine('adulte_generique'));
  });
});
