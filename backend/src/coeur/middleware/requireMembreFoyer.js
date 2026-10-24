import { FoyerRepository } from '../repositories/FoyerRepository.js';

// Équivalent backend de estMembreDuFoyer() dans firestore.rules : vérifie que
// req.uid (déjà résolu par requireUid) figure bien dans foyer.membres avant de
// laisser passer une requête sur une sous-ressource (:foyerId dans l'URL).
export async function requireMembreFoyer(req, res, next) {
  try {
    const { foyerId } = req.params;
    const foyer = await FoyerRepository.obtenir(foyerId);

    if (!foyer) return res.status(404).json({ erreur: 'Foyer introuvable.' });
    if (!foyer.membres.includes(req.uid)) {
      return res.status(403).json({ erreur: "Vous n'êtes pas membre de ce foyer." });
    }

    req.foyer = foyer;
    next();
  } catch (err) { next(err); }
}
