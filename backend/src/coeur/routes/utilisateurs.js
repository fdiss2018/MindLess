import { Router } from 'express';
import { UtilisateurRepository } from '../repositories/UtilisateurRepository.js';
import { requireUid } from '../middleware/requireUid.js';

export const utilisateursRouter = Router();

utilisateursRouter.use(requireUid);

utilisateursRouter.get('/moi', async (req, res, next) => {
  try {
    const { utilisateur, cree } = await UtilisateurRepository.obtenirOuCreer(req.uid, req.profilGoogle);
    res.status(cree ? 201 : 200).json(utilisateur);
  } catch (err) { next(err); }
});

utilisateursRouter.put('/moi/foyer', async (req, res, next) => {
  try {
    await UtilisateurRepository.mettreAJour(req.uid, { foyerId: req.body.foyerId });
    res.status(204).end();
  } catch (err) { next(err); }
});
