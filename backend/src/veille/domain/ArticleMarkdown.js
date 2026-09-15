// Parseur minimal de front-matter (pas de dépendance YAML : seuls titre/categorie sont attendus,
// une paire clé/valeur par ligne — un vrai parseur YAML serait disproportionné ici).
const REGEX_FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

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

// Extrait { titre, categorie, contenu, motsCles } d'un fichier .md avec front-matter :
//   ---
//   titre: Mon article
//   categorie: ia
//   motsCles: mcp, claude, anthropic
//   ---
//   Corps de l'article...
// `motsCles` est optionnel (chaîne brute séparée par des virgules, à normaliser par l'appelant via
// Article.normaliserMotsCles). Retourne titre/categorie à null si le front-matter est absent ou
// incomplet — la route (routes/articles.js) décide alors de rejeter l'import (400) plutôt que de
// créer un article partiel.
export function parserMarkdown(contenuBrut) {
  const correspondance = REGEX_FRONT_MATTER.exec(contenuBrut || '');
  if (!correspondance) {
    return {
      titre: null, categorie: null, contenu: (contenuBrut || '').trim(), motsCles: '',
    };
  }

  const entetes = parserEntetes(correspondance[1]);
  return {
    titre: entetes.titre || null,
    categorie: entetes.categorie || null,
    contenu: correspondance[2].trim(),
    motsCles: entetes.motsCles || '',
  };
}
