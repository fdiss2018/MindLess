import { IDS_MODULES } from './domain/AccesModules.js';
import { requireUid } from './middleware/requireUid.js';
import { requireMembreFoyer } from './middleware/requireMembreFoyer.js';
import { requireModule } from './middleware/requireModule.js';

// Point de branchement d'un module fonctionnel sur le cœur. Chaque module décrit ses routes dans son
// manifeste (modules/<id>/module.js) et ne pose jamais lui-même de contrôle d'accès : c'est ici que
// toutes ses routes reçoivent, dans cet ordre, requireUid → requireMembreFoyer → requireModule(id).
// Une route de module ne peut donc pas être exposée sans le contrôle d'accès du cœur.
//
// Manifeste attendu :
//   { id, routes: { '<chemin>': router }, routesPubliques?: { '<chemin>': router } }
// - routes          : montées sur /api/foyers/:foyerId/<chemin> (routers en mergeParams: true) ;
// - routesPubliques : montées sur /api/public/foyers/:foyerId/<chemin>, SANS authentification ni
//   contrôle d'accès — réservé à un choix explicite et documenté (voir veille/routes/articlesPublics.js).
//
// `authentifier` n'est pas reposé ici : server.js l'applique une fois pour tout /api.
export function monterModule(app, { id, routes = {}, routesPubliques = {} }) {
  if (!IDS_MODULES.includes(id)) {
    throw new Error(`Module "${id}" absent du catalogue (coeur/domain/AccesModules.js).`);
  }

  for (const [chemin, router] of Object.entries(routes)) {
    app.use(`/api/foyers/:foyerId/${chemin}`, requireUid, requireMembreFoyer, requireModule(id), router);
  }

  for (const [chemin, router] of Object.entries(routesPubliques)) {
    app.use(`/api/public/foyers/:foyerId/${chemin}`, router);
  }
}
