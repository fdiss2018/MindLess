import { describe, it, expect } from 'vitest';
import { validerChampsArticle, extraireResume, normaliserMotsCles } from '../../src/veille/domain/Article.js';

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
