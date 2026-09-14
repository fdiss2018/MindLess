import { CATEGORIES } from './Categories.js';

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

Réponds UNIQUEMENT avec un objet JSON de cette forme :
{ "titre": "Titre accrocheur de l'article", "contenu": "Corps de l'article, plusieurs paragraphes, texte brut sans markdown." }

Règles à respecter :
- "titre" est court (une phrase maximum), sans guillemets ni ponctuation finale superflue.
- "contenu" fait 3 à 5 paragraphes, en français, factuel et neutre.
- Tu n'as pas accès à une source d'actualité en temps réel : ne présente jamais une information
  comme confirmée si tu n'en es pas certain, reste sur des faits et tendances généraux plutôt que
  d'inventer un évènement daté précis.`;

  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.4,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          titre: { type: 'STRING' },
          contenu: { type: 'STRING' },
        },
        required: ['titre', 'contenu'],
      },
    },
  };
}

// Valide la réponse JSON déjà parsée par GeminiClient — un titre ou un contenu vide n'a aucune
// chance d'être exploitable, mieux vaut échouer clairement que de créer un article vide.
export function validerArticleIA(brut) {
  const titre = typeof brut?.titre === 'string' ? brut.titre.trim() : '';
  const contenu = typeof brut?.contenu === 'string' ? brut.contenu.trim() : '';

  if (!titre || !contenu) {
    throw new Error("L'IA n'a pas produit d'article exploitable, réessaie.");
  }

  return { titre, contenu };
}
