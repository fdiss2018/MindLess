import { describe, it, expect } from 'vitest';
import {
  MAX_NOTES_PAR_CHAPITRE, normaliserParametres, notesASynthetiser, construireRequeteChapitre, validerChapitreIA,
} from '../../../src/modules/memoires/domain/SyntheseMemoires.js';

describe('normaliserParametres', () => {
  it('conserve les notes par défaut (paramètre absent)', () => {
    expect(normaliserParametres(undefined)).toEqual({ supprimerNotesApresSynthese: false });
    expect(normaliserParametres({})).toEqual({ supprimerNotesApresSynthese: false });
  });

  it('n\'active la suppression que sur un vrai booléen true', () => {
    expect(normaliserParametres({ supprimerNotesApresSynthese: true })).toEqual({ supprimerNotesApresSynthese: true });
    expect(normaliserParametres({ supprimerNotesApresSynthese: 'oui' })).toEqual({ supprimerNotesApresSynthese: false });
  });
});

describe('notesASynthetiser', () => {
  const notes = [
    { id: 'c', texte: 'Troisième', chapitreId: null, dateCreation: '2026-10-03T10:00:00Z' },
    { id: 'a', texte: 'Première', chapitreId: null, dateCreation: '2026-10-01T10:00:00Z' },
    { id: 'x', texte: 'Déjà utilisée', chapitreId: 'ch1', dateCreation: '2026-09-01T10:00:00Z' },
    { id: 'v', texte: '   ', chapitreId: null, dateCreation: '2026-10-02T10:00:00Z' },
  ];

  it('ne garde que les notes non vides pas encore synthétisées, de la plus ancienne à la plus récente', () => {
    expect(notesASynthetiser(notes).map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('plafonne le nombre de notes par chapitre', () => {
    const beaucoup = Array.from({ length: MAX_NOTES_PAR_CHAPITRE + 5 }, (_, i) => ({
      id: `n${i}`, texte: `Note ${i}`, chapitreId: null, dateCreation: `2026-10-01T10:${String(i).padStart(2, '0')}:00Z`,
    }));
    const retenues = notesASynthetiser(beaucoup);
    expect(retenues).toHaveLength(MAX_NOTES_PAR_CHAPITRE);
    expect(retenues[0].id).toBe('n0');
  });
});

describe('construireRequeteChapitre', () => {
  const requete = construireRequeteChapitre({
    notes: [{ texte: 'mon premier vélo rouge', dateCreation: '2026-10-01T10:00:00Z' }],
    chapitresPrecedents: [{ titre: 'Mon enfance à Marseille' }],
  });
  const prompt = requete.contents[0].parts[0].text;

  it('transmet les notes et les titres des chapitres précédents', () => {
    expect(prompt).toContain('mon premier vélo rouge');
    expect(prompt).toContain('[2026-10-01]');
    expect(prompt).toContain('"Mon enfance à Marseille"');
  });

  it('impose la fidélité aux notes (aucune invention)', () => {
    expect(prompt).toMatch(/n'invente aucun fait/);
  });

  it('demande du JSON par schéma, sans recherche web', () => {
    expect(requete.generationConfig.responseMimeType).toBe('application/json');
    expect(requete.generationConfig.responseSchema.required).toEqual(['titre', 'contenu']);
    expect(requete.tools).toBeUndefined();
  });

  it('omet le bloc des chapitres précédents pour un premier chapitre', () => {
    const premier = construireRequeteChapitre({ notes: [{ texte: 'souvenir', dateCreation: '' }] });
    expect(premier.contents[0].parts[0].text).not.toContain('Chapitres déjà écrits');
  });
});

describe('validerChapitreIA', () => {
  it('renvoie titre et contenu nettoyés', () => {
    expect(validerChapitreIA({ titre: '  Le vélo rouge ', contenu: 'Paragraphe 1.\r\n\r\n\r\n\r\nParagraphe 2.' }))
      .toEqual({ titre: 'Le vélo rouge', contenu: 'Paragraphe 1.\n\nParagraphe 2.' });
  });

  it('retire un préfixe "Chapitre N" ajouté malgré la consigne', () => {
    expect(validerChapitreIA({ titre: 'Chapitre 3 : Le vélo rouge', contenu: 'Texte.' }).titre).toBe('Le vélo rouge');
  });

  it('refuse un titre ou un contenu vide', () => {
    expect(() => validerChapitreIA({ titre: '', contenu: 'Texte.' })).toThrow();
    expect(() => validerChapitreIA({ titre: 'Titre', contenu: '  ' })).toThrow();
    expect(() => validerChapitreIA(null)).toThrow();
  });
});
