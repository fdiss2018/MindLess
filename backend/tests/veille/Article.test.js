import { describe, it, expect } from 'vitest';
import {
  validerChampsArticle, extraireResume, normaliserMotsCles, filtrerArticles,
} from '../../src/veille/domain/Article.js';

describe('validerChampsArticle', () => {
  it('accepte des champs valides', () => {
    expect(validerChampsArticle({ titre: 'Titre', categorie: 'ia', contenu: 'Contenu.' })).toBeNull();
  });

  it('rejette un titre manquant', () => {
    expect(validerChampsArticle({ titre: '', categorie: 'ia', contenu: 'Contenu.' }))
      .toBe('Le titre est requis.');
  });

  it('rejette un titre composé uniquement d\'espaces', () => {
    expect(validerChampsArticle({ titre: '   ', categorie: 'ia', contenu: 'Contenu.' }))
      .toBe('Le titre est requis.');
  });

  it('rejette une catégorie invalide', () => {
    expect(validerChampsArticle({ titre: 'Titre', categorie: 'inconnue', contenu: 'Contenu.' }))
      .toBe('Catégorie invalide.');
  });

  it('rejette un contenu manquant', () => {
    expect(validerChampsArticle({ titre: 'Titre', categorie: 'ia', contenu: '' }))
      .toBe('Le contenu est requis.');
  });
});

describe('extraireResume', () => {
  it('retourne le texte tel quel quand il tient dans la longueur demandée', () => {
    expect(extraireResume('Un court contenu.', 300)).toBe('Un court contenu.');
  });

  it('tronque sur un espace et ajoute une ellipse au-delà de la longueur demandée', () => {
    const texte = 'Un mot '.repeat(50).trim(); // bien plus long que 20 caractères
    const resume = extraireResume(texte, 20);
    expect(resume.endsWith('…')).toBe(true);
    expect(resume.length).toBeLessThanOrEqual(21);
    expect(resume.startsWith('Un mot')).toBe(true);
  });

  it('retourne une chaîne vide pour un contenu vide/absent', () => {
    expect(extraireResume('')).toBe('');
    expect(extraireResume(undefined)).toBe('');
  });
});

describe('normaliserMotsCles', () => {
  it('nettoie un tableau (espaces superflus, entrées vides)', () => {
    expect(normaliserMotsCles([' mcp ', '', 'claude', '   '])).toEqual(['mcp', 'claude']);
  });

  it('découpe une chaîne séparée par des virgules (front-matter .md)', () => {
    expect(normaliserMotsCles('mcp, claude,  anthropic ')).toEqual(['mcp', 'claude', 'anthropic']);
  });

  it('retourne un tableau vide pour une valeur absente ou invalide', () => {
    expect(normaliserMotsCles(undefined)).toEqual([]);
    expect(normaliserMotsCles(null)).toEqual([]);
    expect(normaliserMotsCles(42)).toEqual([]);
  });
});

describe('filtrerArticles', () => {
  const articles = [
    { id: '1', categorie: 'ia', dateCreation: '2026-09-01T10:00:00.000Z' },
    { id: '2', categorie: 'ia', dateCreation: '2026-09-15T10:00:00.000Z' },
    { id: '3', categorie: 'ecologie', dateCreation: '2026-09-10T10:00:00.000Z' },
  ];

  it('retourne tous les articles sans filtre', () => {
    expect(filtrerArticles(articles)).toEqual(articles);
    expect(filtrerArticles(articles, {})).toEqual(articles);
  });

  it('filtre par catégorie exacte', () => {
    expect(filtrerArticles(articles, { categorie: 'ecologie' })).toEqual([articles[2]]);
  });

  it('filtre par date de début (depuis)', () => {
    expect(filtrerArticles(articles, { depuis: '2026-09-10' })).toEqual([articles[1], articles[2]]);
  });

  it('filtre par date de fin (jusqua)', () => {
    expect(filtrerArticles(articles, { jusqua: '2026-09-10' })).toEqual([articles[0], articles[2]]);
  });

  it('combine catégorie et plage de dates', () => {
    expect(filtrerArticles(articles, { categorie: 'ia', depuis: '2026-09-10', jusqua: '2026-09-20' }))
      .toEqual([articles[1]]);
  });

  it('exclut un article sans dateCreation dès qu\'une borne de date est fournie', () => {
    const sansDate = [{ id: '4', categorie: 'ia', dateCreation: undefined }];
    expect(filtrerArticles(sansDate, { depuis: '2026-01-01' })).toEqual([]);
    expect(filtrerArticles(sansDate, { jusqua: '2026-01-01' })).toEqual([]);
    expect(filtrerArticles(sansDate)).toEqual(sansDate);
  });
});
