// Frontière réseau vers l'API Gemini — la construction de la requête et la validation de la
// réponse sont déléguées à domain/InterpreterArticleIA.js (logique pure, testable sans réseau) ;
// ce fichier ne fait que l'appel HTTP et la gestion d'erreur. Reprend le pattern déjà en place
// dans homeFit/backend/src/services/GeminiClient.js (même API Gemini, même stratégie de retry).
// La clé n'existe que côté serveur (process.env.GEMINI_API_KEY) — jamais envoyée au navigateur.
import {
  construireRequeteArticleIA, validerArticleIA, extraireSourcesGrounding,
} from '../domain/InterpreterArticleIA.js';

// Délai maximum avant d'abandonner UN appel Gemini — 45s (au lieu de 30s) depuis l'activation du
// grounding Google Search : un aller-retour de recherche s'ajoute avant la synthèse de la réponse.
const DELAI_MAX_MS = 45_000;

// Une génération dégénérée (JSON invalide/tronqué) est probabiliste — un nombre de tentatives
// généreux amortit les périodes où le modèle est instable (constat identique à homeFit).
const TENTATIVES_MAX = 5;

async function appelerGeminiUneFois(requete) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  let reponse;
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requete),
      signal: AbortSignal.timeout(DELAI_MAX_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('TIMEOUT');
    throw err;
  }

  if (!reponse.ok) {
    if (reponse.status === 429) throw new Error("Quota de l'IA atteint pour le moment, réessaie plus tard.");
    if (reponse.status === 404) {
      throw new Error(`Modèle IA "${process.env.GEMINI_MODEL}" indisponible (retiré par Google) — mets à jour GEMINI_MODEL (voir ai.google.dev/gemini-api/docs/models).`);
    }
    throw new Error(`Erreur de l'API Gemini (${reponse.status}).`);
  }

  const donnees = await reponse.json();
  const finishReason = donnees.candidates?.[0]?.finishReason;
  const groundingMetadata = donnees.candidates?.[0]?.groundingMetadata;
  // Concaténation défensive de toutes les parts : la réponse tient normalement en une seule part,
  // mais le grounding est un nouveau mode de réponse pas encore éprouvé en pratique sur ce modèle.
  const texte = donnees.candidates?.[0]?.content?.parts
    ?.map((p) => p.text).filter(Boolean).join('');
  if (!texte || finishReason === 'MAX_TOKENS') {
    console.error('Réponse Gemini dégénérée', { finishReason, donnees: JSON.stringify(donnees).slice(0, 2000) });
    throw new Error('DEGENERE');
  }

  try {
    return { corpsJSON: JSON.parse(texte), groundingMetadata };
  } catch {
    console.error('JSON invalide renvoyé par Gemini', { texte: texte.slice(0, 2000) });
    throw new Error('DEGENERE');
  }
}

// Seules DEGENERE et TIMEOUT justifient une nouvelle tentative — tout le reste (429, 404, erreur
// réseau inattendue) n'a aucune raison de mieux se passer immédiatement après, et remonte donc
// sans retry.
const BUDGETS_RETRY = { DEGENERE: TENTATIVES_MAX, TIMEOUT: 2 };

async function avecRetry(requete) {
  let derniereErreur;
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    try {
      return await appelerGeminiUneFois(requete);
    } catch (err) {
      const budget = BUDGETS_RETRY[err.message];
      if (!budget) throw err; // erreur non transitoire : ne jamais retenter
      derniereErreur = err;
      if (tentative >= budget) break; // budget de cette erreur épuisé
    }
  }

  throw new Error(derniereErreur.message === 'TIMEOUT'
    ? "L'IA a mis trop de temps à répondre, réessaie."
    : "Réponse de l'IA invalide, réessaie.");
}

export const GeminiClient = {
  async genererArticleParIA({
    categorie, sujet, ligneEditoriale, articlesPrecedents,
  }) {
    const requete = construireRequeteArticleIA({
      categorie, sujet, ligneEditoriale, articlesPrecedents,
    });
    const { corpsJSON, groundingMetadata } = await avecRetry(requete);
    return {
      ...validerArticleIA(corpsJSON),
      sources: extraireSourcesGrounding(groundingMetadata),
    };
  },
};
