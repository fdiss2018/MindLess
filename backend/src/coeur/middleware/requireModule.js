import { aAccesModule } from '../domain/AccesModules.js';

// Restreint une route aux membres à qui l'administrateur du foyer a ouvert le module. Jamais posé à
// la main dans un module : monterModule (coeur/monterModule.js) l'applique à toutes les routes d'un
// module, après requireMembreFoyer (qui pose req.foyer — pas de nouvelle lecture Firestore ici).
export function requireModule(idModule) {
  return (req, res, next) => {
    if (!aAccesModule(req.foyer, req.uid, idModule)) {
      return res.status(403).json({ erreur: `Le module "${idModule}" ne t'est pas ouvert dans ce foyer.` });
    }
    next();
  };
}
