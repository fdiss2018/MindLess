import { Router } from 'express';
import { ListeCoursesRepository } from '../repositories/ListeCoursesRepository.js';
import { ListeCoursesItem } from '../domain/ListeCoursesItem.js';
import { fusionnerAvecListeExistante } from '../domain/GenerateurListeCourses.js';
import { listerIngredientsSemaine } from '../../menus/api.js';

// Monté sur /api/foyers/:foyerId/liste-courses
export const listeCoursesRouter = Router({ mergeParams: true });

listeCoursesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await ListeCoursesRepository.lister(req.params.foyerId));
  } catch (err) { next(err); }
});

listeCoursesRouter.post('/', async (req, res, next) => {
  try {
    const maintenant = new Date().toISOString();
    const item = new ListeCoursesItem({ ...req.body, dateAjout: maintenant, dateMaj: maintenant });
    const id = await ListeCoursesRepository.ajouter(req.params.foyerId, item);
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

// Orchestre besoins de la semaine (module menus, via son API publique) + fusion
// + écriture batch. Seule dépendance de courses vers un autre module : elle passe
// par modules/menus/api.js, jamais par les repositories ou le domaine de menus.
listeCoursesRouter.post('/generer', async (req, res, next) => {
  try {
    const { foyerId } = req.params;
    const { idSemaine } = req.body;

    const itemsGeneres = await listerIngredientsSemaine(foyerId, idSemaine);
    const itemsExistants = await ListeCoursesRepository.lister(foyerId);
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(itemsGeneres, itemsExistants);

    await ListeCoursesRepository.ecrireLot(foyerId, itemsACreer, itemsAModifier);
    res.json({ crees: itemsACreer.length, modifies: itemsAModifier.length });
  } catch (err) { next(err); }
});

listeCoursesRouter.patch('/:itemId/coche', async (req, res, next) => {
  try {
    await ListeCoursesRepository.basculerCoche(req.params.foyerId, req.params.itemId, req.body.coche);
    res.status(204).end();
  } catch (err) { next(err); }
});

// Liste blanche des champs modifiables — sans ça, req.body passé tel quel à Firestore
// laisserait n'importe quel membre réécrire dateAjout.
const CHAMPS_MODIFIABLES = ['nom', 'quantite', 'unite', 'categorie', 'coche', 'origine', 'recetteIds'];

listeCoursesRouter.patch('/:itemId', async (req, res, next) => {
  try {
    const donnees = {};
    for (const champ of CHAMPS_MODIFIABLES) {
      if (champ in req.body) donnees[champ] = req.body[champ];
    }
    donnees.dateMaj = new Date().toISOString();
    await ListeCoursesRepository.modifier(req.params.foyerId, req.params.itemId, donnees);
    res.status(204).end();
  } catch (err) { next(err); }
});

listeCoursesRouter.delete('/:itemId', async (req, res, next) => {
  try {
    await ListeCoursesRepository.supprimer(req.params.foyerId, req.params.itemId);
    res.status(204).end();
  } catch (err) { next(err); }
});
