import { describe, it, expect } from 'vitest';
import { calculerRappels } from '../../public/voiture/utils/RappelsEntretien.js';

const vehicule = (kilometrageActuel) => ({ kilometrageActuel });

describe('calculerRappels', () => {
  it('renvoie "inconnu" quand aucun entretien du type n\'existe', () => {
    const rappels = calculerRappels(vehicule(50000), [], new Date('2026-07-08'));
    const vidange = rappels.find(r => r.type === 'vidange');
    expect(vidange.statut).toBe('inconnu');
    expect(vidange.kmRestants).toBeNull();
    expect(vidange.joursRestants).toBeNull();
  });

  it('renvoie "ok" quand on est largement dans l\'intervalle (km et date)', () => {
    const entretiens = [{ type: 'vidange', date: '2026-06-01', kilometrage: 40000 }];
    const rappels = calculerRappels(vehicule(41000), entretiens, new Date('2026-07-08'));
    const vidange = rappels.find(r => r.type === 'vidange');
    expect(vidange.statut).toBe('ok');
    expect(vidange.kmRestants).toBe(14000);
  });

  it('renvoie "proche" quand le seuil kilométrique est presque atteint', () => {
    const entretiens = [{ type: 'vidange', date: '2026-06-01', kilometrage: 40000 }];
    const rappels = calculerRappels(vehicule(54500), entretiens, new Date('2026-07-08'));
    const vidange = rappels.find(r => r.type === 'vidange');
    expect(vidange.statut).toBe('proche');
    expect(vidange.kmRestants).toBe(500);
  });

  it('renvoie "du" quand le seuil kilométrique est dépassé', () => {
    const entretiens = [{ type: 'vidange', date: '2026-06-01', kilometrage: 40000 }];
    const rappels = calculerRappels(vehicule(56000), entretiens, new Date('2026-07-08'));
    const vidange = rappels.find(r => r.type === 'vidange');
    expect(vidange.statut).toBe('du');
    expect(vidange.kmRestants).toBeLessThanOrEqual(0);
  });

  it('renvoie "du" quand le seuil de date est dépassé même si le kilométrage est loin', () => {
    const entretiens = [{ type: 'vidange', date: '2024-01-01', kilometrage: 40000 }];
    const rappels = calculerRappels(vehicule(41000), entretiens, new Date('2026-07-08'));
    const vidange = rappels.find(r => r.type === 'vidange');
    expect(vidange.statut).toBe('du');
    expect(vidange.joursRestants).toBeLessThanOrEqual(0);
  });

  it('gère une règle basée uniquement sur la date (contrôle technique)', () => {
    const entretiens = [{ type: 'controleTechnique', date: '2024-08-01', kilometrage: 30000 }];
    const rappels = calculerRappels(vehicule(35000), entretiens, new Date('2026-07-08'));
    const ct = rappels.find(r => r.type === 'controleTechnique');
    expect(ct.kmRestants).toBeNull();
    expect(ct.statut).toBe('proche');
  });

  it('gère une règle basée uniquement sur le kilométrage (pneus)', () => {
    const entretiens = [{ type: 'pneus', date: '2020-01-01', kilometrage: 10000 }];
    const rappels = calculerRappels(vehicule(30000), entretiens, new Date('2026-07-08'));
    const pneus = rappels.find(r => r.type === 'pneus');
    expect(pneus.joursRestants).toBeNull();
    expect(pneus.statut).toBe('ok');
  });

  it('exclut le type "autre" qui n\'a aucun intervalle défini', () => {
    const rappels = calculerRappels(vehicule(10000), [], new Date('2026-07-08'));
    expect(rappels.find(r => r.type === 'autre')).toBeUndefined();
  });
});
