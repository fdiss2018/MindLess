// Logique pure de la synthèse des notes en chapitre : choix des notes, requête Gemini, validation
// de la réponse, paramètres du membre. Aucun appel réseau ici — voir routes/memoires.js pour
// l'orchestration et coeur/repositories/GeminiClient.js pour le transport.

// Une synthèse porte sur les notes les plus anciennes, dans la limite de ce plafond : au-delà, le
// chapitre deviendrait un fourre-tout et le prompt trop long. Les notes restantes attendent la
// synthèse suivante.
export const MAX_NOTES_PAR_CHAPITRE = 50;

// Une note dictée dépasse rarement quelques centaines de caractères — garde-fou contre un envoi
// anormal, pas une contrainte d'usage.
export const LONGUEUR_MAX_NOTE = 5000;

// Paramètres d'un membre — par défaut, les notes sont conservées après synthèse (choix non
// destructif : le membre peut relire ses notes d'origine, et les réutiliser si un chapitre est
// supprimé).
export function normaliserParametres(donnees) {
  return { supprimerNotesApresSynthese: donnees?.supprimerNotesApresSynthese === true };
}

// Notes pas encore synthétisées, de la plus ancienne à la plus récente, plafonnées.
export function notesASynthetiser(notes, max = MAX_NOTES_PAR_CHAPITRE) {
  return notes
    .filter((note) => !note.chapitreId && typeof note.texte === 'string' && note.texte.trim())
    .sort((a, b) => (a.dateCreation || '').localeCompare(b.dateCreation || ''))
    .slice(0, max);
}

// Pas de grounding ici (souvenirs personnels, aucune recherche web) : la sortie JSON peut donc être
// imposée par responseSchema, contrairement à la veille (voir veille/domain/InterpreterArticleIA.js).
const SCHEMA_CHAPITRE = {
  type: 'OBJECT',
  properties: {
    titre: { type: 'STRING' },
    contenu: { type: 'STRING' },
  },
  required: ['titre', 'contenu'],
};

// `notes` : notes à synthétiser ({ texte, dateCreation }), de la plus ancienne à la plus récente.
// `chapitresPrecedents` : chapitres déjà écrits ({ titre }), pour la continuité.
export function construireRequeteChapitre({ notes, chapitresPrecedents = [] }) {
  const contexteChapitres = chapitresPrecedents.length > 0
    ? `

Chapitres déjà écrits dans ses mémoires (ne les répète pas ; tu peux y faire allusion si une note
s'y rattache naturellement) :
${chapitresPrecedents.map((c, i) => `${i + 1}. "${c.titre}"`).join('\n')}`
    : '';

  const texteNotes = notes
    .map((note, i) => `${i + 1}. [${(note.dateCreation || '').slice(0, 10)}] ${note.texte.trim()}`)
    .join('\n');

  const prompt = `Tu aides une personne âgée à écrire ses mémoires. Elle a dicté à voix haute les
notes ci-dessous ; c'est une transcription automatique : il peut y avoir des mots mal reconnus, des
répétitions, des hésitations ou une ponctuation absente.

Rédige à partir de ces notes UN chapitre de ses mémoires :
- à la première personne ("je"), comme si elle l'écrivait elle-même, dans un style simple,
  chaleureux et naturel ;
- fidèle aux notes : n'invente aucun fait, nom, date, lieu ni sentiment qui n'y figure pas. Tu peux
  ordonner, relier et reformuler les souvenirs, et corriger une erreur de transcription évidente ;
- si les notes évoquent plusieurs souvenirs sans lien entre eux, garde-les tous, enchaînés avec
  naturel ;
- en paragraphes séparés par une ligne vide, sans intertitre, sans liste, sans Markdown ;
- avec un titre court et évocateur (sans le mot "Chapitre" ni numéro).${contexteChapitres}

Notes dictées, de la plus ancienne à la plus récente :
${texteNotes}

Réponds uniquement en JSON : {"titre": "...", "contenu": "..."}.`;

  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA_CHAPITRE,
    },
  };
}

// Valide la réponse JSON déjà parsée par GeminiClient — un titre ou un contenu vide rend le
// chapitre inexploitable : erreur explicite plutôt qu'un chapitre vide dans les mémoires.
export function validerChapitreIA(brut) {
  const titre = typeof brut?.titre === 'string'
    ? brut.titre.trim().replace(/^chapitre\s*\d*\s*[:—–-]?\s*/i, '')
    : '';
  const contenu = typeof brut?.contenu === 'string'
    ? brut.contenu.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    : '';

  if (!titre || !contenu) {
    throw new Error("L'IA n'a pas produit de chapitre exploitable, réessaie.");
  }
  return { titre, contenu };
}
