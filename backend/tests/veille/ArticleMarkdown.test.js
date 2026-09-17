import { describe, it, expect } from 'vitest';
import { parserMarkdown, parserFichierImport } from '../../src/veille/domain/ArticleMarkdown.js';

describe('parserMarkdown', () => {
  it('extrait titre, catégorie et contenu depuis un front-matter valide', () => {
    const brut = '---\ntitre: Mon article\ncategorie: ia\n---\nPremier paragraphe.\n\nDeuxième paragraphe.';
    expect(parserMarkdown(brut)).toEqual({
      titre: 'Mon article',
      categorie: 'ia',
      contenu: 'Premier paragraphe.\n\nDeuxième paragraphe.',
      contenuAudio: null,
      motsCles: '',
    });
  });

  it("sépare contenu et contenuAudio quand le corps contient un séparateur --- AUDIO ---", () => {
    const brut = '---\ntitre: Mon article\ncategorie: ia\n---\nVersion à lire.\n\n--- AUDIO ---\nVersion à écouter.';
    const resultat = parserMarkdown(brut);
    expect(resultat.contenu).toBe('Version à lire.');
    expect(resultat.contenuAudio).toBe('Version à écouter.');
  });

  it('reconnaît le séparateur audio même avec une casse et un nombre de tirets différents', () => {
    const brut = '---\ntitre: Mon article\ncategorie: ia\n---\nLecture.\n\n----audio----\nEcoute.';
    const resultat = parserMarkdown(brut);
    expect(resultat.contenu).toBe('Lecture.');
    expect(resultat.contenuAudio).toBe('Ecoute.');
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
      titre: 'Test', categorie: 'culture', contenu: 'Contenu.', contenuAudio: null, motsCles: '',
    });
  });

  it('reconnaît le séparateur audio avec des fins de ligne CRLF', () => {
    const brut = '---\r\ntitre: Test\r\ncategorie: culture\r\n---\r\nLecture.\r\n\r\n--- AUDIO ---\r\nEcoute.';
    const resultat = parserMarkdown(brut);
    expect(resultat.contenu).toBe('Lecture.');
    expect(resultat.contenuAudio).toBe('Ecoute.');
  });
});

describe('parserFichierImport', () => {
  it('délègue à parserMarkdown pour un fichier .md (front-matter)', () => {
    const brut = '---\ntitre: Mon article\ncategorie: ia\n---\nContenu.';
    expect(parserFichierImport(brut)).toEqual({
      titre: 'Mon article', categorie: 'ia', contenu: 'Contenu.', contenuAudio: null, motsCles: '',
    });
  });

  it('lit directement un objet JSON au format de l\'API externe', () => {
    const brut = JSON.stringify({
      titre: 'Mon article',
      categorie: 'ia',
      contenu: 'Contenu à lire.',
      contenuAudio: 'Contenu à écouter.',
      motsCles: ['mcp', 'claude'],
    });
    expect(parserFichierImport(brut)).toEqual({
      titre: 'Mon article',
      categorie: 'ia',
      contenu: 'Contenu à lire.',
      contenuAudio: 'Contenu à écouter.',
      motsCles: ['mcp', 'claude'],
    });
  });

  it('retombe sur le parsing Markdown si le JSON est invalide malgré une accolade de départ', () => {
    const brut = '{ pas du json valide';
    const resultat = parserFichierImport(brut);
    expect(resultat.titre).toBeNull();
    expect(resultat.contenu).toBe(brut);
  });

  it('accepte un objet JSON sans contenuAudio ni motsCles (tous deux optionnels)', () => {
    const brut = JSON.stringify({ titre: 'Mon article', categorie: 'ia', contenu: 'Contenu.' });
    const resultat = parserFichierImport(brut);
    expect(resultat.contenuAudio).toBeNull();
    expect(resultat.motsCles).toBe('');
  });
});
