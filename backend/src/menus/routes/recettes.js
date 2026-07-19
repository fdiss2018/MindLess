import { Router } from 'express';
import { RecetteRepository } from '../repositories/RecetteRepository.js';
import { Recette } from '../domain/Recette.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/recettes
export const recettesRouter = Router({ mergeParams: true });

recettesRouter.use(requireUid, requireMembreFoyer);

recettesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await RecetteRepository.lister(req.params.foyerId));
  } catch (err) { next(err); }
});

recettesRouter.post('/', async (req, res, next) => {
  try {
    const recette = new Recette({
      ...req.body, creePar: req.uid, dateCreation: new Date().toISOString(),
    });
    const id = await RecetteRepository.ajouter(req.params.foyerId, recette);
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

// Import en lot depuis un JSON exporté (voir recettes.html) — les entrées sans
// nom ni ingrédient sont ignorées plutôt que de faire échouer tout l'import.
recettesRouter.post('/importer', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.recettes) ? req.body.recettes : [];
    const maintenant = new Date().toISOString();

    const valides = items
      .map((item) => new Recette({
        nom: item.nom,
        portions: item.portions,
        ingredients: item.ingredients,
        instructions: item.instructions,
        tags: item.tags,
        creePar: req.uid,
        dateCreation: maintenant,
      }))
      .filter((recette) => recette.nom && recette.ingredients.length > 0);

    await Promise.all(valides.map((recette) => RecetteRepository.ajouter(req.params.foyerId, recette)));
    res.status(201).json({ importees: valides.length, ignorees: items.length - valides.length });
  } catch (err) { next(err); }
});

recettesRouter.get('/:recetteId', async (req, res, next) => {
  try {
    const recette = await RecetteRepository.obtenir(req.params.foyerId, req.params.recetteId);
    if (!recette) return res.status(404).json({ erreur: 'Recette introuvable.' });
    res.json(recette);
  } catch (err) { next(err); }
});

recettesRouter.put('/:recetteId', async (req, res, next) => {
  try {
    await RecetteRepository.modifier(req.params.foyerId, req.params.recetteId, req.body);
    res.status(204).end();
  } catch (err) { next(err); }
});

recettesRouter.delete('/:recetteId', async (req, res, next) => {
  try {
    await RecetteRepository.supprimer(req.params.foyerId, req.params.recetteId);
    res.status(204).end();
  } catch (err) { next(err); }
});
