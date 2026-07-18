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
