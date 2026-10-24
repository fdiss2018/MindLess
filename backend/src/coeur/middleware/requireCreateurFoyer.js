import { estAdministrateur } from '../domain/AccesModules.js';

// Restreint une route à l'administrateur du foyer, c'est-à-dire son créateur (foyer.creePar) —
// utilisé pour les actions d'administration à l'échelle du foyer (droits d'accès aux modules, voir
// coeur/routes/foyers.js ; lignes éditoriales de veille, voir modules/veille/routes/lignesEditoriales.js).
// Suppose que requireMembreFoyer s'est déjà exécuté avant (pose req.foyer) : pas de nouvelle lecture
// Firestore ici.
export function requireCreateurFoyer(req, res, next) {
  if (!estAdministrateur(req.foyer, req.uid)) {
    return res.status(403).json({ erreur: 'Seul le créateur du foyer peut effectuer cette action.' });
  }
  next();
}
