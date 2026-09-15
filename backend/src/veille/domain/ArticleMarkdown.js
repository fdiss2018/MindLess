// Parseur minimal de front-matter (pas de dépendance YAML : seuls titre/categorie/motsCles sont
// attendus, une paire clé/valeur par ligne — un vrai parseur YAML serait disproportionné ici).
const REGEX_FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Sépare, dans le corps, une éventuelle version audio d'une version à lire — voir
// separerAudio ci-dessous pour le format exact attendu.
const SEPARATEUR_AUDIO = /\r?\n-{3,}\s*audio\s*-{3,}\r?\n/i;

function parserEntetes(bloc) {
  const entetes = {};
  bloc.split(/\r?\n/).forEach((ligne) => {
    const separateur = ligne.indexOf(':');
    if (separateur === -1) return;
    const cle = ligne.slice(0, separateur).trim();
    const valeur = ligne.slice(separateur + 1).trim();
    if (cle) entetes[cle] = valeur;
  });
  return entetes;
}

// Un corps peut contenir une ligne "--- AUDIO ---" (tirets flexibles, insensible à la casse) qui
// sépare la version à lire (avant) de la version à écouter (après) — même principe que les deux
// versions produites par la génération IA (voir InterpreterArticleIA.js). Sans ce séparateur,
// contenuAudio reste `null` et l'app retombe sur `contenu` pour la lecture à voix haute.
function separerAudio(corps) {
  const parties = corps.split(SEPARATEUR_AUDIO);
  return {
    contenu: parties[0].trim(),
    contenuAudio: parties.length > 1 ? parties[1].trim() : null,
  };
}

// Extrait { titre, categorie, contenu, contenuAudio, motsCles } d'un fichier .md avec front-matter :
//   ---
//   titre: Mon article
//   categorie: ia
//   motsCles: mcp, claude, anthropic
//   ---
//   Corps de l'article, à lire à l'écran...
//
//   --- AUDIO ---
//   Même contenu réécrit pour être écouté (optionnel)...
// `motsCles` est optionnel (chaîne brute séparée par des virgules, à normaliser par l'appelant via
// Article.normaliserMotsCles). Retourne titre/categorie à null si le front-matter est absent ou
// incomplet — la route (routes/articles.js) décide alors de rejeter l'import (400) plutôt que de
// créer un article partiel.
export function parserMarkdown(contenuBrut) {
  const correspondance = REGEX_FRONT_MATTER.exec(contenuBrut || '');
  if (!correspondance) {
    const { contenu, contenuAudio } = separerAudio(contenuBrut || '');
    return {
      titre: null, categorie: null, contenu, contenuAudio, motsCles: '',
    };
  }

  const entetes = parserEntetes(correspondance[1]);
  const { contenu, contenuAudio } = separerAudio(correspondance[2]);
  return {
    titre: entetes.titre || null,
    categorie: entetes.categorie || null,
    contenu,
    contenuAudio,
    motsCles: entetes.motsCles || '',
  };
}
