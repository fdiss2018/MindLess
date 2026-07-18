import { Router } from 'express';
import { UtilisateurRepository } from '../repositories/UtilisateurRepository.js';
import { Utilisateur } from '../domain/Utilisateur.js';
import { requireUid } from '../middleware/requireUid.js';

export const utilisateursRouter = Router();

utilisateursRouter.use(requireUid);

// Get-or-create : reproduit UtilisateurService.obtenirOuCreerUtilisateur côté
// backend, à partir des informations du token Firebase (email/nom/photo)
// plutôt que d'un objet utilisateur Google passé par le front.
utilisateursRouter.get('/moi', async (req, res, next) => {
  try {
    const existant = await UtilisateurRepository.obtenir(req.uid);
    if (existant) return res.json(existant);

    const utilisateur = new Utilisateur({
      id: req.uid,
      email: req.profilGoogle?.email || '',
      nomAffiche: req.profilGoogle?.nomAffiche || '',
      photoUrl: req.profilGoogle?.photoUrl || '',
      foyerId: null,
    });
    await UtilisateurRepository.creer(utilisateur);
    res.status(201).json(utilisateur);
  } catch (err) { next(err); }
});

utilisateursRouter.put('/moi/foyer', async (req, res, next) => {
  try {
    await UtilisateurRepository.mettreAJour(req.uid, { foyerId: req.body.foyerId });
    res.status(204).end();
  } catch (err) { next(err); }
});

utilisateursRouter.put('/moi/profil-nutritionnel', async (req, res, next) => {
  try {
    await UtilisateurRepository.mettreAJour(req.uid, { profilNutritionnel: req.body });
    res.status(204).end();
  } catch (err) { next(err); }
});
