// Logique pure de la synthèse des notes en chapitre : choix des notes, requête Gemini, validation
// de la réponse, paramètres du membre. Aucun appel réseau ici — voir routes/memoires.js pour
// l'orchestration et coeur/repositories/GeminiClient.js pour le transport.

// Une synthèse porte sur les souvenirs les plus anciens, dans la limite de ce plafond : au-delà, le
// chapitre deviendrait un fourre-tout et le prompt trop long. Les souvenirs restants attendent la
// synthèse suivante.
export const MAX_NOTES_PAR_CHAPITRE = 50;
export const MAX_INSTRUCTIONS_PAR_CHAPITRE = 20;

// Une note dictée dépasse rarement quelques centaines de caractères — garde-fou contre un envoi
// anormal, pas une contrainte d'usage.
export const LONGUEUR_MAX_NOTE = 5000;
export const LONGUEUR_MAX_STYLE = 2000;

// Deux sortes de notes : un souvenir (matière du chapitre) ou une instruction (consigne pour écrire
// le prochain chapitre, ex. « parle surtout de mon père »). Une note sans type, créée avant
// l'introduction des instructions, est un souvenir.
export const TYPES_NOTE = ['souvenir', 'instruction'];
export const typeNote = (note) => (note.type === 'instruction' ? 'instruction' : 'souvenir');

// Paramètres d'un membre (affichés dans Settings) :
// - supprimerNotesApresSynthese : par défaut true — les notes disparaissent une fois le chapitre
//   écrit ; seul un `false` explicite les conserve ;
// - styleSynthese : complément de prompt libre, appliqué à chaque synthèse ('' = style par défaut).
export function normaliserParametres(donnees) {
  return {
    supprimerNotesApresSynthese: donnees?.supprimerNotesApresSynthese !== false,
    styleSynthese: typeof donnees?.styleSynthese === 'string' ? donnees.styleSynthese.trim() : '',
  };
}

// Notes pas encore synthétisées, de la plus ancienne à la plus récente, séparées en souvenirs et
// instructions, chacun plafonné.
export function selectionnerPourSynthese(notes) {
  const disponibles = notes
    .filter((note) => !note.chapitreId && typeof note.texte === 'string' && note.texte.trim())
    .sort((a, b) => (a.dateCreation || '').localeCompare(b.dateCreation || ''));
  return {
    souvenirs: disponibles.filter((n) => typeNote(n) === 'souvenir').slice(0, MAX_NOTES_PAR_CHAPITRE),
    instructions: disponibles.filter((n) => typeNote(n) === 'instruction').slice(0, MAX_INSTRUCTIONS_PAR_CHAPITRE),
  };
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

const STYLE_PAR_DEFAUT = 'un style simple, chaleureux et naturel';

// Trame du prompt : « prends toutes mes notes, fais-en la synthèse, applique le style défini dans
// les paramètres et applique les instructions suivantes ». Le style et les instructions viennent
// du membre ; la fidélité aux souvenirs (rien d'inventé) reste une règle qu'ils ne peuvent pas lever.
//
// `souvenirs` / `instructions` : notes ({ texte, dateCreation }), de la plus ancienne à la plus
// récente. `style` : paramètre styleSynthese ('' = style par défaut). `chapitresPrecedents` :
// chapitres déjà écrits ({ titre }), pour la continuité.
export function construireRequeteChapitre({
  souvenirs, instructions = [], style = '', chapitresPrecedents = [],
}) {
  const consigneStyle = style.trim()
    ? `Applique le style défini dans ses paramètres :
"""
${style.trim()}
"""`
    : `Écris dans ${STYLE_PAR_DEFAUT}.`;

  const consigneInstructions = instructions.length > 0
    ? `

Applique les instructions suivantes, qu'elle a données pour ce chapitre :
${instructions.map((n) => `- ${n.texte.trim()}`).join('\n')}`
    : '';

  const contexteChapitres = chapitresPrecedents.length > 0
    ? `

Chapitres déjà écrits dans ses mémoires (ne les répète pas ; tu peux y faire allusion si un
souvenir s'y rattache naturellement) :
${chapitresPrecedents.map((c, i) => `${i + 1}. "${c.titre}"`).join('\n')}`
    : '';

  const texteSouvenirs = souvenirs
    .map((note, i) => `${i + 1}. [${(note.dateCreation || '').slice(0, 10)}] ${note.texte.trim()}`)
    .join('\n');

  const prompt = `Tu aides une personne âgée à écrire ses mémoires. Elle a dicté à voix haute les
notes ci-dessous ; c'est une transcription automatique : il peut y avoir des mots mal reconnus, des
répétitions, des hésitations ou une ponctuation absente.

Prends toutes ses notes et fais-en la synthèse sous la forme d'UN chapitre de ses mémoires.

${consigneStyle}${consigneInstructions}

Quels que soient le style et les instructions, respecte toujours ces règles :
- écris à la première personne ("je"), comme si elle l'écrivait elle-même ;
- reste fidèle aux notes : n'invente aucun fait, nom, date, lieu ni sentiment qui n'y figure pas.
  Tu peux ordonner, relier et reformuler les souvenirs, et corriger une erreur de transcription
  évidente ;
- si les notes évoquent plusieurs souvenirs sans lien entre eux, garde-les tous, enchaînés avec
  naturel ;
- rédige en paragraphes séparés par une ligne vide, sans intertitre, sans liste, sans Markdown ;
- donne au chapitre un titre court et évocateur (sans le mot "Chapitre" ni numéro).${contexteChapitres}

Notes dictées, de la plus ancienne à la plus récente :
${texteSouvenirs}

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
