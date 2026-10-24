import { vehiculesRouter } from './routes/vehicules.js';
import { entretiensRouter } from './routes/entretiens.js';

// Manifeste du module voiture — monté par le cœur (coeur/monterModule.js), qui applique à chaque
// route le contrôle d'accès au module. Chemins relatifs à /api/foyers/:foyerId/.
export const moduleVoiture = {
  id: 'voiture',
  routes: {
    vehicules: vehiculesRouter,
    'vehicules/:vehiculeId/entretiens': entretiensRouter,
  },
};
