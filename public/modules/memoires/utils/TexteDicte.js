// Mise en forme du texte reconnu par la dictée vocale — fonctions pures, testables sans navigateur.
// La reconnaissance vocale ne ponctue pas (ou peu) : chaque segment reconnu (une phrase prononcée
// d'une traite, entre deux pauses) devient une phrase, avec majuscule et point final.

export function mettreEnPhrase(segment) {
  const texte = (segment || '').replace(/\s+/g, ' ').trim();
  if (!texte) return '';
  const avecMajuscule = texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1);
  return /[.!?…]$/.test(avecMajuscule) ? avecMajuscule : `${avecMajuscule}.`;
}

export function assemblerDictee(segments) {
  return segments.map(mettreEnPhrase).filter(Boolean).join(' ');
}

// Ajoute le texte dicté à la suite de ce qui était déjà dans la zone de saisie.
export function joindreTextes(...morceaux) {
  return morceaux.map((m) => (m || '').trim()).filter(Boolean).join(' ');
}
