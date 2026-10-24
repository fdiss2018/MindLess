// Génération d'un article de veille par l'IA : requête et validation propres à la veille
// (domain/InterpreterArticleIA.js, logique pure), transport commun à tous les modules
// (coeur/repositories/GeminiClient.js).
import { GeminiClient } from '../../../coeur/repositories/GeminiClient.js';
import {
  construireRequeteArticleIA, validerArticleIA, extraireSourcesGrounding,
} from '../domain/InterpreterArticleIA.js';

export const GenerationArticleIA = {
  async genererArticleParIA({
    categorie, sujet, ligneEditoriale, articlesPrecedents,
  }) {
    const requete = construireRequeteArticleIA({
      categorie, sujet, ligneEditoriale, articlesPrecedents,
    });
    const { corpsJSON, groundingMetadata } = await GeminiClient.generer(requete);
    return {
      ...validerArticleIA(corpsJSON),
      sources: extraireSourcesGrounding(groundingMetadata),
    };
  },
};
