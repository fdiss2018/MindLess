import { recettesRouter } from './routes/recettes.js';
import { planningRouter } from './routes/planning.js';
import { nutritionRouter } from './routes/nutrition.js';

// Manifeste du module menus — monté par le cœur (coeur/monterModule.js), qui applique à chaque
// route le contrôle d'accès au module. Chemins relatifs à /api/foyers/:foyerId/.
// Expose aussi une API publique aux autres modules : ./api.js.
export const moduleMenus = {
  id: 'menus',
  routes: {
    recettes: recettesRouter,
    planning: planningRouter,
    nutrition: nutritionRouter,
  },
};
