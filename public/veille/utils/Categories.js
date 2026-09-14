// Copie assumée de backend/src/veille/domain/Categories.js (pas de monorepo/package partagé
// entre front et backend). Fonction pure, n'importe jamais Firebase.
export const CATEGORIES = {
  politique: { libelle: 'Actualité politique', accentTendances: false },
  marseille: { libelle: 'Actualités de Marseille', accentTendances: false },
  culture: { libelle: 'Culture et art contemporain (musique, art, photo)', accentTendances: false },
  sortir_marseille: {
    libelle: 'Sortir sur Marseille (expositions, théâtre, animations, nouveaux restaurants)',
    accentTendances: false,
  },
  ecologie: { libelle: 'Actualité écologique', accentTendances: true },
  ia: { libelle: "Actualité sur l'intelligence artificielle", accentTendances: true },
};
