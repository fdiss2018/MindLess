import { describe, it, expect } from 'vitest';
import { parserMarkdown } from '../../src/veille/domain/ArticleMarkdown.js';

describe('parserMarkdown', () => {
  it('extrait titre, catégorie et contenu depuis un front-matter valide', () => {
    const brut = '---\ntitre: Mon article\ncategorie: ia\n---\nPremier paragraphe.\n\nDeuxième paragraphe.';
    expect(parserMarkdown(brut)).toEqual({
      titre: 'Mon article',
      categorie: 'ia',
      contenu: 'Premier paragraphe.\n\nDeuxième paragraphe.',
      motsCles: '',
    });
  });

  it('extrait les mots-clés bruts (chaîne séparée par des virgules) depuis le front-matter', () => {
    const brut = '---\ntitre: Mon article\ncategorie: ia\nmotsCles: mcp, claude, anthropic\n---\nContenu.';
    expect(parserMarkdown(brut).motsCles).toBe('mcp, claude, anthropic');
  });

  it('retourne titre/categorie à null quand le front-matter est absent', () => {
    const resultat = parserMarkdown('Juste du texte, sans en-tête.');
    expect(resultat.titre).toBeNull();
    expect(resultat.categorie).toBeNull();
    expect(resultat.contenu).toBe('Juste du texte, sans en-tête.');
  });

  it('retourne titre à null quand il manque dans le front-matter', () => {
    const brut = '---\ncategorie: ia\n---\nContenu.';
    expect(parserMarkdown(brut).titre).toBeNull();
  });

  it('gère les fins de ligne CRLF', () => {
    const brut = '---\r\ntitre: Test\r\ncategorie: culture\r\n---\r\nContenu.';
    expect(parserMarkdown(brut)).toEqual({
      titre: 'Test', categorie: 'culture', contenu: 'Contenu.', motsCles: '',
    });
  });
});
