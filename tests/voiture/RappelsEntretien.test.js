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

  it('gère un dernier entretien au 29 février sans déborder d\'un jour sur l\'année suivante', () => {
    // 2025 n'est pas bissextile : l'échéance à 12 mois doit être calée sur le 28/02/2025, pas
    // déborder sur le 01/03/2025 (bug de Date.setMonth sur un jour qui n'existe pas dans le mois
    // cible). Kilométrage proche pour isoler le critère de date.
    const entretiens = [{ type: 'vidange', date: '2024-02-29', kilometrage: 40000 }];
    const rappels = calculerRappels(vehicule(40100), entretiens, new Date('2025-02-28'));
    const vidange = rappels.find(r => r.type === 'vidange');
    expect(vidange.joursRestants).toBeLessThanOrEqual(0);
  });

  it('exclut le type "autre" qui n\'a aucun intervalle défini', () => {
    const rappels = calculerRappels(vehicule(10000), [], new Date('2026-07-08'));
    expect(rappels.find(r => r.type === 'autre')).toBeUndefined();
  });
});
