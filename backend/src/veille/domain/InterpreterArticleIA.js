import { CATEGORIES } from './Categories.js';

// Active le grounding Google Search côté Gemini sur chaque génération — nécessite que le projet
// GCP derrière GEMINI_API_KEY ait la facturation Cloud activée, sans quoi l'appel échoue en 429
// (voir CLAUDE.md "veille", tenté sans facturation en 2026-09 et écarté, retesté avec facturation
// activée). Le modèle décide lui-même, par appel, s'il déclenche réellement une recherche — ce
// n'est jamais garanti à chaque génération, d'où la formulation conditionnelle des règles
// anti-hallucination plus bas plutôt qu'une simple suppression de ces règles.
const OUTIL_RECHERCHE_GOOGLE = [{ google_search: {} }];

// IMPORTANT — vérifié empiriquement (2026-09, gemini-3.5-flash-lite, endpoint v1beta) :
// `responseSchema`/`responseMimeType` combinés à `tools: google_search` empêchent
// systématiquement le grounding de se déclencher (0 succès sur 7 essais avec schéma, contre
// grounding effectif sur le même prompt sans schéma) — malgré la documentation Google indiquant
// que Gemini 3 supporte cette combinaison. Le JSON est donc demandé par instruction dans le prompt
// ci-dessous plutôt que par `responseSchema` ; GeminiClient.js s'appuie sur son JSON.parse +
// retry DEGENERE existant comme filet de sécurité pour ce mode "JSON en texte libre".

// Construit le corps de requête envoyé à l'API Gemini (generateContent) — voir
// repositories/GeminiClient.js pour l'appel réseau. Fonction pure, aucun appel réseau ici (même
// séparation que homeFit/backend/src/domain/InterpreterExerciceIA.js).
//
// `ligneEditoriale` (optionnelle) : persona/prompt système défini par le créateur du foyer pour
// cette catégorie (voir routes/lignesEditoriales.js) — remplace le paragraphe générique
// ci-dessous quand elle est fournie, mais les règles de format et la mise en garde anti-
// hallucination restent toujours appliquées, y compris avec une ligne éditoriale personnalisée.
//
// `articlesPrecedents` (optionnel) : les derniers articles déjà publiés dans cette catégorie pour
// ce foyer (voir routes/articles.js POST /generer, ArticleRepository.lister + Article.extraireResume),
// du plus récent au plus ancien — donne à l'IA de quoi assurer une continuité (ne pas répéter ce
// qui est déjà couvert, signaler explicitement ce qui a changé) sans lui envoyer chaque article en
// entier. Chaque entrée : { titre, dateCreation, extrait }.
export function construireRequeteArticleIA({
  categorie, sujet, ligneEditoriale, articlesPrecedents = [],
}) {
  const { libelle, accentTendances } = CATEGORIES[categorie];

  const persona = ligneEditoriale && ligneEditoriale.trim()
    ? ligneEditoriale.trim()
    : `Tu rédiges un article court pour la rubrique "${libelle}" d'une application
d'actualités familiale.
${accentTendances ? "Mets particulièrement en avant les tendances émergentes du moment sur ce sujet, plutôt qu'un simple résumé générique." : ''}`;

  const contexteArticlesPrecedents = articlesPrecedents.length > 0
    ? `

Articles déjà publiés sur ce sujet dans cette application, du plus récent au plus ancien — appuie-toi
dessus pour assurer une continuité : ne répète pas une information déjà couverte sauf si elle a
évolué depuis (dans ce cas, dis-le explicitement, ex. "Depuis notre article du [date] sur [titre],
..."), et tu peux faire référence à l'un d'eux par son titre plutôt que de tout ré-expliquer.
${articlesPrecedents.map((a) => `- [${(a.dateCreation || '').slice(0, 10)}] "${a.titre}" — ${a.extrait}`).join('\n')}`
    : '';

  const prompt = `${persona}${contexteArticlesPrecedents}
${sujet ? `\nSujet précis demandé par l'utilisateur : "${sujet}".` : ''}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balise de code
(pas de \`\`\`json\`\`\`), de cette forme exacte :
{
  "titre": "Titre accrocheur de l'article",
  "contenu": "Version à LIRE à l'écran : plusieurs paragraphes, texte brut sans markdown.",
  "contenuAudio": "Version à ÉCOUTER : même information, réécrite pour l'oral.",
  "motsCles": ["mot-clé 1", "mot-clé 2"]
}

Règles à respecter :
- "titre" est court (une phrase maximum), sans guillemets ni ponctuation finale superflue.
- "motsCles" contient 3 à 6 mots-clés courts (1-3 mots chacun, en français, sans "#"), utiles pour
  retrouver cet article par filtre plus tard — noms de modèles/outils/entreprises cités, thème
  précis abordé. Pas de mot-clé générique du type "intelligence artificielle" ou le nom de la
  catégorie elle-même, qui n'apportent rien pour filtrer.
- "contenu" fait 3 à 5 paragraphes, en français, factuel et neutre, texte brut (aucun symbole de
  mise en forme : pas de "#", "*", "-" de liste, tirets de titre...).
- "contenuAudio" porte la même information que "contenu", mais réécrite pour être entendue plutôt
  que lue : phrases courtes, transitions naturelles à l'oral ("ensuite", "par ailleurs"...), aucun
  sigle ni acronyme qui se prononce mal tel quel (développe-le au moins une fois), aucun symbole de
  mise en forme. Ce n'est pas un résumé plus court : la même information, sous une autre forme.
- Tu as accès à un outil de recherche Google (recherche web réelle) : utilise-le chaque fois
  qu'une information factuelle datée (évènement récent, chiffre, annonce, sortie de produit...)
  est pertinente pour cet article, pour la vérifier avant de l'inclure.
- Cet outil ne se déclenche pas forcément à chaque génération : si tu ne l'as pas utilisé, ou s'il
  n'a rien retourné de pertinent sur un point précis, ne présente jamais ce point comme confirmé —
  reste alors sur des faits et tendances généraux plutôt que d'inventer un évènement daté précis.
- N'utilise les expressions "cette semaine", "cette quinzaine", "récemment", "dernièrement",
  "synthèse hebdomadaire/de la semaine", "point hebdomadaire" (ou toute formule équivalente) que si
  une recherche a effectivement confirmé un fait précis et daté de cette période ; sinon, reformule
  sans référence temporelle relative (ex. "actuellement", "aujourd'hui" restent acceptables, une
  date ou une période précise inventée ne l'est pas).`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    tools: OUTIL_RECHERCHE_GOOGLE,
    // Pas de responseMimeType/responseSchema ici — voir la note ci-dessus sur leur incompatibilité
    // empirique avec le grounding sur ce modèle. Le format JSON est entièrement porté par
    // l'instruction du prompt.
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.4,
    },
  };
}

// Transforme le groundingMetadata brut renvoyé par l'API Gemini (extrait de l'enveloppe HTTP par
// GeminiClient, au même titre que finishReason) en une liste de sources exploitables côté front —
// dédoublonnée par uri, tolérante à l'absence de grounding (le modèle n'a pas forcément cherché
// sur cet appel, voir OUTIL_RECHERCHE_GOOGLE ci-dessus).
export function extraireSourcesGrounding(groundingMetadata) {
  const chunks = groundingMetadata?.groundingChunks ?? [];
  const parUri = new Map();
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (uri && !parUri.has(uri)) parUri.set(uri, { uri, titre: chunk.web.title || uri });
  }
  return [...parUri.values()];
}

// Valide la réponse JSON déjà parsée par GeminiClient — un titre, un contenu ou une version audio
// vide n'a aucune chance d'être exploitable, mieux vaut échouer clairement que de créer un article
// incomplet (voir Article.contenuAudio, utilisé en priorité par le bouton "Écouter"). Des mots-clés
// absents/mal formés ne sont en revanche pas bloquants — ils dégradent juste le filtre, pas la
// lecture de l'article (voir motsCles, filtre côté client dans veille.html).
export function validerArticleIA(brut) {
  const titre = typeof brut?.titre === 'string' ? brut.titre.trim() : '';
  const contenu = typeof brut?.contenu === 'string' ? brut.contenu.trim() : '';
  const contenuAudio = typeof brut?.contenuAudio === 'string' ? brut.contenuAudio.trim() : '';
  const motsCles = Array.isArray(brut?.motsCles)
    ? brut.motsCles.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim())
    : [];

  if (!titre || !contenu || !contenuAudio) {
    throw new Error("L'IA n'a pas produit d'article exploitable, réessaie.");
  }

  return {
    titre, contenu, contenuAudio, motsCles,
  };
}
