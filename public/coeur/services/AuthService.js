import { auth } from '../../firebase-config.js';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

export const AuthService = {

  async seConnecterAvecGoogle() {
    const provider = new GoogleAuthProvider();
    // Sans ça, si une session Google est déjà active dans le navigateur (cookies), le popup
    // réutilise silencieusement ce compte sans jamais proposer le sélecteur — se déconnecter de
    // l'app puis se reconnecter ne suffit donc pas à changer de compte Google.
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  },

  async seDeconnecter() {
    await signOut(auth);
  },

  utilisateurActuel() {
    return auth.currentUser;
  },

  ecouterAuth(callback) {
    return onAuthStateChanged(auth, callback);
  },
};
