// Catalogue des modules fonctionnels, côté présentation : libellé, icône, page d'entrée. Les
// identifiants sont une copie assumée de backend/src/coeur/domain/AccesModules.js (IDS_MODULES) ;
// les DROITS, eux, ne sont jamais recalculés côté front — ils viennent de GET /api/session (voir
// services/Session.js), seul le backend décide.
//
// `badgeAccueil: true` : le module fournit public/modules/<id>/accueil.js, qui exporte
// `calculerBadge(foyerId)` (nombre à afficher sur sa tuile d'accueil, 0 = pas de badge). C'est le
// point d'extension par lequel un module contribue à index.html sans que le cœur importe son code.
export const MODULES = [
  { id: 'voiture', libelle: 'Voiture', icone: '🚗', page: 'voiture.html', badgeAccueil: true },
  { id: 'courses', libelle: 'Courses', icone: '🛒', page: 'courses.html' },
  { id: 'menus', libelle: 'Menus', icone: '🍽️', page: 'menus.html' },
  { id: 'veille', libelle: 'Veille', icone: '🗞️', page: 'veille.html' },
];
