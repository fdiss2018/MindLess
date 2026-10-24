import { Router } from 'express';
import { FoyerRepository } from '../repositories/FoyerRepository.js';
import { UtilisateurRepository } from '../repositories/UtilisateurRepository.js';
import { requireUid } from '../middleware/requireUid.js';
import { requireMembreFoyer } from '../middleware/requireMembreFoyer.js';
import { requireCreateurFoyer } from '../middleware/requireCreateurFoyer.js';
import {
  IDS_MODULES, estAdministrateur, modulesAccessibles, etatModules, statutDemande, refusDemande, creerDemande,
  appliquerChoixAdministrateur, confirmerModule,
} from '../domain/AccesModules.js';

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

// Membres du foyer avec leur nom affiché, les modules qui leur sont accessibles et l'état de chaque
// module (ouvert, à l'essai, refusé, expiré, fermé) — le client ne peut pas lire utilisateurs/{uid}
// directement (firestore.rules), seul le backend via le SDK Admin le peut. Ouvert à tout membre
// (Settings affiche la liste à chacun), la modification des droits restant réservée à
// l'administrateur (routes suivantes).
// Note : `:foyerId` (et non `:id` comme les routes ci-dessus) car requireMembreFoyer lit
// req.params.foyerId.
foyersRouter.get('/:foyerId/membres', requireMembreFoyer, async (req, res, next) => {
  try {
    const utilisateurs = await Promise.all(
      req.foyer.membres.map((uid) => UtilisateurRepository.obtenir(uid)),
    );
    res.json(req.foyer.membres.map((uid, i) => ({
      uid,
      nomAffiche: utilisateurs[i]?.nomAffiche || null,
      photoUrl: utilisateurs[i]?.photoUrl || null,
      estAdministrateur: estAdministrateur(req.foyer, uid),
      modules: modulesAccessibles(req.foyer, uid),
      etatModules: etatModules(req.foyer, uid),
    })));
  } catch (err) { next(err); }
});

// Vérifications communes aux routes d'administration des droits d'un membre (:uid).
function verifierMembreAdministrable(req, res) {
  if (!req.foyer.membres.includes(req.params.uid)) {
    res.status(404).json({ erreur: "Ce membre n'appartient pas au foyer." });
    return false;
  }
  if (estAdministrateur(req.foyer, req.params.uid)) {
    res.status(400).json({ erreur: "L'administrateur du foyer a toujours accès à tous les modules." });
    return false;
  }
  return true;
}

// L'administrateur coche/décoche les modules d'un membre. Body : { modules: [...cases cochées] }
// (identifiants inconnus ignorés). Un module à l'essai coché reste à l'essai (confirmation : route
// suivante) ; un module ouvert ou à l'essai décoché est refusé — voir appliquerChoixAdministrateur.
// Répond { uid, modules } : les modules définitivement ouverts.
foyersRouter.put('/:foyerId/membres/:uid/modules', requireMembreFoyer, requireCreateurFoyer, async (req, res, next) => {
  try {
    if (!verifierMembreAdministrable(req, res)) return;
    const { uid } = req.params;
    const choix = appliquerChoixAdministrateur(req.foyer, uid, req.body.modules);
    await FoyerRepository.appliquerAccesMembre(req.foyer.id, uid, choix);
    res.json({ uid, modules: choix.modules });
  } catch (err) { next(err); }
});

// L'administrateur confirme un module (à l'essai, refusé ou expiré) : accès définitif.
foyersRouter.post('/:foyerId/membres/:uid/modules/:idModule/confirmer', requireMembreFoyer, requireCreateurFoyer, async (req, res, next) => {
  try {
    if (!verifierMembreAdministrable(req, res)) return;
    const { uid, idModule } = req.params;
    if (!IDS_MODULES.includes(idModule)) return res.status(400).json({ erreur: 'Module inconnu.' });
    const choix = confirmerModule(req.foyer, uid, idModule);
    await FoyerRepository.appliquerAccesMembre(req.foyer.id, uid, choix);
    res.json({ uid, modules: choix.modules });
  } catch (err) { next(err); }
});

// Un membre demande lui-même un module (Settings) : accès immédiat à l'essai pendant 3 semaines, en
// attendant que l'administrateur confirme ou refuse. Body : { module }. Refusé (400) si le module
// est déjà ouvert, déjà à l'essai, refusé ou si un essai a déjà expiré — voir refusDemande.
foyersRouter.post('/:foyerId/demandes-modules', requireMembreFoyer, async (req, res, next) => {
  try {
    const idModule = req.body.module;
    const refus = refusDemande(req.foyer, req.uid, idModule);
    if (refus) return res.status(400).json({ erreur: refus });
    const demande = creerDemande();
    await FoyerRepository.appliquerAccesMembre(req.foyer.id, req.uid, { demandes: { [idModule]: demande } });
    res.status(201).json({ module: idModule, ...demande });
  } catch (err) { next(err); }
});

// Le membre arrête son propre essai en cours : l'essai se termine maintenant, comme une expiration
// anticipée — la demande n'est pas effacée, sinon demander/arrêter/redemander permettrait
// d'enchaîner les essais sans jamais passer par l'administrateur.
foyersRouter.delete('/:foyerId/demandes-modules/:idModule', requireMembreFoyer, async (req, res, next) => {
  try {
    const { idModule } = req.params;
    const demande = req.foyer.demandesModules?.[req.uid]?.[idModule];
    if (statutDemande(demande) !== 'en_attente') {
      return res.status(404).json({ erreur: 'Aucun essai en cours pour ce module.' });
    }
    await FoyerRepository.appliquerAccesMembre(req.foyer.id, req.uid, {
      demandes: { [idModule]: { ...demande, expiration: Date.now() } },
    });
    res.status(204).end();
  } catch (err) { next(err); }
});
