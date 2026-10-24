import { describe, it, expect } from 'vitest';
import {
  IDS_MODULES, DUREE_ACCES_TEMPORAIRE_JOURS, estAdministrateur, normaliserModules, statutDemande, etatModules,
  modulesAccessibles, aAccesModule, compterDemandesEnAttente, refusDemande, creerDemande,
  appliquerChoixAdministrateur, confirmerModule,
} from '../../src/coeur/domain/AccesModules.js';

const MAINTENANT = new Date('2026-10-24T12:00:00Z');
const JOUR = 24 * 60 * 60 * 1000;
const aLEssai = (joursRestants) => ({
  statut: 'en_attente', dateDemande: '2026-10-20T12:00:00.000Z', expiration: MAINTENANT.getTime() + joursRestants * JOUR,
});

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

  it('ouvre un module à l\'essai tant qu\'il n\'a pas expiré', () => {
    const avecEssai = { ...foyer, demandesModules: { nouveau: { memoires: aLEssai(3), voiture: aLEssai(-1) } } };
    expect(modulesAccessibles(avecEssai, 'nouveau', MAINTENANT)).toEqual(['memoires']);
  });

  it('ferme un module refusé', () => {
    const refuse = { ...foyer, demandesModules: { nouveau: { memoires: { statut: 'refusee' } } } };
    expect(modulesAccessibles(refuse, 'nouveau', MAINTENANT)).toEqual([]);
  });
});

describe('aAccesModule', () => {
  it('vérifie l\'accès à un module précis', () => {
    expect(aAccesModule(foyer, 'membre', 'veille')).toBe(true);
    expect(aAccesModule(foyer, 'membre', 'voiture')).toBe(false);
    expect(aAccesModule(foyer, 'admin', 'voiture')).toBe(true);
  });
});

describe('statutDemande', () => {
  it('distingue essai en cours, expiré, refusé et absence de demande', () => {
    expect(statutDemande(aLEssai(1), MAINTENANT)).toBe('en_attente');
    expect(statutDemande(aLEssai(0), MAINTENANT)).toBe('expiree');
    expect(statutDemande({ statut: 'refusee' }, MAINTENANT)).toBe('refusee');
    expect(statutDemande(undefined, MAINTENANT)).toBe(null);
  });
});

describe('etatModules', () => {
  it('donne l\'état de chaque module du catalogue pour un membre', () => {
    const f = {
      ...foyer,
      demandesModules: { membre: { memoires: aLEssai(5), voiture: aLEssai(-2), menus: { statut: 'refusee' } } },
    };
    const etats = Object.fromEntries(etatModules(f, 'membre', MAINTENANT).map((e) => [e.id, e.statut]));
    expect(etats).toEqual({
      voiture: 'expire', courses: 'ouvert', menus: 'refuse', veille: 'ouvert', memoires: 'temporaire',
    });
    expect(etatModules(f, 'membre', MAINTENANT).find((e) => e.id === 'memoires').expiration)
      .toBe(MAINTENANT.getTime() + 5 * JOUR);
  });

  it('tout ouvert pour l\'administrateur, tout fermé pour un non-membre', () => {
    expect(etatModules(foyer, 'admin').every((e) => e.statut === 'ouvert')).toBe(true);
    expect(etatModules(foyer, 'intrus').every((e) => e.statut === 'ferme')).toBe(true);
  });
});

describe('compterDemandesEnAttente', () => {
  it('ne compte que les essais en cours des membres', () => {
    const f = {
      ...foyer,
      demandesModules: { membre: { memoires: aLEssai(2), voiture: aLEssai(-1) }, nouveau: { menus: aLEssai(10) } },
    };
    expect(compterDemandesEnAttente(f, MAINTENANT)).toBe(2);
    expect(compterDemandesEnAttente(foyer, MAINTENANT)).toBe(0);
  });
});

describe('refusDemande', () => {
  const f = {
    ...foyer,
    demandesModules: { nouveau: { memoires: aLEssai(2), voiture: aLEssai(-1), menus: { statut: 'refusee' } } },
  };

  it('accepte un module fermé', () => {
    expect(refusDemande(f, 'nouveau', 'courses', MAINTENANT)).toBe(null);
  });

  it('refuse un module déjà ouvert, déjà à l\'essai, refusé ou dont l\'essai a expiré', () => {
    expect(refusDemande(f, 'membre', 'veille', MAINTENANT)).toMatch(/déjà ouvert/);
    expect(refusDemande(f, 'nouveau', 'memoires', MAINTENANT)).toMatch(/déjà ce module à l'essai/);
    expect(refusDemande(f, 'nouveau', 'menus', MAINTENANT)).toMatch(/refusé/);
    expect(refusDemande(f, 'nouveau', 'voiture', MAINTENANT)).toMatch(/essai s'est terminé/);
  });

  it('refuse un module inconnu et l\'administrateur', () => {
    expect(refusDemande(f, 'nouveau', 'fantome', MAINTENANT)).toBe('Module inconnu.');
    expect(refusDemande(f, 'admin', 'courses', MAINTENANT)).toMatch(/administrateur/);
  });
});

describe('creerDemande', () => {
  it('ouvre un essai de 3 semaines', () => {
    expect(creerDemande(MAINTENANT)).toEqual({
      statut: 'en_attente',
      dateDemande: MAINTENANT.toISOString(),
      expiration: MAINTENANT.getTime() + DUREE_ACCES_TEMPORAIRE_JOURS * JOUR,
    });
    expect(DUREE_ACCES_TEMPORAIRE_JOURS).toBe(21);
  });
});

describe('appliquerChoixAdministrateur', () => {
  const f = {
    ...foyer,
    modulesParMembre: { membre: ['courses', 'veille'] },
    demandesModules: { membre: { memoires: aLEssai(5), menus: aLEssai(4), voiture: { statut: 'refusee' } } },
  };

  it('garde à l\'essai un module coché, sans le confirmer par mégarde', () => {
    const { modules, demandes } = appliquerChoixAdministrateur(f, 'membre', ['courses', 'veille', 'memoires', 'menus'], MAINTENANT);
    expect(modules).toEqual(['courses', 'veille']);
    expect(demandes).toEqual({});
  });

  it('refuse un module à l\'essai ou ouvert quand il est décoché', () => {
    const { modules, demandes } = appliquerChoixAdministrateur(f, 'membre', ['courses', 'menus'], MAINTENANT);
    expect(modules).toEqual(['courses']);
    expect(demandes.memoires).toMatchObject({ statut: 'refusee', dateDemande: '2026-10-20T12:00:00.000Z' });
    expect(demandes.veille).toMatchObject({ statut: 'refusee', dateDemande: null });
    expect(demandes.menus).toBeUndefined();
  });

  it('ouvre définitivement un module coché, en effaçant un ancien refus', () => {
    const { modules, demandes } = appliquerChoixAdministrateur(f, 'membre', ['courses', 'veille', 'voiture', 'memoires', 'menus'], MAINTENANT);
    expect(modules).toEqual(['voiture', 'courses', 'veille']);
    expect(demandes).toEqual({ voiture: null });
  });
});

describe('confirmerModule', () => {
  it('rend définitif un module à l\'essai et efface la demande', () => {
    const f = { ...foyer, demandesModules: { membre: { memoires: aLEssai(3) } } };
    expect(confirmerModule(f, 'membre', 'memoires')).toEqual({ modules: ['courses', 'veille', 'memoires'], demandes: { memoires: null } });
  });

  it('fonctionne sans demande préalable', () => {
    expect(confirmerModule(foyer, 'nouveau', 'voiture')).toEqual({ modules: ['voiture'], demandes: {} });
  });
});
