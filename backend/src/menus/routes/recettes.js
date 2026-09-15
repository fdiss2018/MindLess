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
        // Array.isArray plutôt que de compter sur la valeur par défaut du constructeur : celle-ci
        // ne se déclenche que sur `undefined`, pas sur `ingredients: null` explicite (ex. export
        // JSON malformé) — sans ce garde-fou, .ingredients.length plante tout l'import ci-dessous
        // au lieu de n'ignorer que cette entrée.
        ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
        instructions: item.instructions,
        tags: Array.isArray(item.tags) ? item.tags : [],
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

// Liste blanche des champs modifiables — sans ça, req.body passé tel quel à Firestore
// laisserait n'importe quel membre réécrire creePar/dateCreation.
const CHAMPS_MODIFIABLES = ['nom', 'portions', 'ingredients', 'instructions', 'tags'];

recettesRouter.put('/:recetteId', async (req, res, next) => {
  try {
    const donnees = {};
    for (const champ of CHAMPS_MODIFIABLES) {
      if (champ in req.body) donnees[champ] = req.body[champ];
    }
    await RecetteRepository.modifier(req.params.foyerId, req.params.recetteId, donnees);
    res.status(204).end();
  } catch (err) { next(err); }
});

recettesRouter.delete('/:recetteId', async (req, res, next) => {
  try {
    await RecetteRepository.supprimer(req.params.foyerId, req.params.recetteId);
    res.status(204).end();
  } catch (err) { next(err); }
});
