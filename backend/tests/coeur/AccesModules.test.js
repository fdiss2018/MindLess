import { describe, it, expect } from 'vitest';
import {
  IDS_MODULES, estAdministrateur, normaliserModules, modulesAccessibles, aAccesModule,
} from '../../src/coeur/domain/AccesModules.js';

const foyer = {
  creePar: 'admin',
  membres: ['admin', 'membre', 'nouveau'],
  modulesParMembre: { membre: ['veille', 'courses'] },
};

describe('estAdministrateur', () => {
  it('reconnaît le créateur du foyer comme administrateur', () => {
    expect(estAdministrateur(foyer, 'admin')).toBe(true);
    expect(estAdministrateur(foyer, 'membre')).toBe(false);
  });

  it('refuse un foyer ou un uid absent', () => {
    expect(estAdministrateur(null, 'admin')).toBe(false);
    expect(estAdministrateur(foyer, null)).toBe(false);
  });
});

describe('normaliserModules', () => {
  it('ignore les identifiants inconnus et les doublons, dans l\'ordre du catalogue', () => {
    expect(normaliserModules(['veille', 'inconnu', 'voiture', 'veille'])).toEqual(['voiture', 'veille']);
  });

  it('renvoie une liste vide pour une valeur qui n\'est pas un tableau', () => {
    expect(normaliserModules(undefined)).toEqual([]);
    expect(normaliserModules('voiture')).toEqual([]);
  });
});

describe('modulesAccessibles', () => {
  it('donne tous les modules à l\'administrateur, sans configuration', () => {
    expect(modulesAccessibles(foyer, 'admin')).toEqual(IDS_MODULES);
  });

  it('limite un membre aux modules qui lui sont ouverts', () => {
    expect(modulesAccessibles(foyer, 'membre')).toEqual(['courses', 'veille']);
  });

  it('refuse tout module à un membre sans configuration (refus par défaut)', () => {
    expect(modulesAccessibles(foyer, 'nouveau')).toEqual([]);
  });

  it('refuse tout module à quelqu\'un qui n\'est pas membre du foyer', () => {
    expect(modulesAccessibles({ ...foyer, modulesParMembre: { intrus: IDS_MODULES } }, 'intrus')).toEqual([]);
  });

  it('accepte un foyer créé avant l\'introduction des droits (sans modulesParMembre)', () => {
    expect(modulesAccessibles({ creePar: 'admin', membres: ['admin', 'membre'] }, 'membre')).toEqual([]);
  });
});

describe('aAccesModule', () => {
  it('vérifie l\'accès à un module précis', () => {
    expect(aAccesModule(foyer, 'membre', 'veille')).toBe(true);
    expect(aAccesModule(foyer, 'membre', 'voiture')).toBe(false);
    expect(aAccesModule(foyer, 'admin', 'voiture')).toBe(true);
  });
});
