import { auth } from '../firebaseAdmin.js';

// Résout l'identité de l'appelant sans jamais bloquer à ce stade — c'est
// requireUid (posé route par route) qui impose qu'un utilisateur soit résolu
// là où c'est nécessaire.
// Deux formes de token acceptées quand un en-tête Authorization est présent :
// - le token statique STATIC_API_TOKEN (secret serveur) : pensé pour les tests
//   Postman sans navigateur ; l'en-tête X-Test-Uid permet alors de se placer
//   dans le contexte d'un utilisateur donné.
// - un vrai ID token Firebase (émis par Firebase Auth côté front) : vérifié via
//   le SDK Admin.
export async function authentifier(req, res, next) {
  req.uid = null;
  req.profilGoogle = null;

  const enTete = req.get('Authorization') || '';
  const token = enTete.startsWith('Bearer ') ? enTete.slice('Bearer '.length) : null;
  if (!token) return next();

  if (token === process.env.STATIC_API_TOKEN) {
    req.uid = req.get('X-Test-Uid') || null;
    return next();
  }

  try {
    const decode = await auth.verifyIdToken(token);
    req.uid = decode.uid;
    req.profilGoogle = {
      email: decode.email || '',
      nomAffiche: decode.name || decode.email || '',
      photoUrl: decode.picture || '',
    };
    next();
  } catch {
    res.status(401).json({ erreur: 'Token invalide ou expiré.' });
  }
}
