// Catalogue des modules fonctionnels, côté présentation : libellé, icône, page d'entrée. Les
// identifiants sont une copie assumée de backend/src/coeur/domain/AccesModules.js (IDS_MODULES) ;
// les DROITS, eux, ne sont jamais recalculés côté front — ils viennent de GET /api/session (voir
// services/Session.js), seul le backend décide.
//
// Points d'extension — un module y contribue sans que le cœur importe son code : la page du cœur
// charge dynamiquement le fichier du module, et seulement si le module est ouvert à l'utilisateur.
// - `badgeAccueil: true` : le module fournit public/modules/<id>/accueil.js, qui exporte
//   `calculerBadge(foyerId)` (nombre à afficher sur sa tuile d'accueil, 0 = pas de badge) — chargé
//   par index.html.
// - `parametres: true` : le module fournit public/modules/<id>/parametres.js, qui exporte
//   `afficherParametres(conteneur, session)` (construit ses réglages dans `conteneur`, et les
//   enregistre lui-même) — chargé par settings.html, sous le nom du module.
export const MODULES = [
  { id: 'voiture', libelle: 'Voiture', icone: '🚗', page: 'voiture.html', badgeAccueil: true },
  { id: 'courses', libelle: 'Courses', icone: '🛒', page: 'courses.html' },
  { id: 'menus', libelle: 'Menus', icone: '🍽️', page: 'menus.html' },
  { id: 'veille', libelle: 'Veille', icone: '🗞️', page: 'veille.html' },
  { id: 'memoires', libelle: 'Memory', icone: '📖', page: 'memoires.html', parametres: true },
];
