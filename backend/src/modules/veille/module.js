import { articlesRouter } from './routes/articles.js';
import { lignesEditorialesRouter } from './routes/lignesEditoriales.js';
import { articlesPublicsRouter } from './routes/articlesPublics.js';

// Manifeste du module veille — monté par le cœur (coeur/monterModule.js), qui applique à chaque
// route le contrôle d'accès au module. Chemins relatifs à /api/foyers/:foyerId/.
export const moduleVeille = {
  id: 'veille',
  routes: {
    articles: articlesRouter,
    'lignes-editoriales': lignesEditorialesRouter,
  },
  // Volontairement sans authentification : route publique par choix explicite de l'utilisateur,
  // voir routes/articlesPublics.js et CLAUDE.md ("Limite assumée"). Relative à /api/public/foyers/:foyerId/.
  routesPubliques: {
    articles: articlesPublicsRouter,
  },
};
