import { describe, it, expect } from 'vitest';
import {
  getIdSemaine, getDatesSemaine, semaineSuivante, semainePrecedente,
} from '../../src/menus/domain/DateSemaine.js';

describe('getIdSemaine', () => {
  it('calcule un identifiant de semaine ISO simple', () => {
    expect(getIdSemaine(new Date(2026, 6, 8))).toBe('2026-W28'); // mercredi 8 juillet 2026
  });

  it('rattache le 1er janvier au dernier numéro de semaine de l\'année précédente si nécessaire', () => {
    expect(getIdSemaine(new Date(2021, 0, 1))).toBe('2020-W53'); // vendredi 1er janvier 2021
  });

  it('rattache la fin décembre à la semaine 1 de l\'année suivante si nécessaire', () => {
    expect(getIdSemaine(new Date(2019, 11, 30))).toBe('2020-W01'); // lundi 30 décembre 2019
  });
});

describe('getDatesSemaine', () => {
  it('renvoie 7 dates consécutives en commençant un lundi', () => {
    const dates = getDatesSemaine('2026-W28');
    expect(dates).toHaveLength(7);
    expect(dates[0].getUTCDay()).toBe(1); // lundi
    expect(dates[6].getUTCDay()).toBe(0); // dimanche
    expect(getIdSemaine(dates[0])).toBe('2026-W28');
  });
});

describe('navigation entre semaines', () => {
  it('semaineSuivante puis semainePrecedente est une opération neutre', () => {
    const id = '2026-W28';
    expect(semainePrecedente(semaineSuivante(id))).toBe(id);
  });

  it('gère le passage d\'une année à l\'autre', () => {
    expect(semaineSuivante('2020-W53')).toBe('2021-W01');
  });
});
