import { describe, it, expect } from 'vitest';
import { mettreEnPhrase, assemblerDictee, joindreTextes } from '../../../public/modules/memoires/utils/TexteDicte.js';

describe('mettreEnPhrase', () => {
  it('ajoute une majuscule et un point final', () => {
    expect(mettreEnPhrase('mon premier vélo était rouge')).toBe('Mon premier vélo était rouge.');
  });

  it('normalise les espaces et garde la ponctuation existante', () => {
    expect(mettreEnPhrase('  quelle   journée ! ')).toBe('Quelle journée !');
    expect(mettreEnPhrase('tu te souviens ?')).toBe('Tu te souviens ?');
  });

  it('gère les accents en début de phrase', () => {
    expect(mettreEnPhrase('été 1962 à Cassis')).toBe('Été 1962 à Cassis.');
  });

  it('renvoie une chaîne vide pour un segment vide', () => {
    expect(mettreEnPhrase('   ')).toBe('');
    expect(mettreEnPhrase(undefined)).toBe('');
  });
});

describe('assemblerDictee', () => {
  it('fait une phrase de chaque segment reconnu', () => {
    expect(assemblerDictee(['on habitait rue de Rome', '', 'mon père était boulanger']))
      .toBe('On habitait rue de Rome. Mon père était boulanger.');
  });
});

describe('joindreTextes', () => {
  it('ajoute la dictée à la suite du texte déjà saisi', () => {
    expect(joindreTextes('Début. ', '', 'Suite.')).toBe('Début. Suite.');
    expect(joindreTextes('', 'Seul.')).toBe('Seul.');
  });
});
