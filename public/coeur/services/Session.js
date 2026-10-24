// Démarrage commun à toutes les pages connectées : authentification Google, rattachement à un
// foyer, droit d'accès au module de la page. C'est ici, et nulle part ailleurs côté front, que se
// décide la redirection d'un utilisateur qui n'a rien à faire sur une page — chaque page déclare
// seulement à quel module elle appartient :
//
//   const session = await ouvrirSession({ module: 'voiture' });
//
// Options :
// - module         : identifiant du module de la page (voir utils/Modules.js) ; sans accès →
//                    retour à l'accueil. Absent pour une page du cœur (accueil, Settings, admin).
// - administrateur : page réservée à l'administrateur du foyer → retour à l'accueil sinon.
// - foyerRequis    : false uniquement pour settings.html, qui sert aussi à créer/rejoindre un foyer.
//
// Résout { utilisateur, foyer: {id, nom} | null, estAdministrateur, modules: [id...] } — calculé
// par le backend (GET /api/session), qui reste seul juge des droits (le front ne fait qu'en tirer
// l'affichage ; chaque route de module revérifie l'accès côté serveur).
import { AuthService } from './AuthService.js';
import { ApiClient } from './ApiClient.js';
import { Utilisateur } from '../models/Utilisateur.js';

export function ouvrirSession({ module = null, administrateur = false, foyerRequis = true } = {}) {
  return new Promise((resolve, reject) => {
    let ouverte = false;

    // L'écoute reste active après l'ouverture : une déconnexion (bouton "Se déconnecter")
    // renvoie toujours vers la page de connexion.
    AuthService.ecouterAuth(async (user) => {
      if (!user) { window.location.href = 'login.html'; return; }
      if (ouverte) return;
      ouverte = true;

      try {
        const donnees = await ApiClient.get('/api/session');
        const session = { ...donnees, utilisateur: new Utilisateur(donnees.utilisateur) };

        if (!session.foyer && foyerRequis) { window.location.href = 'settings.html'; return; }
        if (module && !session.modules.includes(module)) { window.location.href = 'index.html'; return; }
        if (administrateur && !session.estAdministrateur) { window.location.href = 'index.html'; return; }

        resolve(session);
      } catch (err) {
        reject(err);
      }
    });
  });
}
