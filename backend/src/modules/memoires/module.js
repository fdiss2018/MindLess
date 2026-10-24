import { memoiresRouter } from './routes/memoires.js';

// Manifeste du module memoires — monté par le cœur (coeur/monterModule.js), qui applique à chaque
// route le contrôle d'accès au module. Chemins relatifs à /api/foyers/:foyerId/.
export const moduleMemoires = {
  id: 'memoires',
  routes: {
    memoires: memoiresRouter,
  },
};
