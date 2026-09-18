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
  economie_finances: { libelle: 'Économie et finances', accentTendances: false },
  societe: {
    libelle: 'Société, justice et social (grèves, syndicats, réformes, éducation, santé, immigration...)',
    accentTendances: false,
  },
  international: {
    libelle: 'International (géopolitique, conflits, Union européenne, grandes puissances)',
    accentTendances: false,
  },
  economie_entreprises: {
    libelle: 'Économie et entreprises (marchés financiers, tech, transition énergétique)',
    accentTendances: true,
  },
  actualite_locale: { libelle: 'Actualité locale', accentTendances: false },
};
