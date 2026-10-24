import { Router } from 'express';
import { PlanningRepasRepository } from '../repositories/PlanningRepasRepository.js';
import { RecetteRepository } from '../repositories/RecetteRepository.js';
import { ProfilNutritionnelRepository } from '../repositories/ProfilNutritionnelRepository.js';
import { UtilisateurRepository } from '../../../coeur/repositories/UtilisateurRepository.js';
import { calculerPortionsConsommees, comparerBilanSemaine } from '../domain/AnalyseNutritionnelleSemaine.js';
import { resoudreProfil } from '../domain/ResoudreProfil.js';
import { obtenirObjectifsSemaine } from '../domain/ObjectifsNutritionnels.js';
import { getIdSemaine } from '../domain/DateSemaine.js';

// Monté sur /api/foyers/:foyerId/nutrition
export const nutritionRouter = Router({ mergeParams: true });

// Liste blanche des champs du profil — le body n'est jamais stocké tel quel.
const CHAMPS_PROFIL = ['sexe', 'anneeNaissance', 'niveauActivite', 'poidsKg'];

nutritionRouter.get('/profil', async (req, res, next) => {
  try {
    res.json(await ProfilNutritionnelRepository.obtenir(req.params.foyerId, req.uid));
  } catch (err) { next(err); }
});

nutritionRouter.put('/profil', async (req, res, next) => {
  try {
    const profil = {};
    for (const champ of CHAMPS_PROFIL) profil[champ] = req.body[champ] ?? null;
    await ProfilNutritionnelRepository.enregistrer(req.params.foyerId, req.uid, profil);
    res.status(204).end();
  } catch (err) { next(err); }
});

nutritionRouter.get('/bilan', async (req, res, next) => {
  try {
    const { foyerId } = req.params;
    const idSemaine = req.query.semaine || getIdSemaine(new Date());

    const planning = await PlanningRepasRepository.obtenirOuCreerSemaine(foyerId, idSemaine);
    const recettesParId = await RecetteRepository.obtenirParIds(foyerId, planning.idsRecettes());

    const portionsConsommees = calculerPortionsConsommees(planning, recettesParId);

    // req.foyer est déjà chargé par requireMembreFoyer (posé par le cœur, voir
    // coeur/monterModule.js) — on y lit la liste des membres plutôt que de refaire
    // une lecture Firestore. Le nom affiché vient du cœur, le profil de ce module.
    const membres = await Promise.all(req.foyer.membres.map(async (uid) => ({
      uid,
      utilisateur: await UtilisateurRepository.obtenir(uid),
      profil: await ProfilNutritionnelRepository.obtenir(foyerId, uid),
    })));

    const bilansParMembre = membres
      .filter(({ utilisateur, profil }) => utilisateur && profil)
      .map(({ uid, utilisateur, profil }) => {
        const cleProfil = resoudreProfil(profil);
        const objectifs = obtenirObjectifsSemaine(cleProfil);
        return {
          uid,
          nomAffiche: utilisateur.nomAffiche,
          cleProfil,
          comparaison: comparerBilanSemaine(portionsConsommees, objectifs),
        };
      });

    res.json({
      idSemaine,
      repasNonEvalues: portionsConsommees.repasNonEvalues,
      portionsParGroupe: portionsConsommees.portionsParGroupe,
      bilansParMembre,
    });
  } catch (err) { next(err); }
});
