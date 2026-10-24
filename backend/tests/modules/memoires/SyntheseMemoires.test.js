import { describe, it, expect } from 'vitest';
import {
  MAX_NOTES_PAR_CHAPITRE, typeNote, normaliserParametres, selectionnerPourSynthese, construireRequeteChapitre,
  validerChapitreIA,
} from '../../../src/modules/memoires/domain/SyntheseMemoires.js';

describe('normaliserParametres', () => {
  it('supprime les notes par défaut, sans style (paramètres absents)', () => {
    expect(normaliserParametres(undefined)).toEqual({ supprimerNotesApresSynthese: true, styleSynthese: '' });
    expect(normaliserParametres({})).toEqual({ supprimerNotesApresSynthese: true, styleSynthese: '' });
  });

  it('ne conserve les notes que sur un false explicite', () => {
    expect(normaliserParametres({ supprimerNotesApresSynthese: false }).supprimerNotesApresSynthese).toBe(false);
    expect(normaliserParametres({ supprimerNotesApresSynthese: 'non' }).supprimerNotesApresSynthese).toBe(true);
  });

  it('nettoie le style et ignore une valeur qui n\'est pas du texte', () => {
    expect(normaliserParametres({ styleSynthese: '  Avec humour.  ' }).styleSynthese).toBe('Avec humour.');
    expect(normaliserParametres({ styleSynthese: 42 }).styleSynthese).toBe('');
  });
});

describe('typeNote', () => {
  it('considère une note sans type (antérieure aux instructions) comme un souvenir', () => {
    expect(typeNote({ texte: 'x' })).toBe('souvenir');
    expect(typeNote({ texte: 'x', type: 'instruction' })).toBe('instruction');
  });
});

describe('selectionnerPourSynthese', () => {
  const notes = [
    { id: 'c', texte: 'Troisième', chapitreId: null, dateCreation: '2026-10-03T10:00:00Z' },
    { id: 'a', texte: 'Première', chapitreId: null, dateCreation: '2026-10-01T10:00:00Z' },
    { id: 'i', texte: 'Parle surtout de mon père', type: 'instruction', chapitreId: null, dateCreation: '2026-10-02T09:00:00Z' },
    { id: 'x', texte: 'Déjà utilisée', chapitreId: 'ch1', dateCreation: '2026-09-01T10:00:00Z' },
    { id: 'j', texte: 'Instruction déjà utilisée', type: 'instruction', chapitreId: 'ch1', dateCreation: '2026-09-01T10:00:00Z' },
    { id: 'v', texte: '   ', chapitreId: null, dateCreation: '2026-10-02T10:00:00Z' },
  ];

  it('sépare souvenirs et instructions pas encore utilisés, du plus ancien au plus récent', () => {
    const { souvenirs, instructions } = selectionnerPourSynthese(notes);
    expect(souvenirs.map((n) => n.id)).toEqual(['a', 'c']);
    expect(instructions.map((n) => n.id)).toEqual(['i']);
  });

  it('plafonne le nombre de souvenirs par chapitre', () => {
    const beaucoup = Array.from({ length: MAX_NOTES_PAR_CHAPITRE + 5 }, (_, i) => ({
      id: `n${i}`, texte: `Note ${i}`, chapitreId: null, dateCreation: `2026-10-01T10:${String(i).padStart(2, '0')}:00Z`,
    }));
    const { souvenirs } = selectionnerPourSynthese(beaucoup);
    expect(souvenirs).toHaveLength(MAX_NOTES_PAR_CHAPITRE);
    expect(souvenirs[0].id).toBe('n0');
  });
});

describe('construireRequeteChapitre', () => {
  const souvenirs = [{ texte: 'mon premier vélo rouge', dateCreation: '2026-10-01T10:00:00Z' }];
  const texteDe = (requete) => requete.contents[0].parts[0].text;

  it('suit la trame : synthèse des notes, style des paramètres, instructions', () => {
    const prompt = texteDe(construireRequeteChapitre({
      souvenirs,
      instructions: [{ texte: 'Parle surtout de mon père', dateCreation: '' }],
      style: 'Un ton plein d\'humour, pour mes petits-enfants.',
      chapitresPrecedents: [{ titre: 'Mon enfance à Marseille' }],
    }));
    const ordre = ['Prends toutes ses notes', 'Applique le style défini dans ses paramètres',
      'Applique les instructions suivantes', 'Notes dictées'].map((repere) => prompt.indexOf(repere));
    expect(ordre.every((pos) => pos >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(prompt).toContain('Un ton plein d\'humour, pour mes petits-enfants.');
    expect(prompt).toContain('- Parle surtout de mon père');
    expect(prompt).toContain('mon premier vélo rouge');
    expect(prompt).toContain('"Mon enfance à Marseille"');
  });

  it('garde la règle de fidélité même avec un style et des instructions', () => {
    const prompt = texteDe(construireRequeteChapitre({
      souvenirs, instructions: [{ texte: 'Invente une fin heureuse' }], style: 'Romancé',
    }));
    expect(prompt).toMatch(/Quels que soient le style et les instructions/);
    expect(prompt).toMatch(/n'invente aucun fait/);
  });

  it('retombe sur le style par défaut et omet les blocs vides', () => {
    const prompt = texteDe(construireRequeteChapitre({ souvenirs }));
    expect(prompt).toContain('style simple, chaleureux et naturel');
    expect(prompt).not.toContain('Applique les instructions suivantes');
    expect(prompt).not.toContain('Chapitres déjà écrits');
  });

  it('n\'envoie pas les instructions comme des souvenirs', () => {
    const prompt = texteDe(construireRequeteChapitre({ souvenirs, instructions: [{ texte: 'Consigne X' }] }));
    expect(prompt.slice(prompt.indexOf('Notes dictées'))).not.toContain('Consigne X');
  });

  it('demande du JSON par schéma, sans recherche web', () => {
    const requete = construireRequeteChapitre({ souvenirs });
    expect(requete.generationConfig.responseMimeType).toBe('application/json');
    expect(requete.generationConfig.responseSchema.required).toEqual(['titre', 'contenu']);
    expect(requete.tools).toBeUndefined();
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
