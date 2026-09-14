import { Router } from 'express';
import { FoyerRepository } from '../repositories/FoyerRepository.js';
import { UtilisateurRepository } from '../repositories/UtilisateurRepository.js';
import { requireUid } from '../middleware/requireUid.js';
import { requireMembreFoyer } from '../middleware/requireMembreFoyer.js';

export const foyersRouter = Router();

foyersRouter.use(requireUid);

foyersRouter.post('/', async (req, res, next) => {
  try {
    const foyer = await FoyerRepository.creer(req.body.nom, req.uid);
    res.status(201).json(foyer);
  } catch (err) { next(err); }
});

foyersRouter.post('/:id/rejoindre', async (req, res, next) => {
  try {
    const code = req.params.id.trim().toUpperCase();
    const foyer = await FoyerRepository.rejoindre(code, req.uid);
    res.json(foyer);
  } catch (err) { next(err); }
});

// Résout le nom affiché du créateur du foyer — le client ne peut pas lire utilisateurs/{uid}
// directement (firestore.rules), seul le backend via le SDK Admin le peut (même limite documentée
// dans CLAUDE.md, déjà contournée ailleurs pour le bilan nutritionnel, voir menus/routes/nutrition.js).
// Note : `:foyerId` (et non `:id` comme les routes ci-dessus) car requireMembreFoyer lit
// req.params.foyerId.
foyersRouter.get('/:foyerId/createur', requireMembreFoyer, async (req, res, next) => {
  try {
    const createur = await UtilisateurRepository.obtenir(req.foyer.creePar);
    res.json({ uid: req.foyer.creePar, nomAffiche: createur?.nomAffiche || null });
  } catch (err) { next(err); }
});
