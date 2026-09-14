import { Router } from 'express';
import { LigneEditorialeRepository } from '../repositories/LigneEditorialeRepository.js';
import { CATEGORIES, LIGNES_EDITORIALES_PAR_DEFAUT } from '../domain/Categories.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';
import { requireCreateurFoyer } from '../../commun/middleware/requireCreateurFoyer.js';

// Monté sur /api/foyers/:foyerId/lignes-editoriales
export const lignesEditorialesRouter = Router({ mergeParams: true });

lignesEditorialesRouter.use(requireUid, requireMembreFoyer);

// Lecture ouverte à tout membre du foyer (nécessaire pour que la génération IA utilise la bonne
// ligne éditoriale, quel que soit le membre qui déclenche la génération) — seule l'écriture est
// réservée au créateur du foyer (requireCreateurFoyer).
lignesEditorialesRouter.get('/', async (req, res, next) => {
  try {
    const personnalisees = await LigneEditorialeRepository.obtenir(req.params.foyerId);
    const resultat = {};
    for (const cle of Object.keys(CATEGORIES)) {
      resultat[cle] = personnalisees[cle] ?? LIGNES_EDITORIALES_PAR_DEFAUT[cle] ?? '';
    }
    res.json(resultat);
  } catch (err) { next(err); }
});

lignesEditorialesRouter.put('/', requireCreateurFoyer, async (req, res, next) => {
  try {
    const lignes = {};
    for (const cle of Object.keys(CATEGORIES)) {
      if (typeof req.body[cle] === 'string') lignes[cle] = req.body[cle];
    }
    await LigneEditorialeRepository.enregistrer(req.params.foyerId, lignes);
    res.status(204).end();
  } catch (err) { next(err); }
});
