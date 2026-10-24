export function requireUid(req, res, next) {
  if (!req.uid) {
    return res.status(400).json({ erreur: 'Utilisateur non résolu (token manquant ou invalide).' });
  }
  next();
}
