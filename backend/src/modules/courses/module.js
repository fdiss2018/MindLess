import { listeCoursesRouter } from './routes/listeCourses.js';

// Manifeste du module courses — monté par le cœur (coeur/monterModule.js), qui applique à chaque
// route le contrôle d'accès au module. Chemins relatifs à /api/foyers/:foyerId/.
// Dépend du module menus (génération depuis le planning), uniquement via modules/menus/api.js.
export const moduleCourses = {
  id: 'courses',
  routes: {
    'liste-courses': listeCoursesRouter,
  },
};
