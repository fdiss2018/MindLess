import { describe, it, expect } from 'vitest';
import { construireRequeteArticleIA, validerArticleIA } from '../../src/veille/domain/InterpreterArticleIA.js';

describe('construireRequeteArticleIA', () => {
  it('mentionne les tendances émergentes pour une catégorie qui accentue les tendances', () => {
    const requete = construireRequeteArticleIA({ categorie: 'ia' });
    expect(requete.contents[0].parts[0].text).toContain('tendances émergentes');
  });

  it("n'exige pas les tendances pour une catégorie qui ne le demande pas", () => {
    const requete = construireRequeteArticleIA({ categorie: 'politique' });
    expect(requete.contents[0].parts[0].text).not.toContain('tendances émergentes');
  });

  it('inclut le sujet fourni dans le prompt', () => {
    const requete = construireRequeteArticleIA({ categorie: 'culture', sujet: 'exposition Cézanne' });
    expect(requete.contents[0].parts[0].text).toContain('exposition Cézanne');
  });

  it('demande une réponse JSON structurée avec titre, contenu, contenuAudio et motsCles', () => {
    const requete = construireRequeteArticleIA({ categorie: 'marseille' });
    expect(requete.generationConfig.responseSchema.required)
      .toEqual(['titre', 'contenu', 'contenuAudio', 'motsCles']);
  });

  it('utilise la ligne éditoriale personnalisée à la place du prompt générique quand elle est fournie', () => {
    const requete = construireRequeteArticleIA({
      categorie: 'culture',
      ligneEditoriale: 'Tu es « L\'Éclaireur Art Contemporain »...',
    });
    expect(requete.contents[0].parts[0].text).toContain("Tu es « L'Éclaireur Art Contemporain »");
    expect(requete.contents[0].parts[0].text).not.toContain('rubrique "Culture et art contemporain');
  });

  it('conserve la mise en garde anti-hallucination même avec une ligne éditoriale personnalisée', () => {
    const requete = construireRequeteArticleIA({ categorie: 'culture', ligneEditoriale: 'Persona custom.' });
    expect(requete.contents[0].parts[0].text).toContain("pas accès à une source d'actualité en temps réel");
  });

  it('ignore une ligne éditoriale vide et retombe sur le prompt générique', () => {
    const requete = construireRequeteArticleIA({ categorie: 'culture', ligneEditoriale: '   ' });
    expect(requete.contents[0].parts[0].text).toContain('rubrique "Culture et art contemporain');
  });

  it("n'ajoute aucun contexte de continuité quand il n'y a pas d'article précédent", () => {
    const requete = construireRequeteArticleIA({ categorie: 'ia', articlesPrecedents: [] });
    expect(requete.contents[0].parts[0].text).not.toContain('déjà publiés');
  });

  it('liste les articles précédents (titre, date, extrait) pour assurer la continuité', () => {
    const requete = construireRequeteArticleIA({
      categorie: 'ia',
      articlesPrecedents: [
        { titre: 'Gemini 3 est sorti', dateCreation: '2026-09-10T12:00:00.000Z', extrait: 'Résumé du premier article.' },
        { titre: 'Claude Code évolue', dateCreation: '2026-09-01T12:00:00.000Z', extrait: 'Résumé du second article.' },
      ],
    });
    const texte = requete.contents[0].parts[0].text;
    expect(texte).toContain('déjà publiés');
    expect(texte).toContain('[2026-09-10]');
    expect(texte).toContain('"Gemini 3 est sorti"');
    expect(texte).toContain('Résumé du premier article.');
    expect(texte).toContain('"Claude Code évolue"');
  });

  it('interdit explicitement les formules laissant croire à une actualité datée ("cette semaine"...)', () => {
    const requete = construireRequeteArticleIA({ categorie: 'ia' });
    expect(requete.contents[0].parts[0].text).toContain('"cette semaine"');
  });
});

describe('validerArticleIA', () => {
  it('accepte une réponse avec titre, contenu, contenuAudio et motsCles', () => {
    expect(validerArticleIA({
      titre: 'Titre', contenu: 'Contenu.', contenuAudio: 'Contenu à l\'oral.', motsCles: ['mcp', 'claude'],
    })).toEqual({
      titre: 'Titre', contenu: 'Contenu.', contenuAudio: 'Contenu à l\'oral.', motsCles: ['mcp', 'claude'],
    });
  });

  it('retombe sur un tableau vide si motsCles est absent ou mal formé', () => {
    expect(validerArticleIA({ titre: 'Titre', contenu: 'Contenu.', contenuAudio: 'Audio.' }).motsCles)
      .toEqual([]);
    expect(validerArticleIA({
      titre: 'Titre', contenu: 'Contenu.', contenuAudio: 'Audio.', motsCles: 'pas-un-tableau',
    }).motsCles).toEqual([]);
  });

  it('rejette une réponse sans titre', () => {
    expect(() => validerArticleIA({ contenu: 'Contenu.', contenuAudio: 'Contenu à l\'oral.' })).toThrow();
  });

  it('rejette une réponse sans contenu', () => {
    expect(() => validerArticleIA({ titre: 'Titre', contenuAudio: 'Contenu à l\'oral.' })).toThrow();
  });

  it('rejette une réponse sans contenuAudio', () => {
    expect(() => validerArticleIA({ titre: 'Titre', contenu: 'Contenu.' })).toThrow();
  });
});
