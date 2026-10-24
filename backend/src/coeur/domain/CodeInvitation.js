// Anciennement dupliqué côté front — la génération du code se fait désormais
// uniquement côté serveur, lors de la création d'un foyer.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR = 6;

export function genererCodeInvitation() {
  let code = '';
  for (let i = 0; i < LONGUEUR; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
