// Restreint une route au créateur du foyer (foyer.creePar) — utilisé pour les actions
// d'administration à l'échelle du foyer (ex. lignes éditoriales de veille, voir
// veille/routes/lignesEditoriales.js). Suppose que requireMembreFoyer s'est déjà exécuté avant
// (pose req.foyer) : pas de nouvelle lecture Firestore ici.
export function requireCreateurFoyer(req, res, next) {
  if (req.foyer.creePar !== req.uid) {
    return res.status(403).json({ erreur: 'Seul le créateur du foyer peut effectuer cette action.' });
  }
  next();
}
